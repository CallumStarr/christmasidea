import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { scoreProductMatch } from "../src/product-matcher.js";
import { callClaude, handleRequest, normaliseInput } from "../src/core.js";
import { FINDER_MONITOR_CASES } from "../src/finder-monitor-cases.js";
import { issueFeedbackReceipts, verifyFeedbackReceipts } from "../src/engine/feedback-receipts.js";
import { checkFinder } from "../scripts/check-finder.mjs";
import { securityHeaders } from "../src/security-headers.js";
import { INLINE_SCRIPT_HASHES } from "../src/csp-hashes.js";

const origin = "https://gifts.example.com";
const env = { ALLOWED_ORIGINS: origin, IP_SALT: "synthetic-ip-salt-0123456789abcdef",
  RECEIPT_SIGNING_KEY: "synthetic-receipt-key-0123456789abcdef",
  FINDER_MONITOR_TOKEN: "synthetic-monitor-token-0123456789abcdef" };
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const request = (body, token) => new Request(`${origin}/api/ideas`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json",
    ...(token !== undefined ? { "X-Finder-Monitor": token } : {}) },
  body: JSON.stringify(body),
});

test("listing safety covers titles, descriptions and features before matching any provider", () => {
  const cases = [
    ["toddler", "Wooden train set", "Wooden train set with magnetic beads and small parts"],
    ["teen", "Camping set", "Camping set with folding knife and fire starter"],
    ["baby", "Baby bath set", "Baby bath set with teething necklace"],
    ["adult", "Whisky glass set", "Whisky glass set with 3 miniature whisky bottles"],
    ["toddler", "Wooden train set", "Not suitable for children under 36 months. Choking hazard."],
    ["baby", "Cloth book", "Contains a button battery"],
    ["child", "Camping set", "Includes energy drinks"],
  ];
  for (const [age, title, hazard] of cases) {
    for (const field of ["title", "description", "features"]) {
      const product = { provider: "ebay", title, condition: "NEW", availability: "IN_STOCK",
        ...(field === "features" ? { features: [hazard] } : { [field]: hazard }) };
      const match = scoreProductMatch({ title, query: title, concept: title, productSpec: { recipientAgeBand: age } }, product);
      assert.equal(match.accepted, false, `${age}: ${field}: ${hazard}`);
      assert.ok(match.reasons.some((reason) => /restricted_listing|listing_age_warning/.test(reason)));
    }
  }
  assert.equal(scoreProductMatch({ title: "Whisky glasses", query: "whisky glasses", concept: "Whisky glasses",
    productSpec: { recipientAgeBand: "adult" } }, {
    title: "Whisky glasses", condition: "NEW", availability: "IN_STOCK",
  }).accepted, true, "empty glassware is still allowed for adults");
});

test("eBay listing data cannot reach the Claude prompt through submitted enrichment fields", async () => {
  const canary = "EBAY_LISTING_DATA_DO_NOT_SEND_TO_AI";
  const input = normaliseInput({ ...FINDER_MONITOR_CASES[0],
    products: [{ title: canary, description: canary }], offers: [canary], ebay: canary });
  assert.equal(input.ok, true);
  let prompt;
  await callClaude(input.value, { MODEL: "claude-haiku-5-5" }, async (_url, init) => {
    prompt = init.body;
    return Response.json({ content: [{ type: "tool_use", name: "gift_ideas", input: { ideas: [] } }] });
  });
  assert.doesNotMatch(prompt, new RegExp(canary));
  assert.match(prompt, /gardening/);
});

test("monitor authentication allows only fixed cases, never arbitrary prompt bypasses", async () => {
  const deps = { fetch: () => assert.fail("no external request expected") };
  assert.equal((await handleRequest(request(FINDER_MONITOR_CASES[0], "invalid"), env, deps)).status, 401);
  assert.equal((await handleRequest(request({ mode: "describe", description: "An arbitrary expensive prompt" }, env.FINDER_MONITOR_TOKEN), env, deps)).status, 400);
  for (const input of FINDER_MONITOR_CASES) {
    const response = await handleRequest(request(input, env.FINDER_MONITOR_TOKEN), env, deps);
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.fallback, true);
    assert.equal(data.ideas.length, 8);
    assert.ok(data.ideas.every((idea) => idea.feedbackToken));
  }
});

test("monitored searches always reach Claude and never read or write the idea cache", async () => {
  const aiEnv = { ...env, ANTHROPIC_API_KEY: "sk-test", MODEL: "claude-haiku-5-5", KNOWLEDGE_REUSE_ENABLED: "true" };
  const claudeIdeas = Array.from({ length: 10 }, (_, index) => ({ title: `Garden kneeler ${index}`,
    concept: `garden kneeler ${index}`, search_query: `garden kneeler ${index}`, why: "Useful for their gardening.",
    category: "Home", estimated_max_price_gbp: 20 }));
  let claudeCalls = 0;
  const fetch = async () => {
    claudeCalls++;
    return Response.json({ content: [{ type: "tool_use", name: "gift_ideas", input: { ideas: claudeIdeas } }] });
  };
  const cachedPayload = JSON.stringify({ ideas: [{ title: "Cached idea", query: "cached idea", source: "model" }], source: "ai" });
  const cacheReads = [];
  const cacheWrites = [];
  const cache = {
    match: async (key) => { cacheReads.push(key.url); return new Response(cachedPayload); },
    put: async (key) => { cacheWrites.push(key.url); },
  };
  let consumed = 0;
  const budget = { consume: async () => { consumed++; return { ok: true }; },
    reuse: async () => assert.fail("monitored searches must not use knowledge reuse") };
  const deps = { fetch, cache, budget, waitUntil: () => {} };

  for (const input of FINDER_MONITOR_CASES) {
    const response = await handleRequest(request(input, env.FINDER_MONITOR_TOKEN), aiEnv, deps);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.source, "ai");
    assert.notEqual(data.cached, true);
  }
  assert.equal(claudeCalls, FINDER_MONITOR_CASES.length, "every monitor case calls Claude despite a cache entry");
  assert.equal(consumed, FINDER_MONITOR_CASES.length, "monitor calls stay inside the daily AI budget");
  assert.deepEqual(cacheReads, []);
  assert.deepEqual(cacheWrites, []);

  const visitor = await handleRequest(new Request(`${origin}/api/ideas`, { method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(FINDER_MONITOR_CASES[0]) }),
  { ...aiEnv, KNOWLEDGE_REUSE_ENABLED: "false" }, deps);
  const visitorData = await visitor.json();
  assert.equal(visitorData.cached, true, "ordinary visitors still use the idea cache");
  assert.equal(cacheReads.length, 1);
  assert.equal(claudeCalls, FINDER_MONITOR_CASES.length);
});

test("monitor validates API results and the same no-photo selection used by the UI", async () => {
  const ideas = Array.from({ length: 8 }, (_, index) => ({ title: `Gift ${index}`, query: `gift ${index}`, feedbackToken: "synthetic" }));
  const fetchImpl = async (url) => new URL(url).pathname === "/api/ready"
    ? new Response("", { status: 200 }) : Response.json({ ideas, source: "ai", product_discovery_enabled: false });
  await checkFinder({ origin, token: env.FINDER_MONITOR_TOKEN, fetchImpl });
  const respondWith = (extra) => async (url) => new URL(url).pathname === "/api/ready"
    ? new Response("", { status: 200 }) : Response.json({ ideas, source: "ai", product_discovery_enabled: false, ...extra });
  await assert.rejects(checkFinder({ origin, token: env.FINDER_MONITOR_TOKEN, fetchImpl: respondWith({ cached: true }) }), /idea cache/);
  await assert.rejects(checkFinder({ origin, token: env.FINDER_MONITOR_TOKEN, fetchImpl: respondWith({ source: "knowledge" }) }), /did not come from the AI path/);
  await assert.rejects(checkFinder({ origin, token: env.FINDER_MONITOR_TOKEN, fetchImpl: respondWith({ source: undefined }) }), /did not come from the AI path/);
  await assert.rejects(checkFinder({ origin, token: env.FINDER_MONITOR_TOKEN, fetchImpl: async (url) => {
    if (new URL(url).pathname === "/api/ready") return new Response("", { status: 200 });
    return Response.json({ ideas: [], source: "ai" });
  } }), /eight ideas/);
  await assert.rejects(checkFinder({ origin, token: env.FINDER_MONITOR_TOKEN, fetchImpl: async (url) => {
    if (new URL(url).pathname !== "/api/ideas") return new Response("", { status: 200 });
    return Response.json({ ideas, fallback: true, product_discovery_enabled: false }, { status: 503 });
  } }), /fell back to the catalogue/);
});

test("receipt signing is independent of IP hashing, and more events are signed and deduplicated", async () => {
  const [idea] = await issueFeedbackReceipts([{ source: "catalogue", title: "A book", query: "a book" }], env);
  const body = { event: "more", item: { ...idea, position: 0 } };
  const result = await verifyFeedbackReceipts(body, { ...env, IP_SALT: "a-different-ip-salt-0123456789abcdef" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.records[0].keys, ["more"]);
  assert.equal((await verifyFeedbackReceipts(body, { ...env, RECEIPT_SIGNING_KEY: "different-receipt-key-0123456789abcdef" })).ok, false);
  await assert.rejects(issueFeedbackReceipts([], { IP_SALT: env.IP_SALT }), /RECEIPT_SIGNING_KEY/);
});

test("all public pages disclose company and affiliate status; guides label ads before engagement", () => {
  for (const name of readdirSync(new URL("../site", import.meta.url)).filter((file) => file.endsWith(".js"))) {
    assert.doesNotMatch(read(`site/${name}`), /may earn|might earn/i, name);
  }
  for (const name of ["site/index.html", "site/about.html", "site/privacy.html", "site/terms.html",
    ...readdirSync(new URL("../site/gifts", import.meta.url)).map((file) => `site/gifts/${file}`)]) {
    const html = read(name);
    assert.match(html, /NOAH Neurotech Ltd/);
    assert.match(html, /17215758/);
    assert.match(html, /registered in England and Wales/);
    assert.match(html, /As an Amazon Associate I earn from qualifying purchases\./);
    assert.match(html, /As an eBay Partner Network Affiliate, I earn from qualifying purchases\./);
    assert.doesNotMatch(html, /may earn|If enabled, Cloudflare Web Analytics/i);
    if (/site\/gifts\/gifts-|site\/gifts\/secret-/.test(name)) {
      assert.match(html, /<h1>Ad &middot;/);
      assert.match(html, /By Callum Starr, NOAH Neurotech Ltd/);
      assert.match(html, /fetchpriority="high"/);
    }
  }
  assert.match(read("site/gifts/index.html"), /<h3>Ad &middot;/);
  assert.match(read("site/index.html"), /<span class="ad-label">Ad &middot;/);
  const privacy = read("site/privacy.html");
  for (const pattern of [/lawful bases/i, /Right to object/, /Right to complain/, /Anthropic Ireland Ltd/, /UK Addendum/, /18 and over/, /Cloudflare Web Analytics is enabled/]) {
    assert.match(privacy, pattern);
  }
});

test("provider disclosures use definite wording and the exact programme statements", () => {
  for (const name of readdirSync(new URL("../src/providers", import.meta.url)).filter((file) => file.endsWith(".js"))) {
    assert.doesNotMatch(read(`src/providers/${name}`), /may earn|might earn|Associate we earn/i, name);
  }
  assert.match(read("src/providers/amazon.js"), /"As an Amazon Associate I earn from qualifying purchases\."/);
  assert.match(read("src/providers/ebay.js"), /"As an eBay Partner Network Affiliate, I earn from qualifying purchases\."/);
  assert.doesNotMatch(read("site/about.html"), /ordinary searches until the campaign is confirmed/);
});

test("static security headers match the Worker policy without running it for JS, CSS or images", () => {
  const headers = read("site/_headers");
  for (const [name, value] of Object.entries(securityHeaders(INLINE_SCRIPT_HASHES))) {
    assert.ok(headers.includes(`  ${name}: ${value}`), name);
  }
  const config = read("wrangler.toml");
  assert.match(config, /run_worker_first = \[/);
  assert.doesNotMatch(config, /run_worker_first = true/);
  assert.match(config, /EBAY_PRODUCT_DISCOVERY_ENABLED = "false"/);
});
