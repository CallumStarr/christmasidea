// Gift Intelligence Engine orchestrator.
//   understand -> (LLM proposes candidates + directions) -> graph backups -> validate (safety gate)
//   -> multi-objective rank + MMR diversify -> grounded connections -> recipient model
// The LLM is one component: it reads nuance and proposes ideas. Everything that decides what is
// shown, in what order, and why, is deterministic and testable.

import { catalogueCandidates } from "../catalogue.js";
import { curateIdeas } from "../validate.js";
import { connectionFor } from "./explain.js";
import { GRAPH_VERSION, describeFacets } from "./interest-graph.js";
import { RANKER_VERSION, intraListDiversity, rankIdeas } from "./ranking.js";
import { buildRecipientModel, understand, verifiedDirections } from "./recipient-model.js";
import { retrieve } from "./retrieval.js";

export const ENGINE_VERSION = "gift-engine-v1";
export { understand };

/**
 * Hints for the prompt. Built only from server-side graph labels, never from shopper text, so
 * they cannot carry an injection; the prompt presents them as hypotheses to confirm or ignore.
 */
export function promptHints(understanding) {
  const stated = understanding.interests.filter((d) => !d.trait);
  if (!stated.length) return null;
  return {
    interests: stated.slice(0, 5).map((d) => d.label),
    traits: understanding.interests.filter((d) => d.trait).slice(0, 3).map((d) => d.label),
    motivations: describeFacets(understanding.facets, 5),
  };
}

/** Curated graph concepts that fit this recipient, shaped as raw ideas so the validator checks them identically. */
export function graphBackups(understanding, { limit = 10 } = {}) {
  if (!understanding.interests.some((d) => !d.trait)) return [];
  return retrieve(understanding.ctx, understanding, { limit: 40 })
    .filter((r) => r.doc.kind === "graph")
    .slice(0, limit)
    .map((r) => ({
      title: r.doc.title,
      concept: r.doc.concept,
      why: r.doc.why,
      based_on: r.via.anchor,
      search_query: r.doc.query,
      category: r.doc.category,
      estimated_max_price_gbp: r.doc.maxPrice,
      strategy: r.via.direct ? "core-interest" : "adjacent-driver",
      gift_type: "physical",
      source: "graph",
      provenance: r.via,
    }));
}

/**
 * Validates, ranks and explains. `raw` may be model output or a server-built candidate list.
 * @param opts { limit, exclude, truncated, understanding, backups (default true) }
 */
export function runEngine(raw, input, opts = {}) {
  const u = opts.understanding || understand(input);
  const directions = verifiedDirections(raw, u.ctx);
  const engine = { ...u, directions, text: u.ctx.text };
  const backups = opts.backups === false ? [] : graphBackups(u);

  const result = curateIdeas(raw, input, {
    limit: opts.limit,
    exclude: opts.exclude,
    truncated: opts.truncated,
    extraCandidates: [...backups, ...(opts.extraCandidates || [])],
    rank: (unique, ctx, limit, helpers) => rankIdeas(unique, ctx, limit, engine, helpers),
    decorate: (idea, ctx) => ({
      connection: connectionFor(idea, ctx, engine),
      strategy: idea.strategy || (idea.rank?.kind === "adjacent" ? "adjacent-driver" : "core-interest"),
      // "Something different" means a step sideways; combining two stated interests is not a surprise.
      discovery: idea.rank?.kind === "adjacent",
      gift_type: idea.giftType,
      source: idea.source,
      _rank: idea.rank,
    }),
  });

  const kinds = {};
  for (const i of result.ideas) kinds[i._rank?.kind || "none"] = (kinds[i._rank?.kind || "none"] || 0) + 1;
  result.recipient = buildRecipientModel(u, raw);
  result.diagnostics.engine = {
    version: ENGINE_VERSION,
    graph: GRAPH_VERSION,
    ranker: RANKER_VERSION,
    interests: u.interests.map((d) => d.id),
    motivations: u.facets.slice(0, 5).map((f) => f.id),
    directions_offered: Array.isArray(raw?.directions) ? raw.directions.length : 0,
    directions_verified: directions.size,
    kinds,
    discovery_shown: result.ideas.filter((i) => i.discovery).length,
    connections_shown: result.ideas.filter((i) => i.connection).length,
    scores: result.ideas.map((i) => ({ title: i.title, utility: i._rank?.utility, kind: i._rank?.kind, source: i.source })),
  };
  for (const i of result.ideas) delete i._rank;
  return result;
}

export { intraListDiversity };

/**
 * Fallback when the model is unavailable: graph concepts plus age- and budget-eligible catalogue
 * entries, put through the same safety gate, ranker and explainer as AI ideas.
 */
export function engineFallback(input, opts = {}) {
  const u = opts.understanding || understand(input);
  const { candidates, filtered, total } = catalogueCandidates(input, u.ctx);
  const result = runEngine({ recipient_summary: "", ideas: [] }, input, {
    limit: opts.limit || 8,
    understanding: u,
    extraCandidates: candidates.map((c) => ({ ...c, source: "catalogue", gift_type: "physical" })),
  });
  result.diagnostics.catalogue_count = total;
  result.diagnostics.raw_count = total;
  result.diagnostics.catalogue_filtered = filtered.length;
  return result;
}
