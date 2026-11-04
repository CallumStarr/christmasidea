import test from "node:test";
import assert from "node:assert/strict";
import { createEbayProvider, normaliseEbayItem, isEbayProductUrl } from "../src/providers/ebay.js";
import { productDiscoveryAvailable, searchProductsForIdeas } from "../src/product-search.js";
import { assignUniqueProducts } from "../src/engine/product-identity.js";
import { amazonUrl, ebayUrl, validProduct, validProductImage } from "../site/merchant-links.js";
import { fetchProducts } from "../site/api.js";
import { handleRequest } from "../src/core.js";

const env = {
  PRODUCT_DISCOVERY_ENABLED: "true",
  EBAY_PRODUCT_DISCOVERY_ENABLED: "true",
  AMAZON_PRODUCT_DISCOVERY_ENABLED: "false",
  EBAY_CLIENT_ID: "ebay-test-client",
  EBAY_CLIENT_SECRET: "test-secret",
  EBAY_CAMPAIGN_ID: "1234567890",
};
const config = { EBAY_CAMPAIGN_ID: env.EBAY_CAMPAIGN_ID, AMAZON_TAG: "test-21" };
const id = "v1|123456789012|0";
const now = Date.now();
const item = (overrides = {}) => ({
  itemId: id,
  title: "Ceramic coffee mug",
  image: { imageUrl: "https://i.ebayimg.com/images/g/test/s-l500.jpg" },
  price: { value: "12.00", currency: "GBP" },
  shippingOptions: [{ shippingCost: { value: "2.50", currency: "GBP" } }],
  conditionId: "1000",
  buyingOptions: ["FIXED_PRICE"],
  itemAffiliateWebUrl: "https://www.ebay.co.uk/itm/123456789012?campid=1234567890&mkcid=1&mkevt=1",
  itemEndDate: new Date(now + 7200_000).toISOString(),
  ...overrides,
});
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const token = () => response({ access_token: "test-token", token_type: "bearer", expires_in: 7200 });
const idea = { title: "Ceramic coffee mug", query: "ceramic coffee mug", concept: "coffee mug", productSpec: { maxPriceGbp: 20, budgetMaxGbp: 20 } };

test("eBay requires its own opt-in, credentials and campaign independently of Amazon", () => {
  assert.equal(productDiscoveryAvailable(env), true);
  for (const patch of [
    { PRODUCT_DISCOVERY_ENABLED: "false" }, { EBAY_PRODUCT_DISCOVERY_ENABLED: "false" },
    { EBAY_CLIENT_ID: "" }, { EBAY_CLIENT_SECRET: "" }, { EBAY_CAMPAIGN_ID: "" },
  ]) {
    assert.equal(productDiscoveryAvailable({ ...env, ...patch }), false);
  }
});

test("eBay normalisation binds the listing, image and campaign and includes delivery", () => {
  const product = normaliseEbayItem(item(), env, now);
  assert.equal(product.productId, id);
  assert.equal(product.price.amount, 14.5);
  assert.equal(product.condition, "NEW");
  assert.equal(product.availability, "IN_STOCK");
  assert.equal(validProduct(product, config, now), true);
  assert.equal(validProductImage(product.imageUrl, "ebay"), true);
  assert.equal(validProductImage(product.imageUrl, "amazon"), false);
  assert.equal(normaliseEbayItem(item({ itemEndDate: new Date(now + 60000).toISOString() }), env, now).expiresAt,
    new Date(now + 60000).toISOString());
  for (const patch of [
    { conditionId: "3000" }, { buyingOptions: ["AUCTION"] }, { itemId: "invalid" },
    { itemEndDate: new Date(now - 1).toISOString() },
    { itemEndDate: "invalid" },
    { itemAffiliateWebUrl: "https://www.ebay.co.uk/itm/123456789013?campid=1234567890&mkcid=1&mkevt=1" },
    { itemAffiliateWebUrl: "https://www.ebay.co.uk/itm/123456789012?campid=999&mkcid=1&mkevt=1" },
  ]) {
    assert.equal(normaliseEbayItem(item(patch), env, now), null, JSON.stringify(patch));
  }
  assert.equal(normaliseEbayItem(item({ image: { imageUrl: "https://evil.example/photo.jpg" } }), env, now).imageUrl, null);
});

test("listing variants and URL authority are checked on both server and browser", () => {
  const variant = "v1|123456789012|987654321";
  const url = `${item().itemAffiliateWebUrl}&var=987654321`;
  assert.equal(isEbayProductUrl(url, variant, env.EBAY_CAMPAIGN_ID), true);
  assert.equal(isEbayProductUrl(item().itemAffiliateWebUrl, variant, env.EBAY_CAMPAIGN_ID), false);
  const product = normaliseEbayItem(item(), env, now);
  for (const url of [
    item().itemAffiliateWebUrl.replace("www.ebay.co.uk", "www.ebay.co.uk.evil.example"),
    item().itemAffiliateWebUrl.replace("https:", "http:"),
    item().itemAffiliateWebUrl.replace("https://", "https://user@"),
    item().itemAffiliateWebUrl.replace("/itm/", ":8443/itm/"),
  ]) {
    assert.equal(isEbayProductUrl(url, id, env.EBAY_CAMPAIGN_ID), false);
    assert.equal(validProduct({ ...product, productUrl: url, affiliateUrl: url }, config, now), false);
  }
  assert.equal(validProduct({ ...product, expiresAt: new Date(now - 1).toISOString() }, config, now), false);
  assert.equal(validProductImage("https://user@i.ebayimg.com/a.jpg", "ebay"), false);
});

test("searches use OAuth, GB marketplace, EPN campaign and new fixed-price UK filters", async () => {
  const calls = [];
  const provider = createEbayProvider({ ...env, EBAY_CLIENT_ID: "request-test" }, async (url, init) => {
    calls.push({ url: String(url), init });
    return String(url).includes("/oauth2/") ? token() : response({ itemSummaries: [item()] });
  });
  const products = await provider.searchProducts("coffee mug");
  assert.equal(products.length, 1);
  assert.match(calls[0].init.headers.Authorization, /^Basic /);
  assert.equal(new URLSearchParams(calls[0].init.body).get("grant_type"), "client_credentials");
  const search = calls[1];
  assert.equal(search.init.headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_GB");
  assert.equal(search.init.headers["X-EBAY-C-ENDUSERCTX"], "affiliateCampaignId=1234567890");
  assert.equal(search.init.headers.Authorization, "Bearer test-token");
  assert.match(new URL(search.url).searchParams.get("filter"), /conditions:\{NEW\}.*FIXED_PRICE.*deliveryCountry:GB.*itemLocationCountry:GB/);
  assert.equal(new URL(search.url).searchParams.get("q"), "coffee mug");
});

test("expired tokens retry once; malformed and failed API responses surface errors", async () => {
  let tokens = 0, searches = 0;
  const provider = createEbayProvider({ ...env, EBAY_CLIENT_ID: "retry-test" }, async (url) => {
    if (String(url).includes("/oauth2/")) { tokens++; return token(); }
    searches++;
    return searches === 1 ? response({}, 401) : response({ total: 0 });
  });
  assert.deepEqual(await provider.searchProducts("mug"), []);
  assert.equal(tokens, 2);
  for (const [name, result] of [
    ["forbidden", () => response({}, 403)],
    ["malformed", () => new Response("not json")],
    ["missing-items", () => response({ total: 2 })],
    ["api-error", () => response({ errors: [{ errorId: 1 }] })],
  ]) {
    const failing = createEbayProvider({ ...env, EBAY_CLIENT_ID: name }, async (url) =>
      String(url).includes("/oauth2/") ? token() : result());
    await assert.rejects(() => failing.searchProducts("mug"), { name: "EbayProviderError" });
  }
});

test("eBay matching rejects unknown delivery costs for a budget and removes duplicate listings", async () => {
  const deps = {
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => String(url).includes("/oauth2/") ? token() : response({ itemSummaries: [item()] }),
  };
  const result = await searchProductsForIdeas([idea, idea], env, deps, "visitor");
  assert.equal(result.products[0]?.provider, "ebay");
  assert.equal(result.products[1], null);
  assert.equal(result.duplicates_removed, 1);
  assert.equal(assignUniqueProducts([normaliseEbayItem(item(), env, now), normaliseEbayItem(item(), env, now)]).duplicates, 1);
  const unknown = await searchProductsForIdeas([idea], env, {
    ...deps,
    fetch: async (url) => String(url).includes("/oauth2/") ? token() : response({ itemSummaries: [item({ shippingOptions: [] })] }),
  }, "visitor");
  assert.equal(unknown.products[0], null);
});

test("both providers enrich the same concept independently and failures retain the other offer", async () => {
  const both = {
    ...env, AMAZON_PRODUCT_DISCOVERY_ENABLED: "true",
    AMAZON_CREATORS_CLIENT_ID: "both-test", AMAZON_CREATORS_CLIENT_SECRET: "test-secret", AMAZON_PARTNER_TAG: "test-21",
  };
  const amazonItem = {
    asin: "B012345678", detailPageURL: "https://www.amazon.co.uk/dp/B012345678?tag=test-21",
    itemInfo: { title: { displayValue: "Ceramic coffee mug" } },
    offersV2: { listings: [{ condition: { value: "New" }, availability: { type: "IN_STOCK" }, price: { money: { amount: 10, currency: "GBP" } } }] },
  };
  for (const failEbay of [false, true]) {
    const result = await searchProductsForIdeas([idea], both, {
      productBudget: { take: async (_ip, count) => count },
      fetch: async (url) => {
        if (String(url).includes("/oauth2/") || String(url).includes("/auth/")) return token();
        if (String(url).includes("api.ebay.com")) return failEbay ? response({}, 403) : response({ itemSummaries: [item()] });
        return response({ searchResult: { items: [amazonItem] } });
      },
    }, "visitor");
    assert.deepEqual(result.offers[0].map((offer) => offer.provider), failEbay ? ["amazon"] : ["amazon", "ebay"]);
    assert.equal(result.unavailable, failEbay);
    assert.equal(result.products[0].provider, "amazon");
  }
});

test("eBay cache hits avoid requests and different campaigns never share cached affiliate links", async () => {
  const store = new Map(), pending = [];
  let requests = 0;
  const deps = {
    cache: {
      match: async (key) => store.has(key.url) ? response(store.get(key.url)) : undefined,
      put: async (key, value) => { store.set(key.url, await value.json()); },
    },
    waitUntil: (promise) => pending.push(promise),
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => {
      if (String(url).includes("/oauth2/")) return token();
      requests++;
      return response({ itemSummaries: [item()] });
    },
  };
  await searchProductsForIdeas([idea], env, deps, "visitor");
  await Promise.all(pending);
  await searchProductsForIdeas([idea], env, deps, "visitor");
  assert.equal(requests, 1);
  await searchProductsForIdeas([idea], { ...env, EBAY_CAMPAIGN_ID: "999" }, deps, "visitor");
  assert.ok(requests > 1);
});

test("search links work before approval without inventing eBay affiliate tracking", () => {
  const query = "mug & coffee";
  const untracked = new URL(ebayUrl(query));
  assert.equal(untracked.searchParams.get("_nkw"), query);
  assert.equal(untracked.searchParams.has("campid"), false);
  assert.equal(new URL(ebayUrl(query, config)).searchParams.get("campid"), env.EBAY_CAMPAIGN_ID);
  assert.equal(new URL(amazonUrl(query, config)).searchParams.get("tag"), "test-21");
});

test("frontend preserves multi-merchant offers and partial provider failures", async () => {
  const product = normaliseEbayItem(item(), env, now);
  const result = await fetchProducts([idea], {
    fetchImpl: async () => response({ products: [product], offers: [[product]], unavailable: true, limited: true }),
  });
  assert.equal(result.offers[0][0].provider, "ebay");
  assert.equal(result.unavailable, true);
  assert.equal(result.limited, true);
});

test("the product endpoint returns eBay photos without calling Amazon or requiring AI credentials", async () => {
  const origin = "https://gifts.example.com";
  const request = new Request(`${origin}/api/products`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
    body: JSON.stringify({ ideas: [idea] }),
  });
  const result = await handleRequest(request, {
    ...env, ALLOWED_ORIGINS: origin, IP_SALT: "unit-test-ip-salt-0123456789abcdef",
  }, {
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => {
      assert.equal(new URL(url).hostname, "api.ebay.com");
      return String(url).includes("/oauth2/") ? token() : response({ itemSummaries: [item()] });
    },
  });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.enabled, true);
  assert.equal(body.products[0].provider, "ebay");
  assert.equal(body.products[0].imageUrl, item().image.imageUrl);
});
