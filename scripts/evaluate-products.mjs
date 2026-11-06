import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseProductIdea } from "../src/product-validation.js";
import { canonicalKey } from "../src/engine/product-identity.js";
import { compileProductEvidence, isProductEvidenceKey } from "../src/engine/product-evidence.js";
import { rankProductCandidates, PRODUCT_RANKING_VERSION } from "../src/product-ranking.js";

const gain = (grade, index) => (2 ** grade - 1) / Math.log2(index + 2);

export function evaluateProductCases(cases, { policy, now = Date.now(), k = 5 } = {}) {
  if (!Array.isArray(cases) || !cases.length || !Number.isInteger(k) || k < 1 || k > 20) {
    throw new TypeError("Expected nonempty product cases and k between 1 and 20");
  }
  const evidence = compileProductEvidence(policy, now), ids = new Set();
  const pools = [], results = [];
  for (const item of cases) {
    const idea = normaliseProductIdea(item?.idea);
    if (typeof item?.id !== "string" || !item.id.trim() || ids.has(item.id)
        || !idea || !Array.isArray(item.products) || item.products.some((product) => !canonicalKey(product))) {
      throw new TypeError("Invalid product case or duplicate case ID");
    }
    ids.add(item.id);
    const ranked = rankProductCandidates(idea, item.products, { evidence });
    const unique = [...new Set(ranked.map(canonicalKey))];
    const top = unique.slice(0, k);
    const labels = item.relevance;
    let ndcg = null, recall = null;
    if (labels !== undefined) {
      if (!labels || typeof labels !== "object" || Array.isArray(labels) || !Object.keys(labels).length
          || Object.values(labels).some((grade) => !Number.isInteger(grade) || grade < 0 || grade > 3)
          || Object.keys(labels).some((key) => !isProductEvidenceKey(key))
          || item.products.some((product) => !Object.hasOwn(labels, canonicalKey(product)))) {
        throw new TypeError(`Invalid or incomplete relevance judgments for ${item.id}`);
      }
      const ideal = Object.values(labels).sort((a, b) => b - a).slice(0, k).reduce((sum, grade, index) => sum + gain(grade, index), 0);
      ndcg = ideal ? top.reduce((sum, key, index) => sum + gain(labels[key], index), 0) / ideal : null;
      const positives = Object.values(labels).filter((grade) => grade > 0).length;
      recall = positives ? top.filter((key) => labels[key] > 0).length / positives : null;
    }
    pools.push(ranked);
    results.push({
      id: item.id, candidates: item.products.length, eligibleProducts: unique.length,
      top, ndcg, recall,
      evidenceCoverage: ranked.length ? ranked.reduce((sum, product) => sum + product.ranking.evidenceCoverage, 0) / ranked.length : 0,
    });
  }
  const mean = (key) => {
    const values = results.map((item) => item[key]).filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  // Cases are independent judgments, not a single shopper's cards.
  const coverage = pools.filter((pool) => pool.length > 0).length;
  return {
    ranker: PRODUCT_RANKING_VERSION, evidenceVersion: evidence.version, cases: cases.length, k,
    matchedCases: coverage, matchCoverage: coverage / cases.length,
    judgedCases: results.filter((item) => item.ndcg !== null).length,
    ndcg: mean("ndcg"), recall: mean("recall"), evidenceCoverage: mean("evidenceCoverage"),
    qualityClaim: false, results,
  };
}

async function main() {
  const [, , casesPath, policyPath, ...extra] = process.argv;
  if (!casesPath || extra.length) throw new Error("Usage: node scripts/evaluate-products.mjs cases.json [evidence-policy.json]");
  const cases = JSON.parse(await readFile(resolve(casesPath), "utf8"));
  const policy = policyPath ? JSON.parse(await readFile(resolve(policyPath), "utf8")) : undefined;
  console.log(JSON.stringify(evaluateProductCases(cases, { policy }), null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
