import { test } from "node:test";
import assert from "node:assert/strict";
import { createAmazonProvider } from "../src/providers/amazon.js";
import { scoreProductMatch, productMatchThresholds } from "../src/product-matcher.js";
import { isApprovedAmazonImageUrl, isAmazonProductUrl, validateProduct } from "../src/product-validation.js";
import { searchProductsForIdeas } from "../src/product-search.js";

const TAG = "mcstarrstud0c-21";
const ASIN = "B012345678";
const env = {
  PRODUCT_DISCOVERY_ENABLED: "true",
  AMAZON_CREATORS_CLIENT_ID: "test-client",
  AMAZON_CREATORS_CLIENT_SECRET: "test-secret",
  AMAZON_PARTNER_TAG: TAG,
};
const idea = (overrides = {}) => ({
  title: "Felco Japanese pruning shears",
  query: "japanese pruning shears",
  concept: "pruning shears",
  productSpec: {
    requiredFeatures: ["Japanese steel"],
    requiredVariants: [],
    preferredFeatures: ["stainless steel"],
    preferredColour: "red",
    brandPreference: "Felco",
    personalisationRequired: false,
    recipientAgeBand: "adult",
    maxPriceGbp: 25,
    budgetMaxGbp: 25,
  },
  ...overrides,
});
const product = (overrides = {}) => ({
  provider: "amazon",
  productId: ASIN,
  asin: ASIN,
  title: "Felco Japanese pruning shears, red stainless steel",
  brand: "Felco",
  description: "Japanese steel pruning shears with a red handle.",
  imageUrl: "https://m.media-amazon.com/images/I/pruners.jpg",
  additionalImages: ["https://m.media-amazon.com/images/I/pruners-side.jpg"],
  price: { amount: 24.99, currency: "GBP" },
  productUrl: `https://www.amazon.co.uk/dp/${ASIN}?tag=${TAG}`,
  affiliateUrl: `https://www.amazon.co.uk/dp/${ASIN}?tag=${TAG}`,
  availability: "IN_STOCK",
  condition: "NEW",
  retrievedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  ...overrides,
});
const item = (overrides = {}) => ({
  asin: ASIN,
  detailPageURL: `https://www.amazon.co.uk/dp/${ASIN}?tag=${TAG}`,
  images: {
    primary: { large: { url: "https://m.media-amazon.com/images/I/pruners.jpg" } },
    variants: [{ large: { url: "https://m.media-amazon.com/images/I/pruners-side.jpg" } }],
  },
  itemInfo: {
    title: { displayValue: "Felco Japanese pruning shears, red stainless steel" },
    byLineInfo: { brand: { displayValue: "Felco" } },
    features: { displayValues: ["Japanese steel pruning shears with a red handle."] },
  },
  offersV2: {
    listings: [{
      isBuyBoxWinner: true,
      availability: { type: "IN_STOCK" },
      condition: { value: "New" },
      price: { money: { amount: 24.99, currency: "GBP" } },
    }],
  },
  ...overrides,
});
const tokenResponse = () => new Response(JSON.stringify({
  access_token: "unit-test-token",
  token_type: "bearer",
  expires_in: 3600,
}), { status: 200 });

test("cooking listings match product synonyms without accepting conflicting materials or fixed engraving", () => {
  const cooking = (title, query, concept) => ({ title, query, concept, productSpec: {} });
  const listing = (title) => product({ title, description: undefined });
  const cases = [
    [cooking("Knife sharpening stone", "knife sharpening stone", "sharpening stone"), "Knife whetstone double sided", true],
    [cooking("Cookery book", "cookery book", "cookery book"), "Cookbook recipes hardback", true],
    [cooking("Wooden chopping board", "wooden chopping board", "chopping board"), "Bamboo cutting board", true],
    [cooking("Cotton cooking apron", "heavy cotton cooking apron pockets", "apron"), "Polyester Cooking Apron 2 Pockets", false],
    [cooking("Personalised engraved chopping board", "engraved wooden chopping board", "chopping board"), "Funny Engraved Bamboo Chopping Board Off My T*ts", false],
    [cooking("Personalised engraved chopping board", "engraved wooden chopping board", "chopping board"), "Engraved Wooden Chopping Board Fixed Message", false],
    [cooking("Personalised engraved chopping board", "engraved wooden chopping board", "chopping board"), "Personalised Engraved Wooden Chopping Board Your Name", true],
    [cooking("Pasta making kit", "home pasta making kit", "pasta making kit"), "Pasta Making Book", false],
    [cooking("Pasta making kit", "home pasta making kit", "pasta making kit"), "Home Pasta Making Kit", true],
    [cooking("Oil and vinegar set", "cooking oil vinegar set", "oil vinegar set"), "Cooking Oil With Vinegar", false],
  ];
  for (const [idea, title, accepted] of cases) {
    const match = scoreProductMatch(idea, listing(title));
    assert.equal(match.accepted, accepted, `${title}: ${JSON.stringify(match)}`);
  }
});

test("exact product match receives high confidence and a transparent score", () => {
  const result = scoreProductMatch(idea(), product());
  assert.equal(result.confidence, "high");
  assert.equal(result.accepted, true);
  assert.equal(result.matchScore, 1);
});

test("wrong product type is rejected even when other terms overlap", () => {
  const result = scoreProductMatch(idea(), product({
    title: "Felco red gardening gloves",
    description: "Japanese steel pruning shears are shown in the background.",
  }));
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("wrong_product_type"));
});

test("wrong colour is rejected when a colour was explicitly preferred", () => {
  const result = scoreProductMatch(idea(), product({ title: "Felco Japanese pruning shears, blue" }));
  assert.ok(result.reasons.includes("colour_mismatch"));
});

test("wrong size, model, and edition variants are rejected even when the product type matches", () => {
  const variantIdea = idea({
    title: "8 inch Felco pruning shears edition 2",
    query: "felco pruning shears",
    concept: "pruning shears",
    productSpec: {
      requiredVariants: ["8 inch", "edition 2"],
      maxPriceGbp: null,
      budgetMaxGbp: null,
    },
  });
  const result = scoreProductMatch(variantIdea, product({
    title: "Felco pruning shears 6 inch edition 1",
  }));
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("variant_mismatch"));
});

test("a related accessory is not accepted as the recommended product", () => {
  for (const title of [
    "Felco pruning shears protective case",
    "Felco pruning shears sharpening brush",
  ]) {
    const result = scoreProductMatch(idea(), product({
      title,
      description: "An accessory for Japanese pruning shears.",
    }));
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.includes("wrong_product_type"));
  }
});

test("a requested brand is a hard match criterion", () => {
  const result = scoreProductMatch(idea(), product({ brand: "Other", title: "Other Japanese pruning shears, red" }));
  assert.ok(result.reasons.includes("brand_mismatch"));
});

test("a required personalised product is rejected when the listing does not offer personalisation", () => {
  const wallet = idea({
    title: "Personalised leather wallet",
    query: "personalised leather wallet engraved",
    concept: "leather wallet",
    productSpec: { personalisationRequired: true, maxPriceGbp: 30, budgetMaxGbp: 30 },
  });
  const result = scoreProductMatch(wallet, product({
    title: "Leather wallet",
    description: "A brown leather wallet with card slots.",
  }));
  assert.ok(result.reasons.includes("personalisation_missing"));
});

test("a product outside the shopper budget is rejected", () => {
  const result = scoreProductMatch(idea(), product({ price: { amount: 70, currency: "GBP" } }));
  assert.ok(result.reasons.includes("over_budget"));
  assert.equal(scoreProductMatch(idea(), product({ price: { amount: 25, currency: "GBP" } })).accepted, true);
});

test("unknown, unavailable, preorder, and used listings are rejected conservatively", () => {
  for (const availability of ["UNKNOWN", "OUT_OF_STOCK", "UNAVAILABLE", "PREORDER"]) {
    const result = scoreProductMatch(idea(), product({ availability }));
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.includes("availability_unverified_or_not_in_stock"));
  }
  const used = scoreProductMatch(idea(), product({ condition: "USED" }));
  assert.equal(used.accepted, false);
  assert.ok(used.reasons.includes("condition_unverified_or_not_new"));
});

test("a child listing is rejected for a known adult recipient", () => {
  const result = scoreProductMatch(idea(), product({ title: "Felco Japanese pruning shears for children" }));
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("recipient_age_mismatch"));
});

test("missing product descriptions are handled using available listing fields", () => {
  const result = scoreProductMatch(idea(), product({ description: undefined }));
  assert.equal(result.confidence, "high");
  assert.equal(result.accepted, true);
});

test("missing images do not corrupt an otherwise verified product", () => {
  const validated = validateProduct(product({ imageUrl: "https://unapproved.example/image.jpg" }), { partnerTag: TAG });
  assert.equal(validated.imageUrl, null);
});

test("missing prices cannot satisfy a stated shopper budget", () => {
  const result = scoreProductMatch(idea(), product({ price: null }));
  assert.ok(result.reasons.includes("price_unverified_with_budget"));
});

test("confidence thresholds can be configured and medium matches are not accepted as exact", () => {
  const partial = idea({
    productSpec: {
      preferredFeatures: ["ratchet mechanism", "ergonomic grip"],
      preferredColour: "green",
      maxPriceGbp: null,
      budgetMaxGbp: null,
    },
  });
  const scored = scoreProductMatch(partial, product());
  assert.equal(scored.confidence, "medium");
  assert.equal(scored.accepted, false);
  assert.deepEqual(productMatchThresholds({ PRODUCT_MATCH_HIGH_THRESHOLD: "0.9", PRODUCT_MATCH_MEDIUM_THRESHOLD: "0.4" }), {
    high: 0.9,
    medium: 0.4,
  });
});

test("representative Amazon-style candidates report conservative scores and reasons", () => {
  const cases = [
    { name: "exact new in-stock product", candidate: product(), accepted: true },
    { name: "wrong colour", candidate: product({ title: "Felco Japanese pruning shears blue stainless steel" }), accepted: false },
    { name: "wrong type", candidate: product({ title: "Felco gardening gloves" }), accepted: false },
    {
      name: "wrong variant",
      idea: { productSpec: { requiredVariants: ["model 8"], maxPriceGbp: null, budgetMaxGbp: null } },
      candidate: product({ title: "Felco Japanese pruning shears model 6" }),
      accepted: false,
    },
    { name: "over budget", candidate: product({ price: { amount: 70, currency: "GBP" } }), accepted: false },
    { name: "unknown availability", candidate: product({ availability: "UNKNOWN" }), accepted: false },
  ];
  const decisions = cases.map(({ name, idea: overrides, candidate, accepted }) => {
    const match = scoreProductMatch(idea(overrides), candidate);
    assert.equal(match.accepted, accepted, name);
    return { name, accepted: match.accepted, score: match.matchScore, reasons: match.reasons };
  });
  assert.equal(decisions[0].score, 1);
});

test("Amazon image and affiliate URLs are restricted to official matching destinations", () => {
  assert.equal(isApprovedAmazonImageUrl("https://m.media-amazon.com/images/I/x.jpg"), true);
  assert.equal(isApprovedAmazonImageUrl("https://images.evil.example/x.jpg"), false);
  assert.equal(isAmazonProductUrl(`https://www.amazon.co.uk/dp/${ASIN}?tag=${TAG}`, ASIN, TAG), true);
  assert.equal(isAmazonProductUrl(`https://www.amazon.co.uk/dp/${ASIN}?tag=other-21`, ASIN, TAG), false);
  assert.equal(isAmazonProductUrl(`https://www.amazon.co.uk/dp/${ASIN}`, "B000000000", TAG), false);
});

test("Creators API search returns normalized title, image, price and the exact vended destination", async () => {
  const requests = [];
  const provider = createAmazonProvider(env, async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url) === "https://api.amazon.co.uk/auth/o2/token") return tokenResponse();
    return new Response(JSON.stringify({ searchResult: { items: [item()] } }), { status: 200 });
  });
  const [found] = await provider.searchProducts("japanese pruning shears");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://api.amazon.co.uk/auth/o2/token");
  assert.equal(requests[1].url, "https://creatorsapi.amazon/catalog/v1/searchItems");
  assert.equal(requests[1].init.headers.Authorization, "Bearer unit-test-token");
  assert.equal(requests[1].init.headers["x-marketplace"], "www.amazon.co.uk");
  const body = JSON.parse(requests[1].init.body);
  assert.equal(body.keywords, "japanese pruning shears");
  assert.equal(body.partnerTag, TAG);
  assert.equal(body.availability, "Available");
  assert.equal(body.condition, "New");
  assert.ok(body.resources.includes("images.primary.large"));
  assert.ok(body.resources.includes("offersV2.listings.condition"));
  assert.ok(body.resources.includes("offersV2.listings.price"));
  assert.equal(found.title, "Felco Japanese pruning shears, red stainless steel");
  assert.equal(found.imageUrl, "https://m.media-amazon.com/images/I/pruners.jpg");
  assert.deepEqual(found.price, { amount: 24.99, currency: "GBP" });
  assert.equal(found.productUrl, found.affiliateUrl);
});

test("each returned product image remains paired with its own ASIN destination", async () => {
  const secondAsin = "B098765432";
  const second = item({
    asin: secondAsin,
    detailPageURL: `https://www.amazon.co.uk/dp/${secondAsin}?tag=${TAG}`,
    images: { primary: { large: { url: "https://m.media-amazon.com/images/I/second.jpg" } } },
    itemInfo: {
      title: { displayValue: "Felco Japanese pruning shears, red stainless steel" },
      byLineInfo: { brand: { displayValue: "Felco" } },
      features: { displayValues: ["Japanese steel pruning shears with a red handle."] },
    },
  });
  const provider = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "paired-image-client" }, async (url) => String(url).includes("/auth/")
    ? tokenResponse()
    : new Response(JSON.stringify({ searchResult: { items: [item(), second] } }), { status: 200 }));
  const products = await provider.searchProducts("japanese pruning shears");
  assert.equal(products.length, 2);
  for (const found of products) {
    const linkedAsin = new URL(found.productUrl).pathname.split("/")[2];
    assert.equal(linkedAsin, found.asin);
  }
  assert.equal(products[0].imageUrl, "https://m.media-amazon.com/images/I/pruners.jpg");
  assert.equal(products[1].imageUrl, "https://m.media-amazon.com/images/I/second.jpg");
});

test("GetItems retrieves a product by ASIN and malformed IDs do not trigger requests", async () => {
  const requests = [];
  const provider = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "get-items-client" }, async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url) === "https://api.amazon.co.uk/auth/o2/token") return tokenResponse();
    return new Response(JSON.stringify({ itemsResult: { items: [item()] } }), { status: 200 });
  });
  assert.equal(await provider.getProduct("not-an-asin"), null);
  assert.equal(requests.length, 0);
  const found = await provider.getProduct(ASIN);
  assert.equal(found.asin, ASIN);
  assert.ok(requests[1].url.endsWith("/getItems"));
  assert.deepEqual(JSON.parse(requests[1].init.body).itemIds, [ASIN]);
});

test("invalid Creators API credentials fail explicitly without exposing response bodies", async () => {
  const provider = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "invalid-credential-client" }, async () => new Response("credential details", { status: 401 }));
  await assert.rejects(provider.searchProducts("pruning shears"), (error) => {
    assert.equal(error.code, "token_rejected");
    assert.equal(error.status, 401);
    assert.equal(error.message, "token_rejected");
    return true;
  });
});

test("an expired API token is refreshed once after a 401 response", async () => {
  let tokenRequests = 0;
  const apiTokens = [];
  const provider = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "expired-token-client" }, async (url, init) => {
    if (String(url).includes("/auth/")) {
      tokenRequests++;
      return new Response(JSON.stringify({
        access_token: `token-${tokenRequests}`,
        token_type: "bearer",
        expires_in: 3600,
      }), { status: 200 });
    }
    apiTokens.push(init.headers.Authorization);
    if (apiTokens.length === 1) return new Response("", { status: 401 });
    return new Response(JSON.stringify({ searchResult: { items: [item()] } }), { status: 200 });
  });
  const [found] = await provider.searchProducts("japanese pruning shears");
  assert.equal(tokenRequests, 2);
  assert.deepEqual(apiTokens, ["Bearer token-1", "Bearer token-2"]);
  assert.equal(found.asin, ASIN);
});

test("API throttling is surfaced as rate limiting", async () => {
  const provider = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "throttled-client" }, async (url) => String(url).includes("/auth/")
    ? tokenResponse()
    : new Response("too many requests", { status: 429 }));
  await assert.rejects(provider.searchProducts("pruning shears"), (error) => {
    assert.equal(error.code, "rate_limited");
    assert.equal(error.status, 429);
    return true;
  });
});

test("provider error payloads and malformed API responses are rejected", async () => {
  const provider = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "api-error-payload-client" }, async (url) => String(url).includes("/auth/")
    ? tokenResponse()
    : new Response(JSON.stringify({ errors: [{ code: "Unavailable" }], searchResult: { items: [] } }), { status: 200 }));
  await assert.rejects(provider.searchProducts("pruning shears"), (error) => error.code === "api_response_error");
});

test("network timeouts and malformed provider responses are reported by type", async () => {
  const timedOut = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "timeout-client" }, async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); });
  await assert.rejects(timedOut.searchProducts("pruning shears"), (error) => error.code === "token_timeout");
  const malformed = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "malformed-client" }, async (url) => String(url).includes("/auth/")
    ? tokenResponse()
    : new Response(JSON.stringify({ searchResult: { items: "not-an-array" } }), { status: 200 }));
  await assert.rejects(malformed.searchProducts("pruning shears"), (error) => error.code === "malformed_search_response");
});

test("missing optional fields remain absent and expired Amazon image URLs are rejected", async () => {
  const noOptionalFields = item({
    images: null,
    offersV2: null,
    itemInfo: { title: { displayValue: "Japanese pruning shears" } },
  });
  const provider = createAmazonProvider({ ...env, AMAZON_CREATORS_CLIENT_ID: "optional-fields-client" }, async (url) => String(url).includes("/auth/")
    ? tokenResponse()
    : new Response(JSON.stringify({ searchResult: { items: [noOptionalFields] } }), { status: 200 }));
  const [found] = await provider.searchProducts("japanese pruning shears");
  assert.equal(found.price, null);
  assert.equal(found.imageUrl, null);
  assert.equal(found.availability, "UNKNOWN");
  assert.equal(validateProduct({ ...found, retrievedAt: new Date(Date.now() - 3601_000).toISOString() }, { partnerTag: TAG }), null);
});

test("duplicate primary queries are fetched and reserved once for concurrent ideas", async () => {
  const calls = [];
  const reservations = [];
  const store = new Map();
  const cache = {
    match: async (request) => store.has(request.url) ? new Response(store.get(request.url)) : undefined,
    put: async (request, response) => { store.set(request.url, await response.text()); },
  };
  const searchIdea = idea({ productSpec: { maxPriceGbp: null, budgetMaxGbp: null } });
  const result = await searchProductsForIdeas([searchIdea, searchIdea], env, {
    cache,
    productBudget: { take: async (_ip, count) => { reservations.push(count); return count; } },
    waitUntil: (promise) => promise,
    fetch: async (url) => {
      calls.push(String(url));
      if (String(url).includes("/auth/")) return tokenResponse();
      return new Response(JSON.stringify({ searchResult: { items: [item()] } }), { status: 200 });
    },
  }, "visitor");
  assert.equal(result.products.length, 2);
  assert.equal(result.products[0]?.asin, ASIN);
  assert.equal(result.products[1], null, "the same listing is never shown on two cards");
  assert.equal(result.duplicates_removed, 1);
  assert.equal(calls.filter((url) => url.endsWith("/searchItems")).length, 1);
  assert.deepEqual(reservations, [1]);
});

test("weak primary results trigger one budgeted alternative product query", async () => {
  const queries = [];
  const reservations = [];
  const wrongItem = item({
    itemInfo: {
      title: { displayValue: "Felco gardening gloves" },
      byLineInfo: { brand: { displayValue: "Felco" } },
      features: { displayValues: ["Red protective gloves"] },
    },
  });
  const result = await searchProductsForIdeas([idea()], env, {
    productBudget: { take: async (_ip, count) => { reservations.push(count); return count; } },
    fetch: async (url, init) => {
      if (String(url).includes("/auth/")) return tokenResponse();
      const { keywords } = JSON.parse(init.body);
      queries.push(keywords);
      return new Response(JSON.stringify({
        searchResult: { items: [keywords === "japanese pruning shears" ? wrongItem : item()] },
      }), { status: 200 });
    },
  }, "visitor");
  assert.deepEqual(queries, ["japanese pruning shears", "felco japanese pruning shears"]);
  assert.deepEqual(reservations, [1, 1]);
  assert.equal(result.products[0]?.asin, ASIN);
});

test("search cache hits skip API calls and stale product cache entries are refreshed", async () => {
  const store = new Map();
  const pendingWrites = [];
  const cache = {
    match: async (request) => store.has(request.url) ? new Response(store.get(request.url)) : undefined,
    put: async (request, response) => { store.set(request.url, await response.text()); },
  };
  let searches = 0;
  const deps = {
    cache,
    productBudget: { take: async (_ip, count) => count },
    waitUntil: (promise) => { pendingWrites.push(promise); },
    fetch: async (url) => {
      if (String(url).includes("/auth/")) return tokenResponse();
      searches++;
      return new Response(JSON.stringify({ searchResult: { items: [item()] } }), { status: 200 });
    },
  };
  const searchIdea = idea({ title: "Japanese pruning shears", productSpec: { maxPriceGbp: null, budgetMaxGbp: null } });
  await searchProductsForIdeas([searchIdea], env, deps, "visitor");
  await Promise.all(pendingWrites.splice(0));
  await searchProductsForIdeas([searchIdea], env, deps, "visitor");
  assert.equal(searches, 1);

  const productKey = [...store.keys()].find((key) => key.includes("/product/v1/"));
  const stale = JSON.parse(store.get(productKey));
  stale.products[0].retrievedAt = new Date(Date.now() - 3601_000).toISOString();
  store.set(productKey, JSON.stringify(stale));
  await searchProductsForIdeas([searchIdea], env, deps, "visitor");
  await Promise.all(pendingWrites.splice(0));
  assert.equal(searches, 2);
});

test("provider rate limits and no suitable candidate return placeholders, not invented products", async () => {
  let requests = 0;
  const limited = await searchProductsForIdeas([idea()], env, {
    productBudget: { take: async () => 0 },
    fetch: async () => { requests++; return tokenResponse(); },
  }, "visitor");
  assert.equal(limited.limited, true);
  assert.deepEqual(limited.products, [null]);
  assert.equal(requests, 0);

  const rejected = await searchProductsForIdeas([idea()], env, {
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => String(url).includes("/auth/")
      ? tokenResponse()
      : new Response(JSON.stringify({ searchResult: { items: [item({ itemInfo: { title: { displayValue: "A blue ceramic mug" } } })] } }), { status: 200 }),
  }, "visitor");
  assert.deepEqual(rejected.products, [null]);
});

test("Amazon provider failure returns null product matches without failing enrichment", async () => {
  const rejected = await searchProductsForIdeas([idea()], env, {
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => String(url).includes("/auth/")
      ? tokenResponse()
      : new Response("too many requests", { status: 429 }),
  }, "visitor");
  assert.equal(rejected.enabled, true);
  assert.deepEqual(rejected.products, [null]);
});
