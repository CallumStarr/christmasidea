import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { scoreProductMatch } from "../src/product-matcher.js";
import { searchProductsForIdeas } from "../src/product-search.js";
import { allowedAwinAdvertisers, isAwinAdvertiserName } from "../src/providers/awin-advertisers.js";
import {
  awinConfigured, createAwinProvider, isAwinProductUrl, validateAwinProduct,
} from "../src/providers/awin.js";
import { readAwinFeedList } from "../scripts/sync-awin-catalogue.mjs";
import { sourceStatus } from "../src/engine/sources.js";
import { canonicalKey } from "../src/engine/product-identity.js";
import { validProduct, validProductImage } from "../site/merchant-links.js";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const env = {
  PRODUCT_DISCOVERY_ENABLED: "true",
  AWIN_PRODUCT_DISCOVERY_ENABLED: "true",
  AWIN_PUBLISHER_ID: "3146453",
  AWIN_ALLOWED_ADVERTISERS: "488",
  AWIN_IMAGE_HOSTS: "images.example.com",
};
const merchantUrl = "https://merchant.example/products/photo-book";
const deepLink = `https://www.awin1.com/cread.php?awinmid=488&awinaffid=3146453&ued=${encodeURIComponent(merchantUrl)}`;
const offer = (overrides = {}) => ({
  provider: "awin",
  productId: "488:photo-book-1",
  title: "Personalised photo book",
  description: "A personalised photo book with a hard cover.",
  merchantName: "Photo Books UK",
  imageUrl: "https://images.example.com/photo-book.jpg",
  merchantProductUrl: merchantUrl,
  affiliateUrl: deepLink,
  price: { amount: 20, currency: "GBP" },
  deliveryCost: { amount: 2, currency: "GBP" },
  deliveryIncluded: true,
  gtin: "12345670",
  availability: "IN_STOCK",
  condition: "NEW",
  retrievedAt: new Date(NOW - 1000).toISOString(),
  expiresAt: new Date(NOW + 3600000).toISOString(),
  ...overrides,
});

function catalogueDb(rows = [offer()]) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      statements.push(sql);
      return {
        first: async () => ({ active_generation: "g1", published_at: new Date(NOW - 1000).toISOString() }),
        bind(...values) {
          statements.push(values);
          return { all: async () => ({ results: rows.map((row) => ({
            productId: row.productId,
            advertiserId: row.productId.split(":")[0],
            title: row.title,
            description: row.description,
            brand: row.brand || "",
            merchantName: row.merchantName,
            category: "Personalised gifts",
            price: row.price.amount,
            deliveryCost: row.deliveryCost?.amount ?? null,
            deliveryKnown: row.deliveryIncluded ? 1 : 0,
            imageUrl: row.imageUrl,
            merchantProductUrl: row.merchantProductUrl,
            affiliateUrl: row.affiliateUrl,
            gtin: row.gtin,
            generation: "g1",
            inStock: 1,
          })) }) };
        },
      };
    },
  };
}

test("Awin discovery needs the global and retailer switches, a D1 binding and publisher identity", () => {
  assert.equal(awinConfigured({ ...env }), false);
  assert.equal(awinConfigured({ ...env, AWIN_CATALOG: catalogueDb() }), true);
  assert.equal(awinConfigured({ ...env, AWIN_CATALOG: catalogueDb(), PRODUCT_DISCOVERY_ENABLED: "false" }), false);
  assert.equal(awinConfigured({ ...env, AWIN_CATALOG: catalogueDb(), AWIN_PRODUCT_DISCOVERY_ENABLED: "false" }), false);
  assert.deepEqual(allowedAwinAdvertisers({ AWIN_ALLOWED_ADVERTISERS: "488,not-an-id,488,999999999" }), ["488"]);
  const active = sourceStatus({ ...env, AWIN_CATALOG: catalogueDb() }).find((source) => source.id === "awin-product-feeds");
  assert.equal(active.active, true);
});

test("Awin affiliate links, product identity, age and image hosts are validated", () => {
  const valid = validateAwinProduct(offer(), env, NOW);
  assert.equal(valid.price.amount, 22);
  assert.equal(valid.merchantName, "Photo Books UK");
  assert.equal(valid.merchantProductUrl, merchantUrl);
  assert.equal(validProduct(valid, { AWIN_AFFILIATE_ID: "3146453" }, NOW), true);
  assert.equal(validProductImage(valid.imageUrl, "awin", { AWIN_IMAGE_HOSTS: ["images.example.com"] }), true);
  assert.equal(validProductImage(valid.imageUrl, "awin", {}), false);
  assert.equal(canonicalKey(valid), "gtin:00000012345670");
  assert.equal(isAwinProductUrl(deepLink, "488:photo-book-1", "3146453", new Set(["488"])), true);
  const pclickLink = deepLink.replace("/cread.php", "/pclick.php");
  assert.equal(isAwinProductUrl(pclickLink, "488:photo-book-1", "3146453", new Set(["488"])), true);
  assert.ok(validateAwinProduct(offer({ affiliateUrl: pclickLink }), env, NOW));
  const feedLink = "https://www.awin1.com/pclick.php?p=photo-book-1&a=3146453&m=488";
  assert.equal(isAwinProductUrl(feedLink, "488:photo-book-1", "3146453", new Set(["488"]), merchantUrl), true);
  assert.ok(validateAwinProduct(offer({ affiliateUrl: feedLink }), env, NOW));
  assert.equal(isAwinProductUrl(feedLink, "488:other-product", "3146453", new Set(["488"]), merchantUrl), false);

  for (const patch of [
    { productId: "999:photo-book-1" },
    { affiliateUrl: deepLink.replace("awinaffid=3146453", "awinaffid=999") },
    { affiliateUrl: deepLink.replace("www.awin1.com", "awin1.com") },
    { merchantProductUrl: "https://other.example/product" },
    { retrievedAt: new Date(NOW - 25 * 3600000).toISOString() },
    { availability: "UNKNOWN" },
  ]) {
    assert.equal(validateAwinProduct(offer(patch), env, NOW), null, JSON.stringify(patch));
  }
  const unapprovedImage = validateAwinProduct(offer({ imageUrl: "https://unapproved.example/photo.jpg" }), env, NOW);
  assert.equal(unapprovedImage.imageUrl, null);
});

test("Awin full-text results are normalized and never cached", async () => {
  const db = catalogueDb();
  const provider = createAwinProvider({ ...env, AWIN_CATALOG: db });
  const found = await provider.searchProducts("Personalised photo book");
  assert.equal(found.length, 1);
  assert.equal(found[0].price.amount, 22);
  assert.equal(found[0].deliveryIncluded, true);
  assert.equal(provider.policy.persistResults, false);
  assert.match(db.statements[1], /awin_products_fts MATCH \?/);
  assert.ok(db.statements[2].includes('"personalised" OR "photo" OR "book"'));
});

test("Awin products from newly joined feed advertisers pass catalogue-backed validation", async () => {
  const newAdvertiserOffer = offer({
    productId: "999:photo-book-1",
    affiliateUrl: deepLink.replaceAll("488", "999"),
  });
  const provider = createAwinProvider({ ...env, AWIN_CATALOG: catalogueDb([newAdvertiserOffer]) });
  const [found] = await provider.searchProducts("Personalised photo book");
  assert.equal(found?.productId, "999:photo-book-1");
  assert.ok(provider.validateProduct(found));
});

test("Awin products flow through the existing strict product matcher", async () => {
  const idea = {
    title: "Personalised photo book",
    concept: "photo book",
    query: "personalised photo book",
    productSpec: { personalisationRequired: true, budgetMaxGbp: 30, maxPriceGbp: 30 },
  };
  const result = await searchProductsForIdeas([idea], {
    ...env, AWIN_CATALOG: catalogueDb(),
  }, {
    productBudget: { take: async (_ip, count) => count },
  }, "visitor");
  assert.equal(result.products[0]?.provider, "awin");
  assert.equal(scoreProductMatch(idea, result.products[0]).accepted, true);
  const unknownDelivery = { ...result.products[0], deliveryIncluded: false };
  assert.equal(scoreProductMatch(idea, unknownDelivery).accepted, false);
  assert.ok(scoreProductMatch(idea, unknownDelivery).reasons.includes("delivery_cost_unverified"));
});

test("Awin feed importer parses quoted CSV, filters advertiser/stock and produces staged SQL", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "awin-import-test-"));
  const feed = join(directory, "feed.csv.gz");
  const output = join(directory, "output");
  const validRow = [
    "488", "photo-book-1", '"Personalised photo book, hard cover"', 'A book with a quoted "message"',
    "PhotoCo", "Photo Books UK", "Personalised gifts", "20.00", "GBP", "yes", "2.00",
    "https://images.example.com/photo.jpg", merchantUrl,
    "http://www.awin1.com/pclick.php?p=photo-book-1&a=3146453&m=488", "12345670",
  ].join(",");
  const notAllowed = [
    "999", "other-1", "Photo book", "Description", "Brand", "Unknown shop", "Books", "20", "GBP",
    "yes", "0", "https://images.example.com/other.jpg", merchantUrl, deepLink, "",
  ].join(",");
  const outOfStock = [
    "488", "out-1", "Photo book", "Description", "Brand", "Photo Books UK", "Books", "20", "GBP",
    "no", "0", "https://images.example.com/other.jpg", merchantUrl,
    `https://www.awin1.com/cread.php?awinmid=488&awinaffid=3146453&ued=${encodeURIComponent(merchantUrl)}`, "",
  ].join(",");
  const csv = [
    "merchant_id,aw_product_id,product_name,description,brand_name,merchant_name,merchant_category,search_price,currency,in_stock,delivery_cost,image_url,merchant_deep_link,aw_deep_link,ean",
    validRow, notAllowed, outOfStock,
  ].join("\n");
  await writeFile(feed, gzipSync(csv));
  try {
    const script = fileURLToPath(new URL("../scripts/import-awin-feed.mjs", import.meta.url));
    const run = spawnSync(process.execPath, [script, "--feed", feed, "--output", output, "--advertisers", "488"], {
      encoding: "utf8",
    });

    await t.test("Awin sync selects joined allowlisted CSV feeds and reports unsupported feeds", async () => {
      const directory = await mkdtemp(join(tmpdir(), "awin-feed-list-test-"));
      const path = join(directory, "feed-list.csv");
      await writeFile(path, [
        "Advertiser ID,Advertiser Name,Primary Region,Membership Status,Datafeed Format,URL",
        '488,Photo Books UK,GB,active,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/1/format/csv',
        '488,Photo Books UK,GB,active,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/2/format/csv',
        '999,Not joined,GB,active,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/3/format/csv',
        '488,Photo Books UK,GB,active,Google,https://productdata.awin.com/datafeed/download/apikey/key/fid/4/format/csv',
        '488,Photo Books UK,GB,pending,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/5/format/csv',
        '488,Photo Books UK,US,active,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/6/format/csv',
        '488,Photo Books UK,GB,active,Awin,http://127.0.0.1/private',
      ].join("\n"));
      try {
        const result = await readAwinFeedList(path, new Set(["488"]));
        assert.equal(result.feeds.length, 2);
        assert.deepEqual(result.activeAdvertisers, ["488"]);
        assert.deepEqual(result.uncoveredAdvertisers, []);

        await writeFile(path, [
          "Advertiser ID,Advertiser Name,Primary Region,Membership Status,Datafeed Format,URL",
          "12345,The Wentworth Wooden Jigsaw Company,GB,active,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/7/format/csv",
        ].join("\n"));
        const nameMatched = await readAwinFeedList(path, new Set(["488"]));
        assert.deepEqual(nameMatched.activeAdvertisers, ["12345"]);
        assert.equal(nameMatched.feeds.length, 1);
        assert.equal(isAwinAdvertiserName("The Wentworth Wooden Jigsaw Company"), true);
        assert.equal(isAwinAdvertiserName("Unrelated UK Retailer"), false);

        await writeFile(path, [
          "Advertiser ID,Advertiser Name,Primary Region,Membership Status,Datafeed Format,URL",
          "488,Photo Books UK,GB,active,Google,https://productdata.awin.com/datafeed/download/apikey/key/fid/4/format/csv",
        ].join("\n"));
        const unsupported = await readAwinFeedList(path, new Set(["488"]));
        assert.equal(unsupported.feeds.length, 0);
        assert.deepEqual(unsupported.uncoveredAdvertisers, ["488"]);

        await writeFile(path, [
          "Advertiser ID,Advertiser Name,Primary Region,Membership Status,Datafeed Format,URL",
          "654321,New joined advertiser,GB,active,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/8/format/csv",
          "654322,Not joined advertiser,GB,pending,Awin,https://productdata.awin.com/datafeed/download/apikey/key/fid/9/format/csv",
        ].join("\n"));
        const allJoined = await readAwinFeedList(path, null);
        assert.deepEqual(allJoined.activeAdvertisers, ["654321"]);
        assert.equal(allJoined.feeds.length, 1);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /1 eligible, 2 rejected/);
    const sql = await readFile(join(output, "awin-import-0000.sql"), "utf8");
    assert.match(sql, /Personalised photo book, hard cover/);
    assert.match(sql, /quoted "message"/);
    assert.match(sql, /https:\/\/www\.awin1\.com\/pclick\.php\?p=photo-book-1/);
    assert.doesNotMatch(sql, /http:\/\/www\.awin1\.com/);
    assert.doesNotMatch(sql, /Unknown shop/);
    const publishSql = await readFile(join(output, "awin-publish.sql"), "utf8");
    assert.match(publishSql, /UPDATE awin_catalogue_state/);
    assert.doesNotMatch(publishSql, /DELETE FROM awin_products/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
