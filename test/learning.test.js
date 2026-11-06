import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { applyLearning, feedbackCsv, learningContext, ratingScore } from "../src/engine/learning.js";
import { feedbackKeys } from "../src/engine/feedback.js";
import { handleRequest, normaliseInput } from "../src/core.js";
import { proposePolicy } from "../scripts/review-feedback.mjs";

const input = normaliseInput({ mode: "describe", description: "My 8-year-old likes trains. Budget £30." }).value;
const context = { topic: "trains", age: "child", budget: "15-30" };
const learning = { ...context, category: "Books", policy: "control-v1" };
const item = { source: "model", strategy: "core-interest", position: 0, learning };
const env = { ALLOWED_ORIGINS: "https://gifts.example.com", FEEDBACK_ADMIN_TOKEN: "test-export-token-0123456789abcdef" };
const exportRequest = (body = {}, token = env.FEEDBACK_ADMIN_TOKEN) => new Request("https://gifts.example.com/api/feedback/export", {
  method: "POST", headers: { Origin: env.ALLOWED_ORIGINS, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("learning context keeps only controlled topic and broad bands", () => {
  assert.deepEqual(learningContext(input), context);
  const output = applyLearning([{ title: "Train book", category: "Books" }], input);
  assert.deepEqual(output[0].learning, learning);
  assert.doesNotMatch(JSON.stringify(output[0].learning), /8-year|Budget|description/);
});

test("structured counters connect outcomes without free text and stay within storage batch cap", () => {
  for (const event of ["shown", "click", "good", "bad", "bought"]) {
    const fb = feedbackKeys({ event, item, items: [item] });
    assert.ok(fb.keys.includes(`L|${event}|trains|child|15-30|3|control-v1|0`));
  }
  const invalid = feedbackKeys({ event: "good", item: { ...item, learning: { ...learning, topic: "private name" } } });
  assert.ok(invalid.keys.every((k) => !k.startsWith("L|")));
  const batch = feedbackKeys({ event: "shown", items: Array.from({ length: 12 }, (_, position) => ({ ...item, position })) });
  assert.equal(batch.keys.length, 60);
});

test("policy enforces exact support thresholds, approval, flag and bounded movement", () => {
  assert.equal(ratingScore({ shown: 199, good: 30, bad: 0 }), null);
  assert.equal(ratingScore({ shown: 200, good: 29, bad: 0 }), null);
  assert.equal(ratingScore({ shown: 200, good: 30, bad: 0 }), 0.6);
  assert.equal(ratingScore({ shown: 200, good: 201, bad: 0 }), null);
  const ideas = ["Home", "Books", "Tech", "Books"].map((category, i) => ({ title: String(i), category }));
  const policy = { version: "reviewed-v1", approved: true, cells: [{ ...context, category: "Books", shown: 200, good: 30, bad: 0 }] };
  assert.deepEqual(applyLearning(ideas, input, {}, policy).map((i) => i.title), ["0", "1", "2", "3"]);
  assert.deepEqual(applyLearning(ideas, input, { LEARNING_RANKING_ENABLED: "true" }, { ...policy, approved: false }).map((i) => i.title), ["0", "1", "2", "3"]);
  const ranked = applyLearning(ideas, input, { LEARNING_RANKING_ENABLED: "true" }, policy);
  assert.deepEqual(ranked.map((i) => i.title), ["1", "0", "3", "2"]);
  assert.ok(ranked.every((i) => i.learning.policy === "reviewed-v1"));
  assert.equal(ideas[0].learning, undefined, "does not mutate cached candidates");
});

test("CSV proposal uses control explicit ratings only and never approves itself", () => {
  const row = (event, n, policy = "control-v1") => ({ bucket: "F2026-11-05", k: `L|${event}|trains|child|15-30|3|${policy}|0`, n });
  const csv = feedbackCsv([row("shown", 200), row("good", 30), row("click", 1000), row("bought", 1000), row("bad", 30, "reviewed-v1")]);
  assert.equal(csv.split(/\r\n/)[0], "day,event,topic,age,budget,category,policy,position,count");
  const proposal = proposePolicy(csv);
  assert.equal(proposal.approved, false);
  assert.deepEqual(proposal.cells, [{ ...context, category: "Books", shown: 200, good: 30, bad: 0 }]);
  assert.throws(() => proposePolicy(csv.replace('"trains"', '"=private"')), /Invalid feedback dimensions/);
});

test("export requires configured admin secret and returns paginated CSV, not public event data", async () => {
  let called = false;
  const deps = { feedback: { export: async (after) => {
    called = true;
    assert.deepEqual(after, { bucket: "F2026-11-04", key: "L|shown" });
    return { rows: [{ bucket: "F2026-11-05", k: "L|shown|trains|child|15-30|3|control-v1|0", n: 200 }],
      next: { bucket: "F2026-11-05", key: "L|shown" } };
  } } };
  assert.equal((await handleRequest(exportRequest({}, "wrong"), env, deps)).status, 401);
  assert.equal(called, false);
  assert.equal((await handleRequest(exportRequest(), { ...env, FEEDBACK_ADMIN_TOKEN: "" }, deps)).status, 503);
  assert.equal((await handleRequest(exportRequest({ after: { bucket: "wrong", key: "L|shown" } }), env, deps)).status, 400);
  const response = await handleRequest(exportRequest({ after: { bucket: "F2026-11-04", key: "L|shown" } }), env, deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(JSON.parse(decodeURIComponent(response.headers.get("X-Feedback-Next"))), { bucket: "F2026-11-05", key: "L|shown" });
  assert.match(await response.text(), /"Books"/);
});

test("UI keeps rejected titles ahead of freshness exclusions and clears them for a new recipient", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(html, /shownTitles\.filter\(\(title\) => !rejectedTitles\.includes\(title\)\), \.\.\.rejectedTitles/);
  assert.match(html, /shownTitles = \[\]; rejectedTitles = \[\]/);
  assert.match(html, /good\.disabled = true; bad\.disabled = true/);
  assert.match(html, /Self-reported purchase, not verified by the retailer/);
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const checked = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: script, encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr);
  }
});

test("actual card handlers send explicit ratings and purchases and preserve rejected titles", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const render = html.match(/function renderCards\(ideas,.*\)\{[\s\S]*?\n\}/)[0];
  const events = [];
  const searches = [];
  function element() {
    return {
      children: [], events: {}, dataset: {}, hidden: false, style: { setProperty() {} },
      append(...children) { this.children.push(...children); },
      before() {},
      setAttribute() {}, focus() {},
      addEventListener(name, handler) { this.events[name] = handler; },
    };
  }
  const cards = element();
  cards.querySelectorAll = (selector) => {
    const visible = cards.children.filter((card) => !card.hidden);
    if (!selector.endsWith(".dismiss")) return visible;
    return visible.map((card) => card.children[1].children.find((child) => child.className === "dismiss"));
  };
  const more = element();
  const context = vm.createContext({
    document: { createElement: element, body: { classList: { toggle() {} } } }, cardsByTitle: new Map(), HEART: "",
    swipeDeck: { enable() {}, advance(card) { card.hidden = true; } },
    $: (selector) => selector === "#cards" ? cards : more,
    isSaved: () => false, toggleSave() {}, updateCardLayout() {}, showFeedback() {}, setStatus() {},
    statusRevision: 0, CFG: {}, apiOn: () => true,
    monetization: { decorateIdeas: (ideas) => ideas, annotateCard() {} },
    retailerLinks: () => [
      { merchantId: "amazon", name: "Amazon", href: "https://amazon.example", affiliate: true, network: "amazon", search: true },
      { merchantId: "ebay", name: "eBay", href: "https://ebay.example", affiliate: false, network: "direct", search: true },
    ],
    current: input, activeController: null, shownTitles: ["Game", ...Array.from({ length: 24 }, (_, n) => `Other ${n}`)],
    run: (request) => searches.push(request),
    amazonUrl: () => "https://amazon.example", ebayUrl: () => "https://ebay.example",
    sendFeedback: async (event) => { events.push(event); return true; },
    fbItem: (idea, position) => ({ ...item, position, learning: idea.learning }),
  });
  vm.runInContext(`let rejectedTitles = []; ${render}; globalThis.rejections = () => rejectedTitles;`, context);
  context.renderCards([{ title: "Book", category: "Books", learning }, { title: "Game", category: "Books", learning }]);
  const buttons = (card) => card.children[1].children.find((child) => child.className === "idea-feedback").children;
  const [good, bad, bought] = buttons(cards.children[0]);
  good.events.click();
  bought.events.click();
  assert.equal(good.disabled, true);
  assert.equal(bad.disabled, true);
  buttons(cards.children[1])[1].events.click();
  await Promise.resolve();
  assert.equal(cards.children[1].hidden, true);
  assert.deepEqual(Array.from(context.rejections()), ["Game"]);
  assert.deepEqual(events.map((event) => event.event), ["shown", "good", "bought", "bad"]);
  assert.deepEqual(events[1].item.learning, learning);
  const moreHandler = html.match(/\$\("#more"\)\.addEventListener\("click", \(\) => \{[\s\S]*?\n\}\);/)[0];
  vm.runInContext(html.match(/function nextInput\(\)\{[\s\S]*?\n\}/)[0], context);
  vm.runInContext(moreHandler, context);
  more.events.click();
  assert.equal(searches[0].exclude.length, 24);
  assert.equal(searches[0].exclude.at(-1), "Game", "rejected title has priority over older freshness history");
});
