import test from "node:test";
import assert from "node:assert/strict";
import { compileProductEvidence, assessProductEvidence } from "../src/engine/product-evidence.js";
import { canonicalKey } from "../src/engine/product-identity.js";
import { rankProductCandidates, allocateProductCandidates } from "../src/product-ranking.js";
import { searchProductsForIdeas, getCachedProduct } from "../src/product-search.js";
import { validateAwinProduct } from "../src/providers/awin.js";
import { evaluateProductCases } from "../scripts/evaluate-products.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const idea = { title: "Coffee grinder", concept: "coffee grinder", query: "coffee grinder", productSpec: {} };
const product = (id = "B000000001", extra = {}) => ({
  provider: "amazon", productId: id, title: "Coffee grinder",
  imageUrl: "https://m.media-amazon.com/images/I/grinder.jpg",
  price: { amount: 25, currency: "GBP" }, availability: "IN_STOCK", condition: "NEW",
  ...extra,
});
const record = (extra = {}) => ({
  key: "amazon:B000000002", scope: "coffee grinder", criterion: "performance",
  kind: "independent-test", value: 0.9, reviewed: true, permission: "permitted",
  sourceUrl: "https://lab.example/review/grinder", methodologyUrl: "https://lab.example/methods/grinders",
  sourceGroup: "example-lab",
  observedAt: "2026-11-01T00:00:00Z", expiresAt: "2026-12-01T00:00:00Z", ...extra,
});
const policy = (assessments = [], exclusions = []) => ({ version: "product-evidence-v1", assessments, exclusions });
const evidence = (assessments = [], exclusions = []) => compileProductEvidence(policy(assessments, exclusions), NOW);
const rank = (products, assessments = [], exclusions = []) =>
  rankProductCandidates(idea, products, { evidence: evidence(assessments, exclusions) });

test("cold-start ranking is deterministic, neutral about missing evidence, and commission-independent", () => {
  const a = product(), b = product("B000000002");
  assert.deepEqual(rank([a, b]), rank([b, a]));
  const result = rank([b, { ...a, commission: 0.99, bestseller: true, marketingQuality: 100 }]);
  assert.equal(result[0].productId, a.productId);
  assert.equal(result[0].ranking.qualityScore, 0.5);
  assert.equal(result[0].ranking.evidenceCoverage, 0);
  assert.deepEqual(result[0].ranking.reasons, ["quality_unassessed"]);
  assert.equal(result[0].ranking.score, result[0].matchScore);
});

test("reviewed independent evidence breaks relevance ties but cannot bypass hard constraints", () => {
  assert.equal(rank([product(), product("B000000002")], [record()])[0].productId, "B000000002");
  for (const patch of [
    { title: "Coffee grinder replacement case" }, { condition: "USED" },
    { availability: "OUT_OF_STOCK" }, { price: { amount: 500, currency: "GBP" } },
  ]) {
    const constrained = { ...idea, productSpec: { maxPriceGbp: 30, budgetMaxGbp: 30 } };
    const found = rankProductCandidates(constrained, [product("B000000002", patch)], { evidence: evidence([record()]) });
    assert.equal(found.length, 0, JSON.stringify(patch));
  }
});

test("evidence is identity- and comparison-scope-specific, stale evidence is explicit", () => {
  const compiled = evidence([record()]);
  assert.equal(assessProductEvidence(idea, product(), compiled).evidenceCoverage, 0);
  assert.equal(assessProductEvidence({ concept: "espresso machine" }, product("B000000002"), compiled).evidenceCoverage, 0);
  const expired = record({ expiresAt: "2026-11-05T00:00:00Z" });
  const result = assessProductEvidence(idea, product("B000000002"), evidence([expired]));
  assert.equal(result.qualityScore, 0.5);
  assert.ok(result.reasons.includes("expired_evidence_ignored"));
});

test("policy rejects unsupported, unreviewed, unlicensed, malformed and future evidence", () => {
  for (const patch of [
    { key: "gtin:123" }, { reviewed: false }, { permission: "unknown" }, { kind: "seller-feedback" },
    { value: "0.9" }, { value: 1.01 }, { criterion: "commission" }, { sourceGroup: "" },
    { sourceUrl: "http://lab.example/test" }, { methodologyUrl: "invalid" },
    { scope: "" }, { observedAt: "2027-01-01" }, { expiresAt: "2030-01-01" },
  ]) assert.throws(() => evidence([record(patch)]), /Invalid product evidence/);
  assert.throws(() => compileProductEvidence({ version: "bad" }), /Invalid product evidence policy/);
  assert.throws(() => evidence([], [{ key: "amazon:B000000001", reviewed: false }]), /safety exclusion/);
  assert.throws(() => evidence([record(), record({ value: 0.1 })]), /duplicate source observation/);
});

test("review aggregates shrink small samples, saturate volume and never become seller quality", () => {
  const review = (count, average = 5) => record({
    criterion: "reviews", kind: "product-reviews", average, count,
  });
  const assess = (records) => assessProductEvidence(idea, product("B000000002"), evidence(records));
  assert.ok(assess([review(1)]).qualityScore < assess([review(100)]).qualityScore);
  assert.equal(assess([review(1000)]).qualityScore, assess([review(100000)]).qualityScore);
  assert.equal(assess([review(100, 3)]).qualityScore, 0.5);
  for (const count of [0, -1, 1.5, Infinity, "100"]) {
    assert.throws(() => evidence([review(count)]), /measurement/);
  }
  assert.equal(rank([product("B000000002", { seller: { feedbackPercentage: "100", feedbackScore: 99999 } })])[0]
    .ranking.evidenceCoverage, 0);
});

test("syndicated sources within an ownership group count once per criterion, latest evidence wins", () => {
  const original = record({ value: 0.1 });
  const newer = record({ value: 0.9, sourceUrl: "https://sister.example/test", observedAt: "2026-11-02T00:00:00Z" });
  const assessment = (records) => assessProductEvidence(idea, product("B000000002"), evidence(records));
  assert.deepEqual(assessment([original, newer]), assessment([newer, original]));
  assert.equal(assessment([original, newer]).sourceCount, 1);
  assert.equal(assessment([original, newer]).criteria.performance, 0.9);
  assert.equal(assessment([original, newer]).evidenceCoverage, 0.3);
});

test("known safety exclusions cannot be overcome by price, reviews or evidence expiry", () => {
  const exclusion = {
    key: "amazon:B000000002", reason: "recall", reviewed: true,
    sourceUrl: "https://www.gov.uk/product-safety-alerts-reports-recalls/example",
    checkedAt: "2025-01-01T00:00:00Z",
  };
  assert.equal(rank([product("B000000002")], [record()], [exclusion]).length, 0);
  const gtinExclusion = { ...exclusion, key: "gtin:00000012345670" };
  assert.equal(rank([product("B000000002", { gtin: "12345670" })], [], [gtinExclusion]).length, 0);
  assert.equal(rank([product("B000000002", { gtin: "12345670" })], [], [exclusion]).length, 0);
});

test("landed price compares only identical products, not unrelated cheap substitutes", () => {
  const a = product("B000000001", { gtin: "12345670", priceIncludesDelivery: true });
  const b = product("B000000002", { gtin: "00000012345670", priceIncludesDelivery: true, price: { amount: 20, currency: "GBP" } });
  assert.equal(rank([a, b])[0].productId, b.productId);
  assert.equal(rank([b, { ...a, price: { amount: 1, currency: "GBP" }, priceIncludesDelivery: false }])[0].productId, b.productId);
  assert.equal(rank([a, { ...b, gtin: undefined, price: { amount: 1, currency: "GBP" } }])[0].productId, a.productId);
});

test("all quality adjustments are bounded and photographs retain the existing selection priority", () => {
  for (const value of [0, 0.5, 1]) {
    const records = ["performance", "usability", "durability", "repairability"].map((criterion) => record({ criterion, value }));
    const ranked = rank([product("B000000002")], records)[0];
    assert.ok(Math.abs(ranked.ranking.score - ranked.matchScore) <= 0.020000001);
  }
  assert.equal(rank([product(), product("B000000002", { imageUrl: null })], [record()])[0].productId, "B000000001");
});

test("allocation backfills collisions instead of silently losing otherwise viable cards", () => {
  const a = product(), b = product("B000000002"), c = product("B000000003");
  const result = allocateProductCandidates([[a, b], [a], [b, c]]);
  assert.deepEqual(result.products.map((item) => item?.productId), [b.productId, a.productId, c.productId]);
  assert.equal(result.duplicates, 0);
  assert.equal(allocateProductCandidates([[a], [a]]).duplicates, 1);
});

test("allocation achieves maximum coverage for every three-by-three candidate graph", () => {
  const candidates = [product(), product("B000000002"), product("B000000003")];
  const maximum = (pools, index = 0, used = new Set()) => {
    if (index === pools.length) return 0;
    let best = maximum(pools, index + 1, used);
    for (const item of pools[index]) {
      const key = canonicalKey(item);
      if (!used.has(key)) best = Math.max(best, 1 + maximum(pools, index + 1, new Set([...used, key])));
    }
    return best;
  };
  for (let mask = 0; mask < 512; mask++) {
    const pools = Array.from({ length: 3 }, (_, row) => candidates.filter((_, column) => mask & (1 << (row * 3 + column))));
    const actual = allocateProductCandidates(pools).products.filter(Boolean);
    assert.equal(actual.length, maximum(pools), `candidate graph ${mask}`);
    assert.equal(new Set(actual.map(canonicalKey)).size, actual.length);
  }
});

test("secondary merchant offers are never reused on another card", () => {
  const a = product(), b = product("B000000002");
  const secondary = product("v1|123456789|0", { provider: "ebay" });
  const result = allocateProductCandidates([[a, secondary], [b, secondary]]);
  const keys = result.offers.flat().map(canonicalKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("product discovery uses all retrieved alternatives and emits audited scores", async () => {
  const provider = {
    name: "amazon", policy: { persistResults: false }, isAvailable: () => true,
    validateProduct: (item) => item,
    searchProducts: async () => [product(), product("B000000002")],
  };
  const result = await searchProductsForIdeas([idea, idea], { PRODUCT_DISCOVERY_ENABLED: "true" }, {
    productProvider: provider, productBudget: { take: async (_ip, count) => count },
  }, "test");
  assert.equal(result.products.filter(Boolean).length, 2);
  assert.ok(result.products.every((item) => item.ranking.version === "product-ranker-v1"));
});

test("Awin delivery totals remain stable over repeated provider and cache validation", () => {
  const url = "https://www.awin1.com/pclick.php?p=grinder&a=123&m=488";
  const env = { AWIN_PUBLISHER_ID: "123", AWIN_ALLOWED_ADVERTISERS: "488" };
  const raw = product("488:grinder", {
    provider: "awin", affiliateUrl: url, merchantProductUrl: "https://shop.example/grinder",
    deliveryIncluded: true, deliveryCost: { amount: 3, currency: "GBP" },
    retrievedAt: new Date(NOW - 1000).toISOString(), expiresAt: new Date(NOW + 100000).toISOString(),
  });
  let current = raw;
  for (let index = 0; index < 5; index++) {
    current = validateAwinProduct(current, env, NOW);
    assert.equal(current.price.amount, 28);
    assert.equal(current.priceIncludesDelivery, true);
  }
});

test("direct product-detail cache reads also respect reviewed safety exclusions", async () => {
  const provider = { name: "amazon", getProduct: async () => product(), validateProduct: (item) => item };
  const deps = {
    productEvidencePolicy: policy([], [{
      key: "amazon:B000000001", reviewed: true, reason: "withdrawal",
      sourceUrl: "https://www.gov.uk/example", checkedAt: "2026-01-01",
    }]),
    cache: { match: async () => Response.json({ products: [product()] }) },
  };
  assert.equal(await getCachedProduct(provider, "B000000001", {}, deps), null);
});

test("duplicate query hits preserve a photographed alternative for the same listing", () => {
  const withPhoto = product(), withoutPhoto = product("B000000001", { imageUrl: null });
  assert.equal(rank([withoutPhoto, withPhoto])[0].imageUrl, withPhoto.imageUrl);
  assert.deepEqual(rank([withoutPhoto, withPhoto]), rank([withPhoto, withoutPhoto]));
});

test("offline product evaluation computes exact graded nDCG and recall without a quality claim", () => {
  const relevance = { "amazon:B000000001": 1, "amazon:B000000002": 3, "amazon:B000000003": 2 };
  const report = evaluateProductCases([{
    id: "graded", idea, products: [product(), product("B000000002")], relevance,
  }], { now: NOW, k: 2 });
  const expected = (1 + 7 / Math.log2(3)) / (7 + 3 / Math.log2(3));
  assert.ok(Math.abs(report.ndcg - expected) < 1e-12);
  assert.equal(report.recall, 2 / 3);
  assert.equal(report.matchCoverage, 1);
  assert.equal(report.evidenceCoverage, 0);
  assert.equal(report.qualityClaim, false);
  const unjudged = evaluateProductCases([{ id: "unjudged", idea, products: [product()] }], { now: NOW });
  assert.equal(unjudged.ndcg, null);
  assert.equal(unjudged.judgedCases, 0);
});

test("offline product evaluation rejects incomplete labels and never double-counts the same GTIN", () => {
  const products = [product("B000000001", { gtin: "12345670" }), product("B000000002", { gtin: "12345670" })];
  const item = { id: "identity", idea, products, relevance: { "gtin:00000012345670": 3 } };
  const report = evaluateProductCases([item], { now: NOW });
  assert.equal(report.results[0].eligibleProducts, 1);
  assert.equal(report.ndcg, 1);
  assert.equal(report.recall, 1);
  assert.throws(() => evaluateProductCases([item, item]), /duplicate case/);
  assert.throws(() => evaluateProductCases([{ ...item, relevance: { other: 1 } }]), /incomplete relevance/);
  assert.throws(() => evaluateProductCases([]), /nonempty/);
});

test("budget constraints reject unknown prices even when only one cap field is provided", () => {
  for (const productSpec of [{ maxPriceGbp: 30 }, { budgetMaxGbp: 30 }]) {
    for (const price of [null, { amount: NaN, currency: "GBP" }, { amount: -1, currency: "GBP" }, { amount: 31, currency: "GBP" }]) {
      assert.equal(rankProductCandidates({ ...idea, productSpec }, [product("B000000001", { price })]).length, 0);
    }
  }
});

test("cached provider offers are reranked under the current evidence, not an old cached score", async () => {
  const cached = [product(), product("B000000002")];
  const provider = {
    name: "amazon", policy: {}, isAvailable: () => true, validateProduct: (item) => item,
    searchProducts: async () => assert.fail("a valid cache hit must not fetch"),
  };
  const deps = {
    productProvider: provider,
    cache: { match: async () => Response.json({ products: cached }) },
  };
  const env = { PRODUCT_DISCOVERY_ENABLED: "true" };
  const before = await searchProductsForIdeas([idea], env, deps, "test");
  assert.equal(before.products[0].productId, "B000000001");
  const assessment = record({
    observedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 100000).toISOString(),
  });
  const after = await searchProductsForIdeas([idea], env, { ...deps, productEvidencePolicy: policy([assessment]) }, "test");
  assert.equal(after.products[0].productId, "B000000002");
  assert.equal(after.products[0].ranking.sourceCount, 1);
});

test("documented offline CLI emits a real report and exits unsuccessfully for invalid input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "product-evaluation-test-"));
  try {
    const path = join(directory, "cases.json");
    const script = fileURLToPath(new URL("../scripts/evaluate-products.mjs", import.meta.url));
    await writeFile(path, JSON.stringify([{ id: "cli", idea, products: [product()] }]));
    const success = spawnSync(process.execPath, [script, path], { encoding: "utf8" });
    assert.equal(success.status, 0, success.stderr);
    const report = JSON.parse(success.stdout);
    assert.equal(report.cases, 1);
    assert.equal(report.matchCoverage, 1);
    assert.equal(report.ndcg, null);
    assert.equal(report.qualityClaim, false);
    await writeFile(path, "[]");
    const invalid = spawnSync(process.execPath, [script, path], { encoding: "utf8" });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /nonempty product cases/);
    assert.equal(invalid.stdout, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
