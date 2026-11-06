import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseEbayItem } from "../src/providers/ebay.js";
import { validProduct } from "../site/merchant-links.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workerCampaign = /^\s*EBAY_CAMPAIGN_ID\s*=\s*"([^"]*)"/m.exec(read("wrangler.toml"))?.[1] ?? "";
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
});

test("eBay offers survive the browser check only when Worker and public campaign IDs agree", () => {
  for (const campaign of ["", "1234567890"]) {
    const product = normaliseEbayItem(listing(campaign || "1234567890"), workerEnv(campaign), now);
    assert.equal(validProduct(product, { EBAY_CAMPAIGN_ID: campaign }, now), true, `aligned ${campaign || "untracked"}`);
  }
  const tracked = normaliseEbayItem(listing("1234567890"), workerEnv("1234567890"), now);
  assert.equal(validProduct(tracked, { EBAY_CAMPAIGN_ID: "" }, now), false);
});

// Operator decision: the deployed Worker and the public site disagree, so every tracked eBay offer is
// discarded in the browser. Do not invent an account identifier to make this pass; see
// docs/audit/EXTERNAL_VERIFICATION_REGISTER.md.
test("committed Worker and public eBay campaign settings are aligned", {
  todo: "operator must choose the authoritative EPN campaign (wrangler.toml vs site/index.html)",
}, () => {
  assert.equal(publicCampaign, workerCampaign);
});
