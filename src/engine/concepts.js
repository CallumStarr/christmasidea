import { CONCEPTS } from "./interest-graph.js";
import { jaccard, stemSet } from "../text.js";

// Query-derived keys survive insertions into the graph's position-numbered concept list.
export const conceptKey = (concept) => concept.query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const CONCEPT_BY_KEY = new Map(CONCEPTS.map((concept) => [conceptKey(concept), concept]));

export function matchConcept(idea) {
  const title = String(idea?.title || "").toLowerCase();
  const query = String(idea?.query || idea?.search_query || "").toLowerCase();
  const titleMatch = CONCEPTS.find((concept) => concept.title.toLowerCase() === title);
  const queryMatch = CONCEPTS.find((concept) => concept.query.toLowerCase() === query);
  if (titleMatch && queryMatch && titleMatch !== queryMatch) return null;
  const exact = titleMatch || queryMatch;
  if (exact) {
    const other = stemSet(titleMatch ? query : title);
    if (other.size && jaccard(other, exact.stems) < 0.5) return null;
    return conceptKey(exact);
  }
  const stems = stemSet(`${title} ${query}`);
  const matches = CONCEPTS.map((concept) => ({ concept, score: jaccard(stems, concept.stems) }))
    .filter(({ score }) => score >= 0.8).sort((a, b) => b.score - a.score);
  if (!matches.length || (matches[1] && matches[0].score - matches[1].score < 0.1)) return null;
  return conceptKey(matches[0].concept);
}
