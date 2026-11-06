import test from "node:test";
import assert from "node:assert/strict";
import { createEbayProvider, normaliseEbayItem, isEbayProductUrl } from "../src/providers/ebay.js";
import { productDiscoveryAvailable, searchProductsForIdeas } from "../src/product-search.js";
import { assignUniqueProducts } from "../src/engine/product-identity.js";
import { amazonUrl, ebayUrl, validProduct, validProductImage } from "../site/merchant-links.js";
import { fetchProducts } from "../site/api.js";
import { selectPhotographedIdeas } from "../site/product-selection.js";
import { handleRequest } from "../src/core.js";
import { issueFeedbackReceipts } from "../src/engine/feedback-receipts.js";

const env = {
  PRODUCT_DISCOVERY_ENABLED: "true",
  EBAY_PRODUCT_DISCOVERY_ENABLED: "true",
  AMAZON_PRODUCT_DISCOVERY_ENABLED: "false",
  EBAY_CLIENT_ID: "ebay-test-client",
  EBAY_CLIENT_SECRET: "test-secret",
  EBAY_CAMPAIGN_ID: "1234567890",
  EBAY_AFFILIATE_TRACKING_APPROVED: "true",
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
  itemWebUrl: "https://www.ebay.co.uk/itm/123456789012",
  itemEndDate: new Date(now + 7200_000).toISOString(),
  ...overrides,
});
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const token = () => response({ access_token: "test-token", token_type: "bearer", expires_in: 7200 });
const idea = { title: "Ceramic coffee mug", query: "ceramic coffee mug", concept: "coffee mug", productSpec: { maxPriceGbp: 20, budgetMaxGbp: 20 } };

test("eBay requires its own opt-in and credentials but an affiliate campaign is optional", () => {
  assert.equal(productDiscoveryAvailable(env), true);
  for (const patch of [
    { PRODUCT_DISCOVERY_ENABLED: "false" }, { EBAY_PRODUCT_DISCOVERY_ENABLED: "false" },
    { EBAY_CLIENT_ID: "" }, { EBAY_CLIENT_SECRET: "" }, { EBAY_CAMPAIGN_ID: "invalid" },
  ]) {
    assert.equal(productDiscoveryAvailable({ ...env, ...patch }), false);
  }
  assert.equal(productDiscoveryAvailable({ ...env, EBAY_CAMPAIGN_ID: "" }), true);
  // Without recorded approval the campaign is ignored, so discovery stays available on untracked URLs.
  assert.equal(productDiscoveryAvailable({ ...env, EBAY_AFFILIATE_TRACKING_APPROVED: "false", EBAY_CAMPAIGN_ID: "invalid" }), true);
  assert.equal(productDiscoveryAvailable({
    ...env, EBAY_CAMPAIGN_ID: "", EBAY_CAMPAIGNID: "1234567890",
  }), true);
  assert.equal(productDiscoveryAvailable({
    ...env, EBAY_CAMPAIGN_ID: "", EBAY_CAMPAIGNID: "invalid",
  }), false);
});

test("eBay accepts the legacy EBAY_CAMPAIGNID spelling for tracked listings", () => {
  const configured = { ...env, EBAY_CAMPAIGN_ID: "", EBAY_CAMPAIGNID: "1234567890" };
  const product = normaliseEbayItem(item(), configured, now);
  assert.equal(product.affiliateUrl, item().itemAffiliateWebUrl);
  assert.equal(isEbayProductUrl(product.affiliateUrl, id, configured.EBAY_CAMPAIGNID), true);
});

test("ordinary eBay offers work without EPN and never accept unconfigured affiliate tracking", async () => {
  const untracked = { ...env, EBAY_CAMPAIGN_ID: "" };
  const product = normaliseEbayItem(item(), untracked, now);
  assert.equal(product.productUrl, item().itemWebUrl);
  assert.equal(validProduct(product, { EBAY_CAMPAIGN_ID: "" }, now), true);
  assert.equal(validProduct(product, config, now), false);
  assert.equal(isEbayProductUrl(item().itemAffiliateWebUrl, id, ""), false);
  assert.equal(normaliseEbayItem(item({ itemWebUrl: item().itemAffiliateWebUrl }), untracked, now), null);
  assert.equal(normaliseEbayItem(item({ itemAffiliateWebUrl: undefined }), env, now), null);
  const provider = createEbayProvider({ ...untracked, EBAY_CLIENT_ID: "non-affiliate-test" }, async (url, init) => {
    if (String(url).includes("/oauth2/")) return token();
    assert.equal(init.headers["X-EBAY-C-ENDUSERCTX"], undefined);
    return response({ itemSummaries: [item()] });
  });

  assert.equal((await provider.searchProducts("coffee mug"))[0].productUrl, item().itemWebUrl);
});

test("photo selection rejects a tracked offer when the public campaign is empty", async () => {
  const product = normaliseEbayItem(item(), env, now);
  let imageLoads = 0;
  const options = {
    fetchBatches: async (_ideas, receive) => receive({ products: [product], offers: [[product]] }, 0),
    loadImage: async () => { imageLoads++; return true; },
  };
  const mismatch = await selectPhotographedIdeas([idea], [], {
    ...options, config: { EBAY_CAMPAIGN_ID: "" },
  });
  assert.equal(mismatch.selected.length, 1);
  assert.deepEqual(mismatch.selected[0].offers, []);
  assert.match(mismatch.notice, /without photos/);
  assert.equal(imageLoads, 0);

  const matching = await selectPhotographedIdeas([idea], [], { ...options, config });
  assert.equal(matching.selected.length, 1);
  assert.deepEqual(matching.selected[0].offers, []);
  assert.equal(imageLoads, 0, "eBay content stays off mixed-retailer cards even with a matching campaign");
});

test("OAuth trims credential whitespace and reports only approved error categories", async () => {
  const provider = createEbayProvider({
    ...env, EBAY_CLIENT_ID: " whitespace-client \n", EBAY_CLIENT_SECRET: " test-secret \n",
  }, async (_url, init) => {
    assert.equal(init.headers.Authorization, `Basic ${btoa("whitespace-client:test-secret")}`);
    return response({ error: "invalid_client", error_description: "must never be logged" }, 401);
  });
  await assert.rejects(() => provider.searchProducts("mug"), { code: "token_invalid_client", status: 401 });
  const unknown = createEbayProvider({ ...env, EBAY_CLIENT_ID: "unknown-error-client" },
    async () => response({ error: "unexpected private response" }, 401));
  await assert.rejects(() => unknown.searchProducts("mug"), { code: "token_rejected", status: 401 });
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

test("eBay uses the largest API-supplied image without constructing unlicensed URLs", () => {
  const product = normaliseEbayItem(item({
    image: { imageUrl: "https://i.ebayimg.com/small.jpg", width: 225, height: 225 },
    thumbnailImages: [{ imageUrl: "https://i.ebayimg.com/large.jpg", width: 960, height: 960 }],
  }), env, now);
  assert.equal(product.imageUrl, "https://i.ebayimg.com/large.jpg");
});

test("eBay fallback uses a short product type instead of recipient-facing prose", async () => {
  const queries = [];
  const searchIdea = {
    title: "Cooking-themed book on food history",
    query: "food history book hardback",
    concept: "food history book",
    productSpec: {},
  };
  const result = await searchProductsForIdeas([searchIdea], env, {
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => {
      if (String(url).includes("/oauth2/")) return token();
      const query = new URL(url).searchParams.get("q");
      queries.push(query);
      return query === searchIdea.query ? response({ total: 0 })
        : response({ itemSummaries: [item({ title: "Food History Book" })] });
    },
  }, "visitor");
  assert.deepEqual(queries, ["food history book hardback", "food history book"]);
  assert.equal(result.products[0]?.provider, "ebay");
});

test("accepted photographed listings take priority over a higher-scoring match without a photo", async () => {
  const result = await searchProductsForIdeas([idea], env, {
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => String(url).includes("/oauth2/") ? token() : response({
      itemSummaries: [
        item({ image: undefined }),
        item({
          itemId: "v1|123456789013|0", title: "Coffee mug",
          itemAffiliateWebUrl: item().itemAffiliateWebUrl.replace("123456789012", "123456789013"),
        }),
      ],
    }),
  }, "visitor");
  assert.equal(result.products[0]?.productId, "v1|123456789013|0");
  assert.ok(result.products[0]?.imageUrl);
});

test("a verified match without a photo still triggers the existing bounded fallback", async () => {
  for (const fallbackHasImage of [true, false]) {
    const queries = [];
    const result = await searchProductsForIdeas([idea], env, {
      productBudget: { take: async (_ip, count) => count },
      fetch: async (url) => {
        if (String(url).includes("/oauth2/")) return token();
        const query = new URL(url).searchParams.get("q");
        queries.push(query);
        const primary = query === idea.query;
        return response({ itemSummaries: [item({
          title: primary ? "Ceramic coffee mug" : "Coffee mug",
          image: !primary && fallbackHasImage ? item().image : undefined,
        })] });
      },
    }, "visitor");
    assert.deepEqual(queries, ["ceramic coffee mug", "coffee mug"]);
    assert.equal(Boolean(result.products[0]?.imageUrl), fallbackHasImage);
    assert.equal(result.products[0]?.title, fallbackHasImage ? "Coffee mug" : "Ceramic coffee mug");
  }
});

test("photo selection never admits a wrong product or discards a verified offer when fallback is limited", async () => {
  let reservations = 0;
  const result = await searchProductsForIdeas([idea], env, {
    productBudget: { take: async (_ip, count) => ++reservations === 1 ? count : 0 },
    fetch: async (url) => String(url).includes("/oauth2/") ? token() : response({
      itemSummaries: [item({ image: undefined }), item({ title: "Coffee mug replacement handle" })],
    }),
  }, "visitor");
  assert.equal(result.limited, true);
  assert.equal(result.products[0]?.title, "Ceramic coffee mug");
  assert.equal(result.products[0]?.imageUrl, null);
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

test("every live Browse retry requires an extra reservation and stops when capacity runs out", async () => {
  for (const capacity of [1, 2]) {
    let remaining = capacity, searches = 0, reservations = 0;
    const result = await searchProductsForIdeas([{
      title: "Coffee mug", query: "coffee mug", concept: "coffee mug", productSpec: {},
    }], { ...env, EBAY_CLIENT_ID: `budget-retry-${capacity}` }, {
      productBudget: {
        take: async (_visitor, count) => {
          reservations++;
          const allowed = Math.min(remaining, count);
          remaining -= allowed;
          return allowed;
        },
      },
      fetch: async (url) => {
        if (String(url).includes("/oauth2/")) return token();
        searches++;
        return searches === 1 ? response({}, 401) : response({ itemSummaries: [item()] });
      },
    }, "visitor");
    assert.equal(reservations, 2);
    assert.equal(searches, capacity);
    assert.equal(result.limited, capacity === 1);
    assert.equal(Boolean(result.products[0]), capacity === 2);
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
    assert.deepEqual(result.offers[0].map((offer) => offer.provider), failEbay ? ["amazon"] : ["ebay", "amazon"]);
    assert.equal(result.unavailable, failEbay);
    assert.equal(result.products[0].provider, failEbay ? "amazon" : "ebay");
  }
});

test("eBay listings never read or write persistent caches, including empty search results", async () => {
  let requests = 0;
  let reads = 0, writes = 0;
  const deps = {
    cache: {
      match: async () => { reads++; return undefined; },
      put: async () => { writes++; },
    },
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => {
      if (String(url).includes("/oauth2/")) return token();
      requests++;
      return response({ itemSummaries: [item()] });
    },
  };
  await searchProductsForIdeas([idea], env, deps, "visitor");
  await searchProductsForIdeas([idea], env, deps, "visitor");
  assert.equal(requests, 2);
  await searchProductsForIdeas([idea], { ...env, EBAY_CAMPAIGN_ID: "999" }, deps, "visitor");
  assert.ok(requests > 2);
  await searchProductsForIdeas([idea], env, {
    ...deps,
    fetch: async (url) => String(url).includes("/oauth2/") ? token() : response({ total: 0 }),
  }, "visitor");
  assert.equal(reads, 0);
  assert.equal(writes, 0);
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
  const salt = "unit-test-ip-salt-0123456789abcdef";
  const [signed] = await issueFeedbackReceipts([{ ...idea, source: "model" }], { IP_SALT: salt, RECEIPT_SIGNING_KEY: "unit-test-receipt-key-0123456789abcdef" });
  const request = new Request(`${origin}/api/products`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
    body: JSON.stringify({ ideas: [signed] }),
  });
  const result = await handleRequest(request, {
    ...env, ALLOWED_ORIGINS: origin, IP_SALT: salt, RECEIPT_SIGNING_KEY: "unit-test-receipt-key-0123456789abcdef",
  }, {
    productBudget: { take: async (_ip, count) => count },
    fetch: async (url) => {
      assert.equal(new URL(url).hostname, "api.ebay.com");
      return String(url).includes("/oauth2/") ? token() : response({ itemSummaries: [item()] });
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  const body = await result.json();
  assert.equal(body.enabled, true);
  assert.equal(body.products[0].provider, "ebay");
  assert.equal(body.products[0].imageUrl, item().image.imageUrl);
});

test("the product endpoint refuses unsigned ideas before spending any search budget", async () => {
  const origin = "https://gifts.example.com";
  let spent = false;
  const request = new Request(`${origin}/api/products`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
    body: JSON.stringify({ ideas: [idea] }),
  });
  const result = await handleRequest(request, {
    ...env, ALLOWED_ORIGINS: origin, IP_SALT: "unit-test-ip-salt-0123456789abcdef", RECEIPT_SIGNING_KEY: "unit-test-receipt-key-0123456789abcdef",
  }, {
    productBudget: { take: async (_ip, count) => { spent = true; return count; } },
    fetch: async () => { throw new Error("unexpected eBay call"); },
  });
  assert.equal(result.status, 400);
  assert.equal(spent, false);
});
