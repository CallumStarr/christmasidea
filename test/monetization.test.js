import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { affiliateRouter, retailerLinks } from "../site/affiliateRouter.js";
import { amazonUrl, ebayUrl } from "../site/merchant-links.js";
import { publicMonetizationConfig } from "../scripts/monetization-settings.mjs";
import { AWIN_ACCOUNT, DEFAULT_MONETIZATION_CONFIG } from "../site/config/affiliates.config.js";
import {
  matchingSponsor, normaliseSavedList, queryContext, savedIdea, savedKey,
  verifiedGiftValid, matchingVerifiedGifts, resolveSavedIdea, giftAddon, readLocalGiftList,
} from "../site/monetization-data.js";
import { encodeWishlist, decodeWishlist, wishlistUrl, sharedListText, finderPreset } from "../site/wishlist-state.js";
import { calendarReminder, blackFridayDate } from "../site/calendar-reminder.js";
import { monetizationMetadata, trackMonetizationEvent } from "../site/monetization-telemetry.js";
import { AdSlot, approvedAdScript } from "../site/AdSlot.js";
import vm from "node:vm";

const sponsors = JSON.parse(await readFile(new URL("../site/data/sponsoredProducts.json", import.meta.url), "utf8"));
const query = { title: "Personalised notebook", query: "personalised notebook", category: "Stationery" };
const now = Date.parse("2026-11-05T12:00:00Z");
const verified = {
  id: "verified-voucher", title: "UK garden visit voucher", description: "A garden visit voucher.",
  giftType: "experience", active: true, available: true, merchantId: "buyagift",
  destinationUrl: "https://www.buyagift.co.uk/example-voucher", termsUrl: "https://www.buyagift.co.uk/terms",
  price: { amount: 25, currency: "GBP" }, targetTags: ["gardening"],
  locationScope: "uk-wide", locationNote: "Select a participating UK venue and check its dates.",
  voucherTerms: "Subject to venue availability; valid for 12 months.",
  availabilityCheckedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 3600000).toISOString(),
};

test("photo-first batches reset shared-list state and use the current recipient without injecting unchecked inventory", async () => {
  const source = await readFile(new URL("../site/monetization-ui.js", import.meta.url), "utf8");
  const method = source.slice(source.indexOf("decorateIdeas(ideas,"), source.indexOf("async initialise()"));
  const elements = new Map();
  const context = vm.createContext({
    shared: [{ title: "Previously received list" }], offers: new Map(), selectedAddon: {}, initialisation: 0,
    scope: {}, context: { recipientTag: "other" },
    location: { hash: "" }, URLSearchParams, queryContext,
    getInput: () => ({ mode: "describe", description: "My dad enjoys coffee." }),
    $: (selector) => {
      if (!elements.has(selector)) elements.set(selector, {});
      return elements.get(selector);
    },
  });
  vm.runInContext(`globalThis.ui = { ${method} };`, context);
  const result = context.ui.decorateIdeas([{ ...query }], { includeInventory: false });
  assert.equal(result.length, 1);
  assert.equal(result[0].recipientTag, "dad");
  assert.equal(context.shared, null);
  assert.equal(context.selectedAddon, null);
  assert.equal(elements.get("#shared-list-notice").hidden, true);
});

test("Amazon and eBay routing preserves exact existing URL builders and campaign gating", () => {
  const config = { AMAZON_TAG: "existing-21", EBAY_CAMPAIGN_ID: "12345" };
  const links = retailerLinks(query, config);
  assert.equal(links.find((x) => x.merchantId === "amazon").href, amazonUrl(query.query, config));
  assert.equal(links.find((x) => x.merchantId === "ebay").href, ebayUrl(query.query, config));
  assert.equal(retailerLinks(query)[1].affiliate, false);
  assert.deepEqual(links.slice(0, 2).map((x) => x.merchantId), ["amazon", "ebay"]);
  const approved = retailerLinks(query, { ...config, MERCHANT_PROGRAMMES: { etsy: [
    { network: "awin", approved: true, merchantId: "111", affiliateId: "222" },
  ] } });
  assert.equal(approved[0].merchantId, "etsy");
});

test("public eBay configuration accepts the EBAY_CAMPAIGNID environment alias", () => {
  const config = publicMonetizationConfig({ EBAY_CAMPAIGNID: "12345" });
  assert.equal(config.EBAY_CAMPAIGN_ID, "12345");
});

test("approved network wrappers encode destination exactly once and rank verified programme terms", () => {
  const destination = "https://www.etsy.com/uk/search?q=coffee+%26+tea";
  const config = { MERCHANT_PROGRAMMES: { etsy: [
    { network: "awin", approved: true, merchantId: "111", affiliateId: "222", commissionRate: 4, cookieDays: 30 },
    { network: "cj", approved: true, publisherId: "333", linkId: "444", commissionRate: 5, cookieDays: 7 },
  ] } };
  const routed = affiliateRouter("etsy", destination, config);
  assert.equal(routed.network, "cj");
  assert.equal(new URL(routed.href).searchParams.get("url"), destination);
  config.MERCHANT_PROGRAMMES.etsy[1].approved = false;
  const awin = new URL(affiliateRouter("etsy", destination, config).href);
  assert.equal(awin.searchParams.get("ued"), destination);
  assert.equal(awin.searchParams.get("awinmid"), "111");
  assert.equal(awin.searchParams.get("awinaffid"), "222");
  const skim = affiliateRouter("etsy", destination, {
    SKIMLINKS_ID: "123X456", MERCHANT_PROGRAMMES: { etsy: [{ network: "skimlinks", approved: true }] },
  });
  assert.equal(new URL(skim.href).hostname, "go.redirectingat.com");
  assert.equal(new URL(skim.href).searchParams.get("id"), "123X456");
  assert.equal(affiliateRouter("etsy", destination).affiliate, false);
  assert.throws(() => affiliateRouter("etsy", "https://www.etsy.com.evil.test/x"), /Invalid/);
  assert.throws(() => affiliateRouter("etsy", "https://username@www.etsy.com/x"), /Invalid/);
});

test("public environment build excludes secret credentials and disables external integrations by default", () => {
  const config = publicMonetizationConfig({
    ANTHROPIC_API_KEY: "private-value", AMAZON_CREATORS_CLIENT_SECRET: "private-value",
    ETSY_AWIN_APPROVED: "true", ETSY_AWIN_MERCHANT_ID: "123", AWIN_AFFILIATE_ID: "456",
  });
  assert.doesNotMatch(JSON.stringify(config), /private-value|CLIENT_SECRET|API_KEY/);
  assert.equal(config.ENABLE_ADS, false);
  assert.equal(config.ENABLE_EXTERNAL_TELEMETRY, false);
  assert.equal(config.MERCHANT_PROGRAMMES.etsy[0].approved, true);
  assert.equal(DEFAULT_MONETIZATION_CONFIG.ENABLE_SPONSORED_DEMOS, false);
});

test("verified public Awin IDs survive builds with the joined Virginia Hayward programme enabled", () => {
  const config = publicMonetizationConfig({});
  assert.equal(AWIN_ACCOUNT.affiliateId, "3146453");
  assert.deepEqual(Object.fromEntries(Object.entries(AWIN_ACCOUNT.programmes)
    .map(([id, programme]) => [id, programme.merchantId])), {
    noths: "18484", ethicalsuperstore: "3651", greentulip: "48159", virginiahayward: "2500",
  });
  const destinations = {
    noths: "https://www.notonthehighstreet.com/",
    ethicalsuperstore: "https://www.ethicalsuperstore.com/",
    greentulip: "https://www.greentulip.co.uk/",
    virginiahayward: "https://www.virginiahayward.com/",
  };
  for (const [id, destination] of Object.entries(destinations)) {
    const programme = config.MERCHANT_PROGRAMMES[id][0];
    assert.equal(programme.affiliateId, "3146453");
    assert.equal(programme.merchantId, AWIN_ACCOUNT.programmes[id].merchantId);
    assert.equal(programme.approved, id === "virginiahayward");
    assert.equal(programme.cookieDays, 30);
    assert.equal(programme.commissionRate, 0);
    assert.equal(affiliateRouter(id, destination, config).affiliate, id === "virginiahayward");
    if (id !== "virginiahayward") assert.equal(affiliateRouter(id, destination, config).href, destination);
    const approved = publicMonetizationConfig({ [`${id.toUpperCase()}_AWIN_APPROVED`]: "true" });
    const url = new URL(affiliateRouter(id, destination, approved).href);
    assert.equal(url.hostname, "www.awin1.com");
    assert.equal(url.searchParams.get("awinmid"), programme.merchantId);
    assert.equal(url.searchParams.get("awinaffid"), "3146453");
    assert.equal(url.searchParams.get("ued"), destination);
  }
});

test("explicit Awin build overrides can replace or disable persisted public defaults", () => {
  const config = publicMonetizationConfig({
    AWIN_AFFILIATE_ID: "", NOTHS_AWIN_MERCHANT_ID: "",
    NOTHS_AWIN_APPROVED: "false", NOTHS_AWIN_COOKIE_DAYS: "0",
  });
  assert.equal(config.MERCHANT_PROGRAMMES.noths[0].affiliateId, "");
  assert.equal(config.MERCHANT_PROGRAMMES.noths[0].merchantId, "");
  assert.equal(config.MERCHANT_PROGRAMMES.noths[0].approved, false);
  assert.equal(config.MERCHANT_PROGRAMMES.noths[0].cookieDays, 0);
  const override = publicMonetizationConfig({
    AWIN_AFFILIATE_ID: "222", NOTHS_AWIN_MERCHANT_ID: "111",
    NOTHS_AWIN_APPROVED: "true", NOTHS_AWIN_COOKIE_DAYS: "7", NOTHS_AWIN_COMMISSION_RATE: "3",
  }).MERCHANT_PROGRAMMES.noths[0];
  assert.deepEqual(override, {
    network: "awin", approved: true, merchantId: "111", affiliateId: "222",
    cookieDays: 7, commissionRate: 3,
  });
});

test("sponsored inventory is demo-gated, budget-aware, deterministic and limited to one pick", () => {
  const context = { tags: ["gardening", "dad"], budgetMax: 40 };
  assert.equal(matchingSponsor(sponsors, context), null);
  const pick = matchingSponsor(sponsors, context, { ENABLE_SPONSORED_DEMOS: true });
  assert.equal(pick.inventoryId, "demo-garden-markers");
  assert.equal(pick.sponsored, true);
  assert.equal(matchingSponsor(sponsors, { ...context, budgetMax: 5 }, { ENABLE_SPONSORED_DEMOS: true }), null);
  assert.equal(matchingSponsor(sponsors, { ...context, minor: true }, { ENABLE_SPONSORED_DEMOS: true }), null);
  assert.equal(matchingSponsor(sponsors, { tags: ["unknown"], budgetMax: 15 }, { ENABLE_SPONSORED_DEMOS: true }).inventoryId, "demo-general-notebook");
  assert.equal(matchingSponsor(sponsors.map((x) => ({ ...x, active: false })), context, { ENABLE_SPONSORED_DEMOS: true }), null);
});

test("shortlist schema retains exact gift concepts and fixed recipient groups but never listing data", () => {
  const item = savedIdea({
    ...query, why: "For their notes.", recipientTag: "mum", productUrl: "https://seller.example",
    productId: "seller-account", email: "discarded", description: "discarded",
    birthday: "discarded", productSpec: { personalisationRequired: true, brandPreference: "discarded" },
  });
  assert.deepEqual(Object.keys(item).sort(), ["category", "productSpec", "query", "recipientTag", "title", "why"]);
  assert.equal(savedIdea({ ...query, recipientTag: "Somebody's name" }).recipientTag, "other");
  assert.notEqual(savedKey(item), savedKey({ ...item, recipientTag: "dad" }));
  assert.equal(normaliseSavedList([item, item]).length, 1);
  assert.throws(() => normaliseSavedList(Array.from({ length: 51 }, () => item)), /50/);
  assert.equal(readLocalGiftList([item, null, { title: "Incomplete" }]).length, 1);
});

test("shared wishlist round-trips Unicode, compressed and uncompressed, with no server query state", async () => {
  const items = [{ ...query, title: "Café notebook ☕", why: "Ideas for café notes.", recipientTag: "mum" }];
  for (const compress of [false, true]) {
    const encoded = await encodeWishlist(items, compress);
    assert.deepEqual(await decodeWishlist(encoded), normaliseSavedList(items));
  }
  const url = new URL(await wishlistUrl(items, "https://christmasidea.co.uk/?email=must-not-copy"));
  assert.equal(url.search, "");
  assert.ok(url.hash.startsWith("#list="));
  const text = sharedListText(items, url.toString(), (item) => retailerLinks(item, { AMAZON_TAG: "existing-21" }));
  assert.match(text, /commission/);
  assert.match(text, /Café notebook/);
  assert.match(text, /https:/);
  await assert.rejects(decodeWishlist("j1.invalid!"), /Invalid/);
  await assert.rejects(decodeWishlist("j1." + "a".repeat(12001)), /large/);
  await assert.rejects(encodeWishlist([]), /at least one/);
});

test("decompression has an output bound, not just a URL-length bound", async () => {
  const stream = new Blob([JSON.stringify({ version: 1, items: [], padding: "x".repeat(100000) })]).stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  await assert.rejects(decodeWishlist(`g1.${Buffer.from(bytes).toString("base64url")}`), /large/);
});

test("verified experiences and subscriptions require current availability, adult opt-in and real terms", () => {
  const context = { tags: ["gardening"], budgetMax: 30 };
  assert.equal(verifiedGiftValid(verified, now), true);
  assert.equal(verifiedGiftValid({ ...verified, expiresAt: new Date(now).toISOString() }, now), false);
  assert.equal(verifiedGiftValid({ ...verified, locationNote: "" }, now), false);
  assert.equal(verifiedGiftValid({ ...verified, termsUrl: "https://unapproved.test" }, now), false);
  const config = { ENABLE_VERIFIED_GIFTS: true }, preferences = { experience: true };
  assert.equal(matchingVerifiedGifts([verified], context, { age: "30s-40s" }, config, preferences, now).length, 1);
  assert.equal(matchingVerifiedGifts([verified], context, { age: "teen" }, config, preferences, now).length, 0);
  assert.equal(matchingVerifiedGifts([verified], context, { age: "30s-40s" }, config, {}, now).length, 0);
  const subscription = { ...verified, id: "subscription", giftType: "subscription", recurringPriceGbp: 12, minimumTotalGbp: 25, minimumTerm: "One month minimum.",
    billingInterval: "month", cancellationTerms: "Cancel before the next monthly charge.", cancellationUrl: verified.termsUrl };
  assert.equal(verifiedGiftValid(subscription, now), true);
  assert.equal(verifiedGiftValid({ ...subscription, recurringPriceGbp: undefined }, now), false);
  assert.equal(verifiedGiftValid({ ...subscription, minimumTotalGbp: undefined }, now), false);
  assert.equal(matchingVerifiedGifts([{ ...subscription, minimumTotalGbp: 100 }], context, { age: "30s-40s" }, config, { subscription: true }, now).length, 0);
  const saved = savedIdea({ ...query, inventoryId: verified.id });
  assert.equal(resolveSavedIdea(saved, [], [verified], config, now).merchantId, "buyagift");
  assert.equal(resolveSavedIdea(saved, [], [verified], config, now + 86400000).unavailableInventory, true);
});

test("remaining-budget add-ons use only unexpired verified prices and never invent savings", () => {
  const idea = { title: "Coffee dripper", query: "coffee dripper" };
  assert.equal(giftAddon(idea, 30).remaining, null);
  const product = { price: { amount: 20, currency: "GBP" }, retrievedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 1000).toISOString() };
  assert.equal(giftAddon(idea, 30, product, now).remaining, 10);
  assert.equal(giftAddon(idea, 30, product, now + 2000).remaining, null);
  assert.equal(giftAddon(idea, 15, product, now), null);
  assert.equal(giftAddon({ ...idea, inventoryId: "partner" }, 30), null);
});

test("controlled telemetry drops all identifying input and requires explicit external activation", () => {
  const input = { merchantNetwork: "awin", giftCategory: "Books", recipientTag: "mum", ip: "discarded", email: "discarded", id: "discarded", title: "discarded", list: "discarded" };
  const metadata = monetizationMetadata("affiliate_click", input);
  assert.deepEqual(metadata, { eventType: "affiliate_click", merchantNetwork: "awin", giftCategory: "Books", recipientTag: "mum" });
  let calls = 0;
  const browser = { plausible: () => calls++ };
  trackMonetizationEvent("affiliate_click", input, {}, browser);
  assert.equal(calls, 0);
  trackMonetizationEvent("affiliate_click", input, { ENABLE_EXTERNAL_TELEMETRY: true, TELEMETRY_PROVIDER: "plausible" }, browser);
  assert.equal(calls, 1);
  const local = trackMonetizationEvent("copy_list", input);
  assert.equal(Object.isFrozen(local), true);
  assert.equal(monetizationMetadata("copy_list", { recipientTag: "private label" }).recipientTag, "other");
  assert.throws(() => monetizationMetadata("unknown"), /Unknown/);
});

test("ad slots are inert when disabled and script URLs require exact approved HTTPS hosts", () => {
  AdSlot(null, "loading", {});
  assert.equal(approvedAdScript({ AD_SCRIPT_URL: "https://approved.test/script.js", AD_ALLOWED_HOST: "approved.test" }), "https://approved.test/script.js");
  assert.equal(approvedAdScript({ AD_SCRIPT_URL: "https://approved.test.evil.test/script.js", AD_ALLOWED_HOST: "approved.test" }), null);
  assert.equal(approvedAdScript({ AD_SCRIPT_URL: "http://approved.test/script.js", AD_ALLOWED_HOST: "approved.test" }), null);
});

test("calendar reminders use valid all-day dates, two-week birthday offsets and folded CRLF lines", () => {
  assert.equal(blackFridayDate(new Date(now)).toISOString().slice(0, 10), "2026-11-27");
  assert.equal(blackFridayDate(new Date("2026-11-28T00:00:00Z")).toISOString().slice(0, 10), "2027-11-26");
  const reminder = calendarReminder({ birthday: "2026-12-25", now: new Date(now), uid: "test-id", link: "https://christmasidea.co.uk/" });
  assert.match(reminder, /DTSTART;VALUE=DATE:20261211\r\n/);
  assert.match(reminder, /DTEND;VALUE=DATE:20261212\r\n/);
  assert.match(reminder, /BEGIN:VALARM/);
  assert.match(reminder, /https:\/\/christmasidea.co.uk/);
  for (const line of reminder.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.throws(() => calendarReminder({ birthday: "2026-02-30", now: new Date(now) }), /valid/);
  assert.throws(() => calendarReminder({ birthday: "2026-11-10", now: new Date(now) }), /past/);
});

test("finder presets are fixed editorial state rather than arbitrary text or automatic submissions", () => {
  assert.equal(finderPreset("#finder=gardening&budget=30"), "Someone who enjoys gardening and growing plants. Budget up to £30.");
  assert.equal(finderPreset("#form"), null);
  assert.throws(() => finderPreset("#finder=arbitrary&budget=30"), /Invalid/);
  assert.throws(() => finderPreset("#finder=coffee&budget=0"), /Invalid/);
  const context = queryContext({ relation: "other", description: "My dad enjoys gardening." }, [{ productSpec: { budgetMaxGbp: 30 } }]);
  assert.equal(context.recipientTag, "dad");
  assert.equal(context.budgetMax, 30);
  assert.ok(context.tags.includes("gardening"));
});
