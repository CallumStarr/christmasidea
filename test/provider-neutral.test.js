import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { scoreProductMatch } from "../src/product-matcher.js";
import { evaluateSuitability } from "../src/product-suitability.js";
import { validateOffer, isAllowedImageUrl, displayFor } from "../src/offer-validation.js";
import { amazonPolicy } from "../src/providers/amazon.js";
import { allImageHosts, configuredProviderId } from "../src/providers/index.js";

const TAG = "mcstarrstud0c-21";
const policy = amazonPolicy(TAG);
const NOW = Date.parse("2026-11-03T12:00:00Z");

const offer = (over = {}) => ({
  provider: "amazon",
  productId: "B012345678",
  title: "Bridge and Tunnel Construction Building Kit",
  imageUrl: "https://m.media-amazon.com/images/I/a.jpg",
  price: { amount: 24.99, currency: "GBP" },
  productUrl: `https://www.amazon.co.uk/dp/B012345678?tag=${TAG}`,
  affiliateUrl: `https://www.amazon.co.uk/dp/B012345678?tag=${TAG}`,
  availability: "IN_STOCK",
  condition: "NEW",
  retrievedAt: new Date(NOW - 60_000).toISOString(),
  expiresAt: new Date(NOW + 3000_000).toISOString(),
  ...over,
});

test("a fresh, correctly tagged offer validates and keeps provenance", () => {
  const v = validateOffer(offer(), policy, { now: NOW });
  assert.equal(v.provider, "amazon");
  assert.equal(v.asin, "B012345678");
  assert.equal(v.imageUrl, "https://m.media-amazon.com/images/I/a.jpg");
});

test("offer rejection cases", () => {
  const reject = (over) => assert.equal(validateOffer(offer(over), policy, { now: NOW }), null);
  reject({ availability: "OUT_OF_STOCK" });
  reject({ provider: "other" });
  reject({ productUrl: "https://www.amazon.co.uk/dp/B012345678?tag=wrong-21", affiliateUrl: "https://www.amazon.co.uk/dp/B012345678?tag=wrong-21" });
  reject({ productUrl: `https://www.amazon.co.uk/dp/B000000000?tag=${TAG}`, affiliateUrl: `https://www.amazon.co.uk/dp/B000000000?tag=${TAG}` });
  reject({ affiliateUrl: `https://www.amazon.co.uk/dp/B012345678?tag=${TAG}&x=1` });
  reject({ retrievedAt: new Date(NOW - 3601_000).toISOString() });
  reject({ retrievedAt: new Date(NOW + 60_000).toISOString() });
});

test("image hosts come from an explicit allow-list and never from feed data", () => {
  assert.equal(validateOffer(offer({ imageUrl: "https://evil.example/a.jpg" }), policy, { now: NOW }).imageUrl, null);
  assert.equal(isAllowedImageUrl("http://m.media-amazon.com/a.jpg", policy), false);
  assert.equal(isAllowedImageUrl("https://m.media-amazon.com.evil.example/a.jpg", policy), false);
  assert.equal(isAllowedImageUrl("https://user@m.media-amazon.com/a.jpg", policy), false);
  const other = { ...policy, imageHosts: ["img.partner.example"] };
  assert.equal(isAllowedImageUrl("https://m.media-amazon.com/a.jpg", other), false);
});

test("provider policy carries licensing, retention and display rules", () => {
  assert.equal(policy.imageRetention, "link-only-24h");
  assert.equal(policy.maxOfferAgeMs, 3600_000);
  assert.match(policy.disclosure, /Amazon Associate/);
  assert.equal(displayFor(policy).merchant, "Amazon UK");
});

test("adjacent discovery is judged on retrieval intent, not the recipient's original interest", () => {
  const idea = {
    title: "Bridge building kit",
    concept: "bridge construction kit",
    query: "bridge construction kit for kids",
    productSpec: { recipientAgeBand: "child", maxPriceGbp: 40 },
  };
  const match = scoreProductMatch(idea, offer({ description: "construction kit for kids to build bridges" }));
  assert.equal(match.accepted, true, JSON.stringify(match));
  assert.ok(!/train/i.test(offer().title));
});

test("identity stays strict for adjacent ideas: accessories and wrong types are rejected", () => {
  const idea = { title: "Bridge kit", concept: "bridge construction kit", query: "bridge construction kit", productSpec: {} };
  assert.equal(scoreProductMatch(idea, offer({ title: "Replacement parts for bridge construction kit" })).accepted, false);
  assert.equal(scoreProductMatch(idea, offer({ title: "Wooden Train Set" })).accepted, false);
});

test("suitability is evaluated separately from identity", () => {
  assert.deepEqual(evaluateSuitability({ maxPriceGbp: 40 }, offer({ price: { amount: 60, currency: "GBP" } })).reasons, ["over_budget"]);
  assert.deepEqual(evaluateSuitability({ recipientAgeBand: "adult" }, offer({ title: "Kids puzzle" })).reasons, ["recipient_age_mismatch"]);
  assert.equal(evaluateSuitability({}, offer()).suitable, true);
});

test("registry keeps Amazon unconfigured without credentials and the CSP lists every provider image host", async () => {
  assert.equal(configuredProviderId({}), null);
  assert.equal(configuredProviderId({ AMAZON_CREATORS_CLIENT_ID: "a", AMAZON_CREATORS_CLIENT_SECRET: "b", AMAZON_PARTNER_TAG: TAG }), "amazon");
  const src = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const img = src.match(/"img-src ([^"]+)"/)[1].split(" ").filter((p) => p.startsWith("https://")).map((p) => p.slice(8)).sort();
  assert.deepEqual(img, allImageHosts());
});

test("Amazon product-provider, offer-validation and image logic stays inside the Amazon provider module", async () => {
  const forbidden = [/media-amazon\.com/, /ssl-images-amazon\.com/, /creatorsapi/, /api\.amazon\.co\.uk/, /\/dp\/|gp\\?\/product/];
  const allowedElsewhere = new Set(["index.js"]); // the CSP names the image hosts; a test above keeps it in sync
  const dir = new URL("../src/", import.meta.url);
  const offenders = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".js") || allowedElsewhere.has(name)) continue;
    const text = await readFile(new URL(name, dir), "utf8");
    if (forbidden.some((re) => re.test(text))) offenders.push(name);
  }
  const catalogue = offenders.filter((n) => n !== "catalogue.js");
  assert.deepEqual(catalogue, []);
  for (const name of ["offer-validation.js", "product-matcher.js", "product-suitability.js", "product-search.js", "providers/index.js"]) {
    const text = await readFile(new URL(name, dir), "utf8");
    assert.doesNotMatch(text, /amazon\.co\.uk|media-amazon/i, name);
  }
});

test("Amazon remains disabled and retains its fallback tag while eBay discovery is enabled", async () => {
  const toml = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(toml, /^PRODUCT_DISCOVERY_ENABLED\s*=\s*"true"/m);
  assert.match(toml, /^AMAZON_PRODUCT_DISCOVERY_ENABLED\s*=\s*"false"/m);
  assert.match(toml, /^EBAY_PRODUCT_DISCOVERY_ENABLED\s*=\s*"true"/m);
  assert.match(toml, /AMAZON_PARTNER_TAG\s*=\s*"mcstarrstud0c-21"/);
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(html, /mcstarrstud0c-21/);
});
