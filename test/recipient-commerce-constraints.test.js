import test from "node:test";
import assert from "node:assert/strict";
import { deriveRecipient } from "../src/recipient.js";
import { curateIdeas } from "../src/validate.js";
import { scoreProductMatch } from "../src/product-matcher.js";
import { normaliseProductIdea } from "../src/product-validation.js";
import { queryContext, matchingSponsor } from "../site/monetization-data.js";
import { listMetrics } from "../scripts/engine-metrics.js";
import { issueFeedbackReceipts, verifyProductReceipts, RECEIPT_LIFETIME_MS } from "../src/engine/feedback-receipts.js";
import { handleRequest } from "../src/core.js";
import { searchProductsForIdeas } from "../src/product-search.js";
import { ebayPolicy } from "../src/providers/ebay.js";
import { validateOffer } from "../src/offer-validation.js";
import fs from "node:fs";
import { normaliseInput } from "../src/core.js";

const input = (description) => ({ mode: "describe", description, exclude: [] });
const journal = (extra = {}) => ({
  title: "Travel journal", concept: "travel journal", search_query: "travel journal",
  why: "A travel journal for writing notes about trips and places.", category: "Stationery",
  estimated_max_price_gbp: 25, ...extra,
});
const listing = (title, extra = {}) => ({
  provider: "ebay", title, condition: "NEW", availability: "IN_STOCK",
  price: { amount: 20, currency: "GBP" }, ...extra,
});

test("negated budget ceilings remain hard while genuine floors stay uncapped", () => {
  for (const phrase of ["no more than", "nothing over", "not over", "not more than", "nothing more than", "under", "at most"]) {
    const request = input(`My 35 year old friend loves travel. Budget ${phrase} £20.`);
    assert.deepEqual(deriveRecipient(request).budget, { max: 20, soft: false, scope: "unspecified", source: "text" }, phrase);
    assert.equal(curateIdeas({ ideas: [journal()] }, request).ideas.length, 0, phrase);
  }
  for (const phrase of ["over", "above", "at least", "more than", "from", "minimum", "not under", "not below", "no less than"]) {
    assert.equal(deriveRecipient(input(`Travel gifts ${phrase} £20.`)).budget.max, null, phrase);
  }
  assert.equal(deriveRecipient(input("Travel gifts £20 or more.")).budget.max, null);
  assert.equal(deriveRecipient(input("Travel gifts no more than 20 pounds.")).budget.max, 20);
  assert.equal(deriveRecipient(input("Travel gifts under £20–£30.")).budget.max, 30);
});

test("inline exclusions work without treating budget and harmless no-phrases as exclusions", () => {
  for (const clause of [", no leather", " but no leather", "; no leather", ". No leather", " and no leather", ". Please no leather"]) {
    const request = input(`My friend likes notebooks${clause}.`);
    assert.equal(curateIdeas({ ideas: [journal({ title: "Leather travel journal" })] }, request).ideas.length, 0, clause);
  }
  for (const phrase of ["No set budget", "No more than £20", "No preference", "No problem with leather"]) {
    assert.deepEqual(deriveRecipient(input(`My friend likes travel. ${phrase}.`)).avoid, [], phrase);
  }
  for (const phrase of ["He does not dislike leather", "He doesn't hate leather", "He is not allergic to nuts"]) {
    assert.deepEqual(deriveRecipient(input(phrase)).avoid, [], phrase);
  }
});

test("server-derived exclusions survive product normalization and reject contradictory offers", () => {
  const request = input("My 35 year old friend likes travel. No leather. Under 30 pounds.");
  const idea = curateIdeas({ ideas: [journal({ product_spec: { excluded_terms: [] } })] }, request).ideas[0];
  const normal = normaliseProductIdea(idea);
  assert.equal(scoreProductMatch(normal, listing("Leather travel journal")).accepted, false);
  assert.equal(scoreProductMatch(normal, listing("Paper travel journal")).accepted, true);
  assert.equal(scoreProductMatch(normaliseProductIdea({ title: "Travel journal", query: "travel journal" }),
    listing("Paper travel journal")).accepted, true, "legacy ideas remain compatible");
});

test("exclusion overflow abstains instead of silently dropping constraints", () => {
  for (const excludedTerms of [Array.from({ length: 17 }, (_, n) => `item ${n}`), ["a".repeat(81)], "leather", [null]]) {
    const idea = normaliseProductIdea({ title: "Travel journal", query: "travel journal", productSpec: { excludedTerms } });
    assert.equal(scoreProductMatch(idea, listing("Travel journal")).accepted, false);
  }
  assert.equal(scoreProductMatch({ title: "Travel journal", query: "travel journal",
    productSpec: { maxPriceGbp: 150, budgetMaxGbp: 10 } }, listing("Travel journal")).accepted, false);
});

test("complete product search rejects excluded listings and retains suitable alternatives", async () => {
  const idea = curateIdeas({ ideas: [journal()] }, input("My adult friend likes travel. No leather. Under 30 pounds.")).ideas[0];
  const now = Date.now(), policy = ebayPolicy("");
  const offers = ["Leather travel journal", "Paper travel journal"].map((title, n) => {
    const id = `12345678901${n}`, url = `https://www.ebay.co.uk/itm/${id}`;
    return { ...listing(title), productId: `v1|${id}|0`, productUrl: url, affiliateUrl: url,
      retrievedAt: new Date(now).toISOString(), expiresAt: new Date(now + 3500000).toISOString() };
  });
  const result = await searchProductsForIdeas([idea], { PRODUCT_DISCOVERY_ENABLED: "true" }, {
    productBudget: { take: async (_ip, count) => count },
    productProvider: { name: "ebay", policy, isAvailable: () => true,
      validateProduct: (product) => validateOffer(product, policy), searchProducts: async () => offers },
  }, "fixture");
  assert.equal(result.products[0].title, "Paper travel journal");
});

test("issued receipts bind product constraints, identity and budget without storing their text", async () => {
  const env = { IP_SALT: "product-receipt-fixture-salt-0123456789abcdef", RECEIPT_SIGNING_KEY: "unit-test-receipt-key-0123456789abcdef",
    ALLOWED_ORIGINS: "https://gifts.example.test" };
  const now = Date.now();
  const idea = curateIdeas({ ideas: [journal()] }, input("My 35 year old friend likes travel. No leather. Under 30 pounds.")).ideas[0];
  const signed = (await issueFeedbackReceipts([{ ...idea, source: "model" }], env, now))[0];
  assert.equal((await verifyProductReceipts([signed], env, now)).ok, true);
  const payload = JSON.parse(Buffer.from(signed.feedbackToken.split(".")[0], "base64url").toString());
  assert.match(payload.productHash, /^[a-zA-Z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(payload), /leather|Travel journal/);
  for (const modified of [
    { ...signed, title: "Changed journal" },
    { ...signed, query: "changed query" },
    { ...signed, productSpec: { ...signed.productSpec, excludedTerms: [] } },
    { ...signed, productSpec: { ...signed.productSpec, recipientAgeBand: "unknown" } },
    { ...signed, productSpec: { ...signed.productSpec, maxPriceGbp: 150 } },
    { ...signed, productSpec: { ...signed.productSpec, requiredVariants: ["UK 8"] } },
    { ...signed, feedbackToken: "invalid" },
  ]) assert.equal((await verifyProductReceipts([modified], env, now)).ok, false);
  assert.equal((await verifyProductReceipts([signed], env, now + RECEIPT_LIFETIME_MS)).ok, false);
  assert.equal((await verifyProductReceipts([idea], env, now)).ok, false, "unsigned ideas cannot spend the product budget");
  assert.equal((await verifyProductReceipts([signed, idea], env, now)).ok, false, "every idea must be signed");
  const { productHash: _hash, ...oldPayload } = payload;
  const encoded = Buffer.from(JSON.stringify(oldPayload)).toString("base64url");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.IP_SALT),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(`santas-helper:feedback:v1:${encoded}`))).toString("base64url");
  assert.equal((await verifyProductReceipts([{ ...idea, feedbackToken: `${encoded}.${signature}` }], env, now)).ok,
    false, "receipts without a product binding cannot be reused for arbitrary searches");
  let searched = false;
  const request = (value) => new Request(`${env.ALLOWED_ORIGINS}/api/products`, {
    method: "POST", headers: { Origin: env.ALLOWED_ORIGINS, "Content-Type": "application/json" },
    body: JSON.stringify({ ideas: [value] }),
  });
  const response = await handleRequest(request({ ...signed, productSpec: {} }), env, {
    productProvider: { isAvailable: () => { searched = true; return true; } },
  });
  assert.equal(response.status, 400);
  assert.equal(searched, false);
});

test("variant matching retains size systems, units, and single-letter sizes", () => {
  const idea = (variant) => ({ title: "Walking shoes", concept: "walking shoes", query: "walking shoes",
    productSpec: { requiredVariants: [variant] } });
  assert.equal(scoreProductMatch(idea("UK 8"), listing("Walking shoes US 8 UK 6")).accepted, false);
  assert.equal(scoreProductMatch(idea("UK 8"), listing("Walking shoes US 10 UK 8")).accepted, true);
  assert.equal(scoreProductMatch(idea("S"), listing("Walking shoes size S")).accepted, true);
  assert.equal(scoreProductMatch(idea("S"), listing("Walking shoes size M")).accepted, false);
  assert.equal(scoreProductMatch(idea("30 cm"), listing("Walking shoes 30 mm")).accepted, false);
  assert.equal(scoreProductMatch(idea("model X2"), listing("Walking shoes model X3")).accepted, false);
});

test("sponsor parsing shares all supported child-age and explicit-constraint forms", () => {
  const sponsor = { id: "fixture", title: "Travel journal", description: "Trip notes.", sponsorName: "Fixture",
    targetTags: ["general"], imageUrl: "", destinationUrl: "https://www.johnlewis.com/product",
    merchantId: "johnlewis", priceRange: { min: 5, max: 10, currency: "GBP" },
    minBudget: 10, maxBudget: 1000, priorityWeight: 1, active: true, demo: false };
  for (const description of ["For my five-year-old nephew.", "For my nephew, aged 5.", "For my nephew, 5yo.",
    "My adult friend dislikes leather.", "My adult friend hates leather.", "My adult friend already has a journal."]) {
    assert.equal(matchingSponsor([sponsor], queryContext(input(description))), null, description);
  }
});

test("single-strategy entropy is zero rather than NaN", () => {
  const result = listMetrics([{ title: "Travel journal", concept: "travel journal", category: "Stationery",
    strategy: "core-interest" }], input("My 35 year old friend loves travel."));
  assert.equal(result.strategy_balance, 0);
});

test("additive audit cases are valid and do not collide with frozen evaluation identities", () => {
  const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
  const audit = read("../benchmarks/audit-2026/cases.json");
  const existing = read("../benchmarks/v3.4/cases.json");
  assert.equal(audit.length, 24);
  assert.equal(new Set([...existing, ...audit].map((item) => item.id)).size, 74);
  for (const item of audit) {
    assert.equal(normaliseInput(item.input).ok, true, item.id);
    assert.ok(item.evaluation_focus.length > 0, item.id);
  }
});
