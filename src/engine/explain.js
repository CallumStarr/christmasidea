// Grounded explanations. A "connection" says which words of the shopper's an idea grew from and,
// for discovery ideas, which motivation it follows. Anchors are always re-verified against the
// shopper's input; if nothing verifies, no connection is shown rather than an invented one.

import { FACETS } from "./interest-graph.js";
import { verifyAnchor } from "./recipient-model.js";

const quote = (s) => `\u201c${s}\u201d`;
// Statements about what they own or dislike are constraints, never reasons to buy something.
const NEGATIVE_ANCHOR = /\b(?:already|has (?:every|all|lots|loads|plenty)|owns?|doesn['\u2019]?t|don['\u2019]?t|hates?|dislikes?|never|avoid|no more|not)\b/i;
const usable = (anchor, ctx) => Boolean(anchor) && !NEGATIVE_ANCHOR.test(anchor) && verifyAnchor(anchor, ctx);

function template(kind, anchor, via) {
  if (kind === "adjacent" && via) return `You mentioned ${quote(anchor)} \u2014 this follows the ${via} side of that.`;
  if (kind === "cross" && via) return `Brings together ${quote(anchor)} and ${via}.`;
  if (kind === "adjacent" || kind === "cross") return `A step sideways from ${quote(anchor)}.`;
  return `Built on what you said: ${quote(anchor)}.`;
}

/**
 * @param idea   validated idea carrying `rank` diagnostics from ranking.js
 * @param ctx    deriveRecipient output
 * @param engine { interests, facetMap, directions }
 * @returns { anchor, via, kind, strategy, text } | null
 */
export function connectionFor(idea, ctx, engine) {
  const r = idea.rank || {};
  // "cross" is only claimed when two stated interests verify below; otherwise it is a direct link.
  const kind = r.kind === "neutral" || r.kind === "general" || r.kind === "cross" ? "direct" : (r.kind || "direct");
  const facetLabel = (id) => (id && FACETS[id] ? FACETS[id].label : null);
  let anchor = null;
  let via = null;

  if (r.kind === "cross" && r.directIds?.length >= 2) {
    const [a, b] = r.directIds.map((id) => engine.interests.find((d) => d.id === id)?.evidence).filter((e) => usable(e, ctx));
    if (a && b) return { anchor: a, via: b, kind: "cross", strategy: "cross-interest", text: `Brings together ${quote(a)} and ${quote(b)}.` };
  }

  if (kind === "direct" && r.directIds?.length) {
    const named = r.directIds.map((id) => engine.interests.find((d) => d.id === id)).filter(Boolean);
    const basis = String(idea.basedOn || "").toLowerCase();
    const pick = named.find((d) => basis.includes(d.evidence.toLowerCase())) || named[0];
    if (pick && usable(pick.evidence, ctx)) {
      return { anchor: pick.evidence, via: null, kind: "direct", strategy: idea.strategy || "core-interest", text: template("direct", pick.evidence) };
    }
  }

  if (idea.provenance && usable(idea.provenance.anchor, ctx)) {
    anchor = idea.provenance.anchor;
    via = idea.provenance.direct ? null : idea.provenance.facetLabel;
  } else if (r.direction && usable(r.direction.anchor, ctx)) {
    anchor = r.direction.anchor;
    // Prefer our own facet wording; fall back to the model's (already sanitised) direction label.
    via = facetLabel(bestFacet(r.linkedFacets, engine)) || r.direction.label.toLowerCase();
  } else if (idea.basedOn && !/^versatile\b/i.test(idea.basedOn) && usable(idea.basedOn, ctx)) {
    anchor = idea.basedOn;
    via = facetLabel(bestFacet(r.linkedFacets, engine));
  } else {
    const facet = bestFacet(r.linkedFacets, engine);
    const source = facet
      ? engine.interests.filter((d) => engine.facetMap.get(facet)?.from.includes(d.id)).sort((a, b) => b.strength - a.strength)[0]
      : engine.interests.find((d) => r.directIds?.includes(d.id));
    if (source && usable(source.evidence, ctx)) {
      anchor = source.evidence;
      via = facetLabel(facet);
    }
  }
  if (!anchor) return null;
  const shownKind = kind === "direct" ? "direct" : kind;
  return {
    anchor,
    via: shownKind === "direct" ? null : via,
    kind: shownKind,
    strategy: idea.strategy || (shownKind === "direct" ? "core-interest" : "adjacent-driver"),
    text: template(shownKind, anchor, shownKind === "direct" ? null : via),
  };
}

function bestFacet(facets = [], engine) {
  let best = null;
  for (const f of facets) {
    const w = engine.facetMap.get(f)?.weight || 0;
    if (w && (!best || w > best.w)) best = { f, w };
  }
  return best ? best.f : null;
}
