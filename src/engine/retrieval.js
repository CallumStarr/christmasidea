// Hybrid candidate retrieval over the curated concept graph and the fallback catalogue.
// Two independent rankers are fused with Reciprocal Rank Fusion (Cormack et al., SIGIR 2009):
//   1. lexical  - Okapi BM25 over stemmed title/query/keywords, queried with the shopper's words
//   2. graph    - facet overlap between each document and the recipient's weighted motivations
// RRF needs no score calibration, so a dense-embedding ranker can be added later as a third
// list without retuning (see docs/gift-intelligence-engine.md, "Embeddings").

import { CATALOGUE } from "../catalogue.js";
import { STOP, VAGUE, stemSet } from "../text.js";
import { CONCEPTS, audienceFor, detectInterests, facetWeights, interestById } from "./interest-graph.js";

const RRF_K = 60;
const BM25 = { k1: 1.2, b: 0.75 };
const BAND_MAX = { xs: 10, lo: 30, mid: 50, hi: 100 };
const AUDIENCE_CODE = { kid: "k", teen: "t", adult: "a" };

// Light surface normalisation (plurals only). Full stemming conflates "training" with "train",
// which is exactly the kind of false lexical match the graph ranker is there to avoid.
export function terms(text) {
  return (String(text || "").toLowerCase().match(/[a-z]+/g) || [])
    .filter((w) => w.length > 2 && !STOP.has(w) && !VAGUE.has(w))
    .map((w) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w));
}

function catalogueDocs() {
  return CATALOGUE.map((item, n) => {
    const kw = (item.k || []).join(" ");
    const interests = detectInterests(`${kw} ${item.t}`).filter((d) => !d.trait);
    const facets = [...new Set(interests.flatMap((d) => interestById(d.id).facets.slice(0, 3)))];
    return {
      id: `c${n + 1}`,
      kind: "catalogue",
      title: item.t,
      concept: item.t,
      query: item.q,
      category: item.c,
      audiences: (item.a || []).map((a) => AUDIENCE_CODE[a] || "").join(""),
      maxPrice: Math.min(...(item.b || ["hi"]).map((b) => BAND_MAX[b] || 100)),
      facets,
      interests: interests.map((d) => d.id),
      why: item.w,
      text: `${item.t} ${item.q} ${kw}`,
    };
  });
}

let INDEX = null;
function buildIndex() {
  const docs = [
    ...CONCEPTS.map((c) => ({ ...c, kind: "graph", text: `${c.title} ${c.query} ${c.interests.join(" ")}` })),
    ...catalogueDocs(),
  ].map((d) => {
    const list = terms(d.text);
    const tf = new Map();
    for (const t of list) tf.set(t, (tf.get(t) || 0) + 1);
    return { ...d, tf, len: list.length, stems: stemSet(`${d.title} ${d.query}`) };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  return { docs, df, avgLen, n: docs.length };
}
export function index() {
  if (!INDEX) INDEX = buildIndex();
  return INDEX;
}

function bm25(doc, queryTerms, idx) {
  let score = 0;
  for (const q of queryTerms) {
    const f = doc.tf.get(q);
    if (!f) continue;
    const df = idx.df.get(q) || 0;
    const idf = Math.log(1 + (idx.n - df + 0.5) / (df + 0.5));
    score += idf * ((f * (BM25.k1 + 1)) / (f + BM25.k1 * (1 - BM25.b + BM25.b * (doc.len / idx.avgLen))));
  }
  return score;
}

const rankOf = (scored) => {
  const ranks = new Map();
  scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
    .forEach((s, n) => ranks.set(s.doc.id, n + 1));
  return ranks;
};

/**
 * @param recipient  { text, ageYears, budget } from deriveRecipient
 * @param profile    { interests, facets } from the recipient model (optional; derived if absent)
 * @returns ranked [{ doc, score, lexicalRank, graphRank, via }] - via explains the graph link
 */
export function retrieve(recipient, profile = null, { limit = 24 } = {}) {
  const idx = index();
  const interests = profile?.interests || detectInterests(recipient.text);
  const facets = profile?.facets || facetWeights(interests);
  const facetMap = new Map(facets.map((f) => [f.id, f]));
  const audience = audienceFor(recipient.ageYears);
  const budget = recipient.budget?.max ?? null;
  const queryTerms = [...new Set(terms(recipient.text))];

  const eligible = idx.docs.filter((d) => audience && d.audiences.includes(audience) && (budget === null || d.maxPrice <= budget * 1.1));
  const lexical = rankOf(eligible.map((doc) => ({ doc, score: bm25(doc, queryTerms, idx) })));
  const graph = rankOf(eligible.map((doc) => ({
    doc,
    score: doc.facets.reduce((s, f, n) => s + (facetMap.get(f)?.weight || 0) * (1 - n * 0.15), 0),
  })));

  const fused = eligible.map((doc) => {
    const lr = lexical.get(doc.id);
    const gr = graph.get(doc.id);
    const score = (lr ? 1 / (RRF_K + lr) : 0) + (gr ? 1 / (RRF_K + gr) : 0);
    return { doc, score, lexicalRank: lr || null, graphRank: gr || null, via: provenance(doc, facetMap, interests) };
  }).filter((r) => r.score > 0 && r.via);

  return fused.sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id)).slice(0, limit);
}

/** Which stated interest (with its verbatim anchor) and which motivation link this document to the recipient. */
export function provenance(doc, facetMap, interests) {
  const direct = interests.find((d) => doc.interests.includes(d.id) && !d.trait);
  let best = null;
  for (const f of doc.facets) {
    const fw = facetMap.get(f);
    if (fw && (!best || fw.weight > best.weight)) best = fw;
  }
  if (!best && !direct) return null;
  const sourceId = direct ? direct.id : best.from.map((id) => interests.find((d) => d.id === id)).filter(Boolean)
    .sort((a, b) => b.strength - a.strength)[0]?.id;
  const source = interests.find((d) => d.id === sourceId);
  if (!source) return null;
  return {
    interest: source.id,
    interestLabel: source.label,
    anchor: source.evidence,
    facet: best ? best.id : null,
    facetLabel: best ? best.label : null,
    direct: Boolean(direct),
  };
}
