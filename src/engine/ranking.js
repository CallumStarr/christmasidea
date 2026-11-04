// Deterministic multi-objective ranking and diversification.
// Each validated candidate gets separate, inspectable feature scores; a weighted utility orders
// them, then Maximal Marginal Relevance (Carbonell & Goldstein, SIGIR 1998) with an xQuAD-style
// coverage bonus (Santos et al., WWW 2010) picks the final set. Greedy reranking is used instead
// of asking the LLM to rerank: Carraro & Bridge (ACM TORS, doi:10.1145/3700604) found zero-shot LLM
// diversity reranking promising but still behind traditional greedy rerankers on quality and cost.

import { jaccard, stemSet } from "../text.js";
import { normEvidence, productType } from "../validate.js";
import { CONCEPTS, detectInterests, interestById, isDirectFor } from "./interest-graph.js";

export const RANKER_VERSION = "ranker-v1";

export const WEIGHTS = { grounding: 0.25, interestFit: 0.2, modelPrior: 0.2, novelty: 0.15, specificity: 0.1, budgetFit: 0.1 };
export const MMR_LAMBDA = 0.7;
export const CAPS = { category: 3, productType: 2, strategy: 3, backup: 3, saturatedInterest: 3 };
const BACKUP_FACTOR = 0.85;
const COVERAGE = { interest: 0.08, facet: 0.04 };
const NOVELTY = { adjacent: 1, cross: 0.8, direct: 0.35, general: 0.2, neutral: 0.5 };
// Filler gifts that only earn a place when they are clearly tied to something the shopper said.
const GENERIC = /\b(?:mug|socks?|candle|gift card|voucher|hamper|keyring|key ring|water bottle|tote bag|chocolates?|photo frame|notebook)\b/i;

/** Facets (motivations) an idea serves, from the nearest curated concept and any interests it names. */
export function ideaFacets(idea) {
  const stems = new Set([...idea.titleStems, ...idea.queryStems]);
  let best = null;
  let bestScore = 0.45;
  for (const c of CONCEPTS) {
    const s = jaccard(stems, c.stems);
    if (s >= bestScore) { best = c; bestScore = s; }
  }
  const named = detectInterests(`${idea.title} ${idea.concept} ${idea.query}`).filter((d) => !d.trait);
  const facets = new Set(best ? best.facets : []);
  for (const d of named) for (const f of interestById(d.id).facets.slice(0, 3)) facets.add(f);
  return { facets: [...facets], concept: best ? best.id : null, named: named.map((d) => d.id) };
}

/**
 * @param engine { interests, facets, directions: Map(id -> verified direction), text }
 */
export function scoreIdea(idea, ctx, engine) {
  const stated = engine.interests.filter((d) => !d.trait);
  const facetMap = engine.facetMap;
  const maxFacet = engine.facets[0]?.weight || 1;
  const { facets, concept } = ideaFacets(idea);
  const stems = new Set([...idea.titleStems, ...idea.queryStems]);
  const directIds = stated.filter((d) => isDirectFor(stems, [d.id])).map((d) => d.id);
  const linkedFacets = facets.filter((f) => facetMap.has(f));

  let interestFit = 0.5;
  if (engine.interests.length) {
    interestFit = Math.min(1, linkedFacets.reduce((s, f) => s + facetMap.get(f).weight, 0) / (maxFacet * 2));
    if (directIds.length) interestFit = Math.max(interestFit, 0.9);
  }

  let kind = "neutral";
  if (stated.length) {
    if (directIds.length >= 2) kind = "cross";
    else if (directIds.length === 1) kind = "direct";
    else if (linkedFacets.length) kind = "adjacent";
    else kind = "general";
  }
  const direction = idea.direction ? engine.directions.get(idea.direction.toLowerCase()) : null;
  if (kind === "general" && direction && (idea.strategy === "adjacent-driver" || idea.strategy === "cross-interest")) kind = "adjacent";

  const corpus = ` ${normEvidence(engine.text)} `;
  const basis = normEvidence(idea.basedOn);
  let grounding = 0.4;
  if (idea.provenance) grounding = 1;
  else if (direction) grounding = 0.95;
  else if (basis.length >= 3 && corpus.includes(` ${basis} `)) grounding = 0.9;
  else if (/^versatile\b/i.test(idea.basedOn)) grounding = 0.45;
  else if (basis) grounding = 0.75;

  const modelPrior = idea.source === "model" ? 1 - Math.min(idea.index, 12) / 12 : 0.3;
  const specificity = GENERIC.test(idea.title) && interestFit < 0.3 ? 0.3 : idea.title.split(/\s+/).length >= 3 ? 1 : 0.8;

  let budgetFit = 0.7;
  const budget = ctx?.budget?.max;
  if (budget && idea.estMax) {
    const ratio = idea.estMax / budget;
    budgetFit = ratio > 1.1 ? 0 : ratio >= 0.5 ? 1 : 0.5 + ratio;
  } else if (budget) budgetFit = 0.6;

  const features = { grounding, interestFit, modelPrior, novelty: NOVELTY[kind], specificity, budgetFit };
  let utility = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * features[k], 0);
  if (idea.source !== "model") utility *= BACKUP_FACTOR;
  const coverInterest = directIds.length ? directIds : (idea.provenance ? [idea.provenance.interest] : []);
  return { utility: round(utility), features, kind, facets, linkedFacets, directIds, coverInterest, concept, direction };
}

const round = (n) => Math.round(n * 1000) / 1000;

export function similarity(a, b, productType) {
  let s = 0.6 * jaccard(a.titleStems, b.titleStems);
  if (productType(a) && productType(a) === productType(b)) s += 0.5;
  if (a.direction && a.direction.toLowerCase() === (b.direction || "").toLowerCase()) s += 0.2;
  if (a.category === b.category) s += 0.15;
  if (a.strategy && a.strategy === b.strategy) s += 0.1;
  return Math.min(1, s);
}

/**
 * Greedy MMR selection with coverage bonus, hard variety caps and small discovery quotas.
 * Returns the chosen ideas in selection order, each carrying `rank` diagnostics.
 */
export function rankIdeas(unique, ctx, limit, engine, { productType, issues = [] } = {}) {
  const pool = unique.map((idea) => ({ idea, s: scoreIdea(idea, ctx, engine) }));
  const stated = engine.interests.filter((d) => !d.trait).map((d) => d.id);
  const topFacets = new Set(engine.facets.slice(0, 5).map((f) => f.id));
  const minAdjacent = stated.length ? Math.min(2, pool.filter((p) => p.s.kind === "adjacent").length) : 0;
  const minDirect = stated.length ? Math.min(2, pool.filter((p) => p.s.kind === "direct" || p.s.kind === "cross").length) : 0;

  // An interest the shopper says is already well stocked ("already has loads of train sets") gets
  // fewer literal ideas so the list reaches for the motivations behind it instead.
  const ownedStems = new Set((ctx.owned || []).flatMap((o) => [...o.stems]));
  const saturated = new Set(stated.filter((id) => [...(interestById(id)?.ownStems || [])].some((s) => ownedStems.has(s))));
  const directOk = (p) => p.s.directIds.every((id) => !saturated.has(id) || (tally.direct[id] || 0) < CAPS.saturatedInterest);

  // Without model ideas (catalogue fallback) every candidate is a server-built one, so no backup cap.
  const hasModel = pool.some((p) => p.idea.source === "model");
  const chosen = [];
  const covered =  { interest: new Set(), facet: new Set() };
  const tally = { category: {}, type: {}, strategy: {}, direct: {}, backup: 0 };
  // The backup cap is never relaxed: graph concepts top up a thin model list but must not take it over.
  const backupOk = (p) => !hasModel || p.idea.source === "model" || tally.backup < CAPS.backup;
  const within = (p) => (tally.category[p.idea.category] || 0) < CAPS.category
    && (tally.type[productType(p.idea)] || 0) < CAPS.productType
    && (!p.idea.strategy || (tally.strategy[p.idea.strategy] || 0) < CAPS.strategy)
    && directOk(p)
    && backupOk(p);

  const mmr = (p) => {
    const maxSim = chosen.length ? Math.max(...chosen.map((c) => similarity(p.idea, c.idea, productType))) : 0;
    let bonus = 0;
    if (p.s.coverInterest.some((id) => !covered.interest.has(id))) bonus += COVERAGE.interest;
    if (p.s.linkedFacets.some((f) => topFacets.has(f) && !covered.facet.has(f))) bonus += COVERAGE.facet;
    return MMR_LAMBDA * p.s.utility - (1 - MMR_LAMBDA) * maxSim + bonus;
  };

  const take = (p, relaxed) => {
    chosen.push(p);
    tally.category[p.idea.category] = (tally.category[p.idea.category] || 0) + 1;
    const t = productType(p.idea);
    tally.type[t] = (tally.type[t] || 0) + 1;
    if (p.idea.strategy) tally.strategy[p.idea.strategy] = (tally.strategy[p.idea.strategy] || 0) + 1;
    p.s.directIds.forEach((id) => { tally.direct[id] = (tally.direct[id] || 0) + 1; });
    if (p.idea.source !== "model") tally.backup += 1;
    p.s.coverInterest.forEach((id) => covered.interest.add(id));
    p.s.linkedFacets.forEach((f) => covered.facet.add(f));
    if (relaxed) issues.push({ index: p.idea.index, code: "variety_cap_relaxed", action: "warned" });
  };

  // Relax the variety caps first; the saturated-interest cap goes last.
  const passes = [within, (p) => directOk(p) && backupOk(p), backupOk];
  for (const [n, allowed] of passes.entries()) {
    const relaxed = n > 0;
    while (chosen.length < limit) {
      let candidates = pool.filter((p) => !chosen.includes(p) && allowed(p));
      if (!candidates.length) break;
      const slots = limit - chosen.length;
      const adj = chosen.filter((c) => c.s.kind === "adjacent").length;
      const dir = chosen.filter((c) => c.s.kind === "direct" || c.s.kind === "cross").length;
      const needAdj = Math.max(0, minAdjacent - adj);
      const needDir = Math.max(0, minDirect - dir);
      if (slots <= needAdj + needDir) {
        const want = candidates.filter((p) => (needAdj && p.s.kind === "adjacent") || (needDir && (p.s.kind === "direct" || p.s.kind === "cross")));
        if (want.length) candidates = want;
      }
      let best = null;
      let bestScore = -Infinity;
      for (const p of candidates) {
        const score = mmr(p);
        if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && p.idea.index < best.idea.index)) { best = p; bestScore = score; }
      }
      take(best, relaxed);
    }
  }

  return chosen.map((p, n) => Object.assign(p.idea, { rank: { position: n + 1, ...p.s } }));
}

/** Intra-list diversity: mean pairwise (1 - similarity). Accepts internal or public ideas; used by tests and the benchmark. */
export function intraListDiversity(ideas, typeOf = productType) {
  const list = ideas.map((i) => (i.titleStems ? i : { ...i, titleStems: stemSet(`${i.title} ${i.concept || ""}`) }));
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) { total += 1 - similarity(list[i], list[j], typeOf); pairs += 1; }
  }
  return pairs ? round(total / pairs) : 0;
}
