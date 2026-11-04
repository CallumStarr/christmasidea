import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { curateIdeas, handleRequest, normaliseInput } from "../src/core.js";
import { catalogueFallback } from "../src/catalogue.js";
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserMessage } from "../src/prompts/gift-curator-v3.3.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const cases = read("../benchmarks/recipients.json");
const baseline = read("../benchmarks/baselines/v3.3-pre-refactor/benchmark-results.json");
const env = {
  ALLOWED_ORIGINS: "https://gifts.example.com",
  IP_SALT: "baseline-test-salt-0123456789abcdef",
  ANTHROPIC_API_KEY: "test-only",
  RECOMMENDATION_MODE: "baseline-v3.3",
};
const request = (input) => new Request("https://gifts.example.com/api/ideas", {
  method: "POST",
  headers: { Origin: env.ALLOWED_ORIGINS, "Content-Type": "application/json" },
  body: JSON.stringify(input),
});

test("release configuration selects baseline and retains disabled product discovery", () => {
  const config = fs.readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(config, /RECOMMENDATION_MODE = "baseline-v3.3"/);
  assert.match(config, /PRODUCT_DISCOVERY_ENABLED = "false"/);
});

test("baseline release preserves 29 reviewed lists and the explicit case-12 consistency correction", async () => {
  for (const row of baseline.results) {
    const c = cases.find((c) => c.id === row.case_id);
    let sent;
    const response = await handleRequest(request(c.input), env, {
      budget: { consume: async () => ({ ok: true }) },
      fetch: async (_url, init) => {
        sent = JSON.parse(init.body);
        return Response.json({
          stop_reason: "tool_use",
          content: [{ type: "tool_use", name: "gift_ideas", input: row.raw_output }],
        });
      },
    });
    assert.equal(response.status, 200, c.id);
    const data = await response.json();
    assert.equal(data.prompt_version, PROMPT_VERSION);
    assert.equal(data.engine_version, "baseline-v3.3");
    if (c.id === "case-12") {
      assert.deepEqual(data.ideas.map((i) => i.title), [
        "Herb growing kit with indoor planter",
        "Stainless steel reusable food wraps set",
        "Glass meal prep container set",
        "Garden herb snips and harvesting tool set",
        "Compost caddy for kitchen scraps",
        "Digital kitchen scales with bowl",
        "Plant-based cookbook",
        "Personalised herb garden marker set",
      ]);
      const reviewed = curateIdeas(row.raw_output, normaliseInput(c.input).value);
      assert.deepEqual(reviewed.diagnostics.rejected.filter((item) => item.title === "Garden kneeling pad and tool apron"), [
        { index: 7, title: "Garden kneeling pad and tool apron", codes: ["product_concept_conflict"] },
      ]);
      assert.equal(data.ideas.at(-1).title, "Personalised herb garden marker set");
    } else {
      assert.deepEqual(data.ideas.map((i) => i.title), row.output.ideas.map((i) => i.title), c.id);
    }
    assert.ok(data.ideas.every((i) => i.source === "model" && !i.connection && !i.discovery), c.id);
    assert.ok(sent.system.startsWith(SYSTEM_PROMPT));
    assert.equal(sent.messages[0].content, buildUserMessage(normaliseInput(c.input).value));
    assert.equal(sent.tools[0].strict, true);
    assert.equal(sent.tools[0].input_schema.properties.ideas.items.properties.strategy, undefined);
    assert.doesNotMatch(sent.messages[0].content, /<discovery_hints>/);
  }
});

test("baseline truncation never caches and empty generation uses original catalogue fallback", async () => {
  for (const raw of [baseline.results[0].raw_output, { ideas: [] }]) {
    let cached = false;
    const response = await handleRequest(request(cases[0].input), env, {
      budget: { consume: async () => ({ ok: true }) },
      cache: { match: async () => undefined, put: async () => { cached = true; } },
      fetch: async () => Response.json({
        stop_reason: "max_tokens",
        content: [{ type: "tool_use", name: "gift_ideas", input: raw }],
      }),
    });
    const data = await response.json();
    assert.equal(cached, false);
    if (raw.ideas.length) {
      assert.equal(response.status, 200);
      assert.equal(data.truncated, true);
      assert.equal(data.source, "ai");
    } else {
      assert.equal(response.status, 502);
      assert.equal(data.fallback, true);
      assert.equal(data.source, "catalogue");
      assert.deepEqual(data.ideas, catalogueFallback(normaliseInput(cases[0].input).value).ideas);
    }
  }
});

test("baseline and experimental results never share cache keys", async () => {
  const keys = [];
  const deps = {
    budget: { consume: async () => ({ ok: true }) },
    cache: {
      match: async (key) => { keys.push(key.url); },
      put: async () => {},
    },
    fetch: async () => Response.json({
      content: [{ type: "tool_use", name: "gift_ideas", input: baseline.results[0].raw_output }],
    }),
  };
  await handleRequest(request(cases[0].input), env, deps);
  await handleRequest(request(cases[0].input), { ...env, RECOMMENDATION_MODE: undefined }, deps);
  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
});

test("baseline still verifies Turnstile and retains exclusion instructions for different ideas", async () => {
  const input = { ...cases[0].input, exclude: ["Garden notebook"], turnstileToken: "invalid" };
  const response = await handleRequest(request(input), { ...env, TURNSTILE_SECRET: "test-only" }, {
    fetch: async (url) => {
      assert.match(url, /siteverify/);
      return Response.json({ success: false });
    },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).retryTurnstile, true);
  assert.match(buildUserMessage(input), /Garden notebook/);
});
