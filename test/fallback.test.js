import test from "node:test";
import assert from "node:assert/strict";
import { catalogueFallback, BUDGET_TITLES } from "../src/catalogue.js";
import { handleRequest, normaliseInput } from "../src/core.js";

const describe = (description) => normaliseInput({ mode: "describe", description }).value;
const titles = (result) => result.ideas.map((idea) => idea.title);

test("fallback for a four-year-old honours age and the no-small-parts constraint", () => {
  const result = catalogueFallback(describe("My nephew is 4 and obsessed with dinosaurs and diggers. Nothing with small pieces please."));
  assert.ok(result.ideas.length > 0);
  assert.ok(result.ideas.length <= 8);
  assert.ok(!/excavation|dig kit|magnet|small parts/i.test(titles(result).join(" ")));
  assert.ok(result.diagnostics.rejected.some((item) => item.codes.includes("catalogue_age_mismatch")));
  assert.ok(result.diagnostics.rejected.some((item) => item.codes.includes("small_loose_parts")));
});

test("fallback for a three-month-old uses baby-specific catalogue items, not adult gifts", () => {
  const result = catalogueFallback(describe("Our new baby niece, 3 months old."));
  assert.ok(result.ideas.length > 0);
  assert.ok(result.ideas.length <= 8);
  assert.ok(titles(result).every((title) => /baby|babies/i.test(title)));
  assert.ok(!/earbuds|head torch|wallet|camera/i.test(titles(result).join(" ")));
});

test("fallback respects a £15 hard budget using only low-cost items", () => {
  const result = catalogueFallback(describe("My 13 year old son loves gaming and football. Budget under £15."));
  assert.ok(result.ideas.length > 0);
  assert.ok(titles(result).every((title) => BUDGET_TITLES.has(title)));
  assert.ok(!/baby|toddler/i.test(titles(result).join(" ")));
});

test("fallback never exceeds a budget below the cheapest verified band", () => {
  const result = catalogueFallback(describe("My 13 year old son loves gaming. Budget under £5."));
  assert.equal(result.ideas.length, 0);
  assert.equal(result.diagnostics.shortfall, true);
  assert.ok(result.diagnostics.rejected.some((item) => item.codes.includes("catalogue_budget_not_verified")));
});

test("fallback excludes food and candles for Secret Santa within a £10 limit", () => {
  const result = catalogueFallback(describe("Colleague I don't know well, Secret Santa, £10 max. No food or candles."));
  assert.ok(result.ideas.length > 0);
  assert.ok(!/food|candle|hot sauce|skillet|chocolate|biscuit/i.test(titles(result).join(" ")));
  assert.ok(titles(result).every((title) => BUDGET_TITLES.has(title)));
});

test("missing Anthropic key returns recipient-aware catalogue ideas with an honest shortfall", async () => {
  const request = new Request("https://api.example.com/api/ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://gifts.example.com", "CF-Connecting-IP": "192.0.2.1" },
    body: JSON.stringify({ mode: "describe", description: "Our new baby niece, 3 months old." }),
  });
  const response = await handleRequest(request, {
    ALLOWED_ORIGINS: "https://gifts.example.com",
    IP_SALT: "unit-test-ip-salt-0123456789abcdef",
  }, {
    fetch: async () => { throw new Error("Claude must not be called without a key"); },
    budget: { consume: async () => { throw new Error("fallback must not consume AI budget"); } },
  });
  const data = await response.json();
  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.equal(data.source, "catalogue");
  assert.ok(data.ideas.length >= 4 && data.ideas.length <= 8);
  assert.ok(data.ideas.every((idea) => /baby|babies/i.test(idea.title)));
});

test("the browser no longer owns or selects the fallback catalogue", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const api = await readFile(new URL("../site/api.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /const LIST = \[/);
  assert.doesNotMatch(html, /function localIdeas\(/);
  assert.match(api, /data\.fallback/);
});
