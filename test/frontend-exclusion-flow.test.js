import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fetchIdeas } from "../site/api.js";
import { createTurnstileTokenGate } from "../site/turnstile-token.js";
import { handleRequest } from "../src/core.js";
import { shouldPrefetch } from "../site/swipe-deck.js";

const description = "My dad is happiest in the garden, loves a good coffee and has every tool. budget of £40";
const idea = (title, query) => ({
  title, concept: title, search_query: query, why: `A useful ${title.toLowerCase()} for the garden.`,
  category: "Home", estimated_max_price_gbp: 20,
});
const firstBatch = [
  idea("Pocket garden kneeling pad and seat", "garden kneeling pad seat"),
  ...["coffee grinder", "coffee dripper", "garden lantern", "wind chime", "garden field guide", "bird feeder", "plant labels"]
    .map((name) => idea(name, name)),
];
const env = {
  CANONICAL_HOST: "gifts.example.com",
  ALLOWED_ORIGINS: "https://gifts.example.com",
  IP_SALT: "frontend-test-salt-0123456789abcdef",
  ANTHROPIC_API_KEY: "test-only",
  TURNSTILE_SECRET: "test-only",
  RECOMMENDATION_MODE: "baseline-v3.3",
};

function frontend(fetchImpl, { selectPhotographedIdeas } = {}) {
  const html = fs.readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
  const source = html.slice(html.indexOf("function setStatus("), html.indexOf('$("#restart").addEventListener'));
  const elements = new Map();
  const element = () => ({
    children: [], events: {}, value: "", hidden: false,
    set textContent(value) { this.text = value; this.children = []; },
    get textContent() { return this.text; },
    addEventListener(name, fn) { this.events[name] = fn; },
    append(...children) { this.children.push(...children); },
    setAttribute() {}, removeAttribute() {}, scrollIntoView() {}, focus() {},
    querySelector: () => ({ value: "describe" }),
  });
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  $("#description").value = description;
  $("#results").hidden = true;
  const rendered = [], renderOptions = [], sharedInvalidations = [];
  const gate = createTurnstileTokenGate();
  const context = vm.createContext({
    $, document: { createElement: element, querySelector: () => null, querySelectorAll: () => [], activeElement: null },
    rejectedTitles: [],
    AbortController, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {},
    reduceMotion: true, turnstileEnabled: true, tsGate: gate, tsWidget: 1,
    resetTurnstile() {}, apiOn: () => true,
    fetchIdeas: (input, options) => fetchIdeas(input, { ...options, fetchImpl }),
    renderCards: (ideas, options) => { rendered.push(ideas); renderOptions.push(options); }, renderUnderstood: () => false,
    selectPhotographedIdeas,
    monetization: { inventoryReady: Promise.resolve(), invalidateSharedList() { sharedInvalidations.push(true); } },
    swipeDeck: { setBusy() {} }, shouldPrefetch,
    sendFeedback: async () => {}, fillProducts: () => assert.fail("discovery must remain disabled"),
  });
  vm.runInContext(source, context);
  async function action(start, token) {
    gate.provide(token);
    start();
    // The real event handlers intentionally fire-and-forget run(); wait for their observable completion.
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (!vm.runInContext("Boolean(activeController)", context)) return;
    }
    assert.fail("frontend request did not settle");
  }
  return { $, context, rendered, renderOptions, sharedInvalidations, action };
}

test("new finder requests invalidate shared decoding before awaiting results, but more requests do not", async () => {
  let release;
  const ui = frontend(() => new Promise((resolve) => { release = resolve; }));
  ui.context.turnstileEnabled = false;
  ui.$("#form").events.submit({ preventDefault() {} });
  assert.equal(ui.sharedInvalidations.length, 1);
  assert.equal(ui.rendered.length, 0);
  release(Response.json({ ideas: [{ title: "First gift" }], source: "ai" }));
  await ui.action(() => {}, "");
  ui.$("#more").events.click();
  assert.equal(ui.sharedInvalidations.length, 1);
  release(Response.json({ ideas: [{ title: "Next gift" }], source: "ai" }));
  await ui.action(() => {}, "");
  assert.equal(ui.rendered.length, 2);
});

test("photo-first finder renders only checked ideas and uses preloaded offers without a second enrichment", async () => {
  const first = { title: "Coffee grinder" }, missing = { title: "Unavailable idea" }, backup = { title: "Coffee dripper" };
  const offer = { provider: "ebay", imageUrl: "https://i.ebayimg.com/test.jpg" };
  const ui = frontend(async () => Response.json({
    ideas: [first, missing], replacement_ideas: [backup], photo_first: true,
    product_discovery_enabled: true, source: "ai",
  }), {
    selectPhotographedIdeas: async (ideas, replacements, options) => {
      assert.deepEqual(ideas, [first, missing]);
      assert.deepEqual(replacements, [backup]);
      assert.equal(options.enabled, true);
      assert.ok(options.signal);
      return { selected: [{ idea: first, offers: [offer] }, { idea: backup, offers: [offer] }], notice: "Showing fewer ideas." };
    },
  });
  vm.runInContext("globalThis.CFG = {}", ui.context);
  await ui.action(() => ui.$("#form").events.submit({ preventDefault() {} }), "photo-token");
  assert.deepEqual(ui.rendered[0], [first, backup]);
  assert.equal(ui.renderOptions[0].photoFirst, true);
  assert.deepEqual(ui.renderOptions[0].verifiedOffers.get(first.title), [offer]);
  assert.ok(ui.$("#deck-status").children.some((child) => child.textContent === "Showing fewer ideas."));
});

test("photo-first finder hides previous results and offers retry when no photographed idea survives", async () => {
  const ui = frontend(async () => Response.json({
    ideas: [{ title: "Unavailable" }], photo_first: true, product_discovery_enabled: true,
  }), {
    selectPhotographedIdeas: async () => ({ selected: [], notice: "No suitable ideas with working product photos were found." }),
  });
  vm.runInContext("globalThis.CFG = {}", ui.context);
  await ui.action(() => ui.$("#form").events.submit({ preventDefault() {} }), "empty-photo-token");
  assert.equal(ui.rendered.length, 0);
  assert.equal(ui.$("#results").hidden, true);
  assert.ok(ui.$("#status").children.some((child) => child.textContent === "Try again"));
});

test("real more/retry handlers retain bounded exclusions through the API and baseline release (mocked network)", async () => {
  const bodies = [], prompts = [], verified = new Set(), cacheKeys = [];
  let generation = 0;
  let denyNext = false;
  const ui = frontend(async (url, init) => {
    assert.equal(url, "/api/ideas");
    const body = JSON.parse(init.body);
    bodies.push(body);
    return handleRequest(new Request(`${env.ALLOWED_ORIGINS}${url}`, {
      ...init, headers: { ...init.headers, Origin: env.ALLOWED_ORIGINS },
    }), env, {
      budget: { consume: async () => ({ ok: true }) },
      cache: { match: async (key) => { cacheKeys.push(key.url); }, put: async () => {} },
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        if (url.includes("siteverify")) {
          assert.equal(verified.has(body.response), false, "single-use token must not be reused");
          verified.add(body.response);
          if (denyNext) { denyNext = false; return Response.json({ success: false }); }
          return Response.json({ success: true, hostname: "gifts.example.com" });
        }
        prompts.push(body.messages[0].content);
        const ideas = generation++ === 0 ? firstBatch : [
          idea("Garden kneeling mat with handles", "garden kneeling mat handles"),
          idea(`Garden storage seat number ${generation}`, `garden storage seat variant${generation}`),
        ];
        return Response.json({ content: [{ type: "tool_use", name: "gift_ideas", input: { ideas } }] });
      },
    });
  });
  await ui.action(() => ui.$("#form").events.submit({ preventDefault() {} }), "initial-token");
  assert.equal(ui.rendered[0].length, 8);
  denyNext = true;
  await ui.action(() => ui.$("#more").events.click(), "denied-token");
  assert.equal(ui.rendered.length, 1, "failed more request must preserve the collection");
  const retry = ui.$("#deck-status").children.find((child) => child.textContent === "Try again");
  assert.ok(retry);
  await ui.action(() => retry.events.click(), "retry-token");
  assert.deepEqual(bodies[1].exclude, firstBatch.map((i) => i.title));
  assert.deepEqual(bodies[2].exclude, bodies[1].exclude);
  assert.deepEqual(ui.rendered[1].map((i) => i.title), ["Garden storage seat number 2"]);
  assert.match(prompts[1], /<already_shown>/);
  assert.ok(prompts[1].includes(firstBatch[0].title));
  assert.notEqual(cacheKeys[0], cacheKeys[1]);
  // Subsequent "more" requests retain old titles as well as the latest displayed batch.
  await ui.action(() => ui.$("#more").events.click(), "more-token");
  assert.deepEqual(bodies[3].exclude, [...firstBatch.map((i) => i.title), "Garden storage seat number 2"]);
  assert.equal(bodies[3].description, description);
  assert.deepEqual([...verified], ["initial-token", "denied-token", "retry-token", "more-token"]);
});

test("actual frontend history keeps only the last 24 titles and retry does not reset it", async () => {
  const sent = [];
  let batch = 0;
  const ui = frontend(async (_url, init) => {
    sent.push(JSON.parse(init.body));
    const ideas = Array.from({ length: 8 }, (_, index) => ({ title: `Batch ${batch} item ${index}` }));
    batch++;
    return Response.json({ ideas, source: "ai", product_discovery_enabled: false });
  });
  await ui.action(() => ui.$("#form").events.submit({ preventDefault() {} }), "token-0");
  for (let batch = 1; batch <= 4; batch++) {
    await ui.action(() => ui.$("#more").events.click(), `token-${batch}`);
  }
  assert.equal(sent[4].exclude.length, 24);
  assert.deepEqual(sent[4].exclude, ui.rendered.slice(1, 4).flatMap((ideas) => ideas.map((i) => i.title)));
  assert.equal(ui.$("#description").value, description);
});

test("background prefetch appends once, preserves the deck after failure and requires explicit retry", async () => {
  const sent = [];
  let release;
  const ui = frontend(async (_url, init) => {
    sent.push(JSON.parse(init.body));
    if (sent.length === 2) return new Promise((resolve) => { release = resolve; });
    return Response.json({ ideas: [{ title: `Gift ${sent.length}` }], source: "ai" });
  });
  await ui.action(() => ui.$("#form").events.submit({ preventDefault() {} }), "initial");
  ui.context.turnstileEnabled = false;
  ui.$("#cards").querySelectorAll = () => [{}, {}, {}];
  vm.runInContext("requestPrefetch(); requestPrefetch(); requestPrefetch();", ui.context);
  assert.equal(sent.length, 2, "only one request may be in flight");
  assert.equal(ui.$("#loading").hidden, true, "preloading must not replace the current view");
  release(Response.json({ error: "Busy" }, { status: 429 }));
  await ui.action(() => {}, "");
  assert.equal(ui.rendered.length, 1, "failed prefetch must preserve existing cards");
  assert.match(ui.$("#deck-status").children[0].textContent, /Too many/);
  vm.runInContext("requestPrefetch()", ui.context);
  assert.equal(sent.length, 2, "there is no automatic retry loop after failure");
  await ui.action(() => ui.$("#more").events.click(), "");
  assert.equal(ui.rendered.length, 2);
  assert.equal(ui.renderOptions[1].append, true);
  assert.equal(sent[2].description, description);
  assert.deepEqual(sent[2].exclude, ["Gift 1"]);
});

test("duplicate-only and empty background batches pause rather than replacing cards or looping", async () => {
  for (const duplicate of [true, false]) {
    let calls = 0;
    const ui = frontend(async () => {
      calls++;
      return Response.json({ ideas: calls === 1 || duplicate ? [{ title: "Coffee grinder" }] : [], source: "ai" });
    });
    await ui.action(() => ui.$("#form").events.submit({ preventDefault() {} }), "initial");
    ui.context.turnstileEnabled = false;
    ui.$("#cards").querySelectorAll = () => [];
    await ui.action(() => vm.runInContext("requestPrefetch()", ui.context), "");
    vm.runInContext("requestPrefetch()", ui.context);
    assert.equal(calls, 2);
    assert.equal(ui.rendered.length, 1);
    assert.equal(ui.$("#results").hidden, false);
  }
});
