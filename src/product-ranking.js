import { scoreProductMatch, productMatchThresholds } from "./product-matcher.js";
import { canonicalKey } from "./engine/product-identity.js";
import { assessProductEvidence, compileProductEvidence } from "./engine/product-evidence.js";

export const PRODUCT_RANKING_VERSION = "product-ranker-v1";
const offerKey = (product) => `${product.provider}:${product.productId}`;
const hasTotal = (product) => product.priceIncludesDelivery === true
  && product.price?.currency === "GBP" && Number.isFinite(product.price.amount) && product.price.amount > 0;
const stable = (a, b) => offerKey(a) < offerKey(b) ? -1 : offerKey(a) > offerKey(b) ? 1 : 0;
const byRank = (a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl))
  || b.ranking.score - a.ranking.score || stable(a, b);

export function rankProductCandidates(idea, products, {
  evidence = compileProductEvidence(), thresholds = productMatchThresholds(),
} = {}) {
  const groups = new Map(), listings = new Map();
  for (const product of products) {
    const key = canonicalKey(product);
    if (!key) continue;
    const match = scoreProductMatch(idea, product, thresholds);
    if (!match.accepted) continue;
    const assessment = assessProductEvidence(idea, product, evidence);
    if (assessment.blocked) continue;
    const ranked = {
      ...product, matchScore: match.matchScore,
      ranking: {
        version: PRODUCT_RANKING_VERSION, evidenceVersion: evidence.version,
        ...assessment,
        // Quality can move utility by at most +/-0.02; it cannot bypass matching constraints.
        score: match.matchScore + 0.04 * (assessment.qualityScore - 0.5),
      },
    };
    const previous = listings.get(offerKey(product));
    if (!previous || byRank(ranked, previous) < 0
        || (byRank(ranked, previous) === 0 && ranked.title < previous.title)) listings.set(offerKey(product), ranked);
  }
  for (const ranked of listings.values()) {
    const key = canonicalKey(ranked);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ranked);
  }
  const ordered = [...groups.values()].map((offers) => offers.sort((a, b) =>
    Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl))
    || Number(hasTotal(b)) - Number(hasTotal(a))
    || (hasTotal(a) && hasTotal(b) ? a.price.amount - b.price.amount : 0)
    || byRank(a, b)));
  ordered.sort((a, b) => byRank(a[0], b[0]));
  return ordered.flat();
}

// Augmenting paths maximise card coverage while retaining a ranked fallback for collisions.
export function allocateProductCandidates(pools) {
  const products = new Array(pools.length).fill(null), owner = new Map();
  const take = (index, visited) => {
    for (const product of pools[index]) {
      const key = canonicalKey(product);
      if (!key || visited.has(key)) continue;
      visited.add(key);
      const previous = owner.get(key);
      if (previous === undefined || take(previous, visited)) {
        owner.set(key, index);
        products[index] = product;
        return true;
      }
    }
    return false;
  };
  const order = pools.map((pool, index) => ({ index, score: pool[0]?.matchScore || 0 }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  for (const { index } of order) take(index, new Set());
  const claimed = new Map(products.flatMap((product, index) => product ? [[canonicalKey(product), index]] : []));
  const offers = pools.map((pool, index) => {
    if (!products[index]) return [];
    const result = [products[index]], providers = new Set([products[index].provider]);
    for (const product of pool) {
      const assigned = claimed.get(canonicalKey(product));
      if (providers.has(product.provider) || (assigned !== undefined && assigned !== index)) continue;
      result.push(product);
      providers.add(product.provider);
      claimed.set(canonicalKey(product), index);
    }
    return result;
  });
  return { products, offers, duplicates: pools.filter((pool, index) => pool.length && !products[index]).length };
}
