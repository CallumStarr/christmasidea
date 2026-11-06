import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseEbayItem } from "../src/providers/ebay.js";
import { validProduct } from "../site/merchant-links.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workerCampaign = /^\s*EBAY_CAMPAIGN_ID\s*=\s*"([^"]*)"/m.exec(read("wrangler.toml"))?.[1] ?? "";
const workerApproved = /^\s*EBAY_AFFILIATE_TRACKING_APPROVED\s*=\s*"([^"]*)"/m.exec(read("wrangler.toml"))?.[1] === "true";
const publicCampaign = /\bEBAY_CAMPAIGN_ID:\s*"([^"]*)"/.exec(read("site/index.html"))?.[1] ?? "";
const now = Date.now();
const listing = (campaign) => ({
  itemId: "v1|123456789012|0",
  title: "Ceramic coffee mug",
  image: { imageUrl: "https://i.ebayimg.com/images/g/test/s-l500.jpg" },
  price: { value: "12.00", currency: "GBP" },
  shippingOptions: [{ shippingCost: { value: "2.50", currency: "GBP" } }],
  conditionId: "1000",
  buyingOptions: ["FIXED_PRICE"],
  itemAffiliateWebUrl: `https://www.ebay.co.uk/itm/123456789012?campid=${campaign}&mkcid=1&mkevt=1`,
  itemWebUrl: "https://www.ebay.co.uk/itm/123456789012",
  itemEndDate: new Date(now + 7200_000).toISOString(),
});
const workerEnv = (campaign) => ({
  PRODUCT_DISCOVERY_ENABLED: "true",
  EBAY_PRODUCT_DISCOVERY_ENABLED: "true",
  EBAY_CLIENT_ID: "client",
  EBAY_CLIENT_SECRET: "secret",
  EBAY_CAMPAIGN_ID: campaign,
  EBAY_AFFILIATE_TRACKING_APPROVED: campaign ? "true" : "false",
});
const effectiveCampaign = (env) => normaliseEbayItem(listing("1234567890"), env, now)?.productUrl.includes("campid=") ? "tracked" : "untracked";
// The Worker's effective campaign is the configured ID only when approval is explicitly recorded.
const expectedPublicCampaign = (approved, campaign) => (approved ? campaign : "");
const drift = (toml, html) => {
  const approved = /^\s*EBAY_AFFILIATE_TRACKING_APPROVED\s*=\s*"([^"]*)"/m.exec(toml)?.[1] === "true";
  const worker = /^\s*EBAY_CAMPAIGN_ID\s*=\s*"([^"]*)"/m.exec(toml)?.[1] ?? "";
  const pub = /\bEBAY_CAMPAIGN_ID:\s*"([^"]*)"/.exec(html)?.[1] ?? "";
  return expectedPublicCampaign(approved, worker) !== pub;
};

test("eBay offers survive the browser check only when Worker and public campaign IDs agree", () => {
  for (const campaign of ["", "1234567890"]) {
    const product = normaliseEbayItem(listing(campaign || "1234567890"), workerEnv(campaign), now);
    assert.equal(validProduct(product, { EBAY_CAMPAIGN_ID: campaign }, now), true, `aligned ${campaign || "untracked"}`);
  }
  const tracked = normaliseEbayItem(listing("1234567890"), workerEnv("1234567890"), now);
  assert.equal(validProduct(tracked, { EBAY_CAMPAIGN_ID: "" }, now), false);
});

test("committed Worker effective eBay campaign and public campaign agree", () => {
  assert.equal(publicCampaign, expectedPublicCampaign(workerApproved, workerCampaign),
    "set EBAY_AFFILIATE_TRACKING_APPROVED and site/index.html EBAY_CAMPAIGN_ID together");
  if (!workerApproved) assert.equal(publicCampaign, "", "public site must not advertise an unapproved campaign");
});

test("unapproved campaign fails safe: Worker returns untracked listings that the public site accepts", () => {
  const env = { ...workerEnv("5339240592"), EBAY_AFFILIATE_TRACKING_APPROVED: "false" };
  const tracked = listing("5339240592");
  const product = normaliseEbayItem(tracked, env, now);
  assert.ok(product, "offer is still available as an ordinary listing");
  assert.equal(product.productUrl, "https://www.ebay.co.uk/itm/123456789012");
  assert.doesNotMatch(product.affiliateUrl, /campid|mkevt|mkcid/);
  assert.equal(effectiveCampaign(env), "untracked");
  assert.equal(validProduct(product, { EBAY_CAMPAIGN_ID: "" }, now), true);
  for (const flag of [undefined, "", "TRUE", "yes", "1", " false "]) {
    assert.equal(effectiveCampaign({ ...env, EBAY_AFFILIATE_TRACKING_APPROVED: flag }), "untracked", `flag ${flag}`);
  }
});

test("approved campaign produces tracked listings that only a matching public campaign accepts", () => {
  const env = workerEnv("1234567890");
  const product = normaliseEbayItem(listing("1234567890"), env, now);
  const url = new URL(product.productUrl);
  assert.equal(url.searchParams.get("campid"), "1234567890");
  assert.equal(url.searchParams.get("mkcid"), "1");
  assert.equal(url.searchParams.get("mkevt"), "1");
  assert.equal(validProduct(product, { EBAY_CAMPAIGN_ID: "1234567890" }, now), true);
  assert.equal(validProduct(product, { EBAY_CAMPAIGN_ID: "" }, now), false, "no tracked offer without public approval");
  assert.equal(validProduct(product, { EBAY_CAMPAIGN_ID: "999" }, now), false, "foreign campaign rejected");
  assert.equal(normaliseEbayItem(listing("999"), env, now), null, "listing carrying another campaign is dropped");
});

test("configuration drift detector flags every inconsistent combination", () => {
  const toml = (approved, id = "5339240592") => `EBAY_CAMPAIGN_ID = "${id}"\nEBAY_AFFILIATE_TRACKING_APPROVED = "${approved}"\n`;
  const html = (id) => `EBAY_CAMPAIGN_ID: "${id}",`;
  assert.equal(drift(toml("false"), html("")), false);
  assert.equal(drift(toml("true"), html("5339240592")), false);
  assert.equal(drift(toml("true"), html("")), true, "approved Worker but public site empty");
  assert.equal(drift(toml("false"), html("5339240592")), true, "public advertises unapproved campaign");
  assert.equal(drift(toml("true"), html("1111111111")), true, "different campaigns");
});

test("a listing timestamped slightly ahead of the device clock is still accepted", () => {
  const product = normaliseEbayItem(listing("1234567890"), workerEnv("1234567890"), now);
  const config = { EBAY_CAMPAIGN_ID: "1234567890" };
  // The device clock runs behind the server: 0.4 s (seen live) and two minutes are both normal drift.
  assert.equal(validProduct(product, config, now - 400), true);
  assert.equal(validProduct(product, config, now - 120_000), true);
  // A timestamp far in the future is not plausible drift and is still rejected.
  assert.equal(validProduct(product, config, now - 3600_000), false);
  // Expiry is still enforced on the device clock.
  assert.equal(validProduct(product, config, Date.parse(product.expiresAt)), false);
});
