import test from "node:test";
import assert from "node:assert/strict";
import {
  handleRequest, normaliseInput, curateIdeas, GIFT_TOOL, STRICT_GIFT_TOOL, SYSTEM_PROMPT, buildUserMessage,
  DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_EFFORT, generationParams, generationFingerprint, resolveEffort,
} from "../src/core.js";
import { CANDIDATE_COUNT } from "../src/prompt.js";
import { verifyKnownFacts } from "../src/validate.js";
import { deriveRecipient } from "../src/recipient.js";
import { buildBenchmarkRequest, buildResultRecord, benchmarkMaxTokens, benchmarkEffort } from "../scripts/run-benchmark.js";

const ORIGIN = "https://gifts.example.com";
const env = { ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: "sk-test", MODEL: "claude-haiku-5-5" };
const okBudget = { consume: async () => ({ ok: true }) };
const input = (description) => normaliseInput({ mode: "describe", description }).value;
const req = (body) => new Request("https://api.example.com/api/ideas", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: ORIGIN, "CF-Connecting-IP": "1.2.3.4" },
  body: JSON.stringify(body),
});
const idea = (t, q, why = "Useful and relevant.") => ({
  title: t, concept: t, why, search_query: q, category: "Home", angle: "practical", estimated_max_price_gbp: 20,
});
const rejectionCodes = (result) => result.diagnostics.rejected.flatMap((entry) => entry.codes);

async function captureProductionRequest(extraEnv = {}) {
  let sent;
  const fetch = async (url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "gift_ideas", input: { recipient_summary: "", ideas: [idea("Tea infuser", "tea infuser")] } }] }), { status: 200 });
  };
  await handleRequest(req({ mode: "describe", description: "My aunt is 60 and loves tea. Budget £25." }), { ...env, ...extraEnv }, { fetch, budget: okBudget });
  return sent;
}

// ---------- request configuration ----------

test("production request sets adaptive thinking, low effort and the 4,500 token limit explicitly", async () => {
  const body = await captureProductionRequest();
  assert.deepEqual(body.thinking, { type: "adaptive" });
  assert.deepEqual(body.output_config, { effort: "low" });
  assert.equal(body.max_tokens, 4500);
  assert.equal(body.model, "claude-haiku-5-5");
});

test("no request ever carries the legacy budget_tokens thinking config", async () => {
  const prod = await captureProductionRequest({ CLAUDE_EFFORT: "high" });
  const bench = buildBenchmarkRequest({ id: "claude-haiku-5-5" }, "hello");
  for (const body of [prod, bench]) {
    assert.ok(!JSON.stringify(body).includes("budget_tokens"));
    assert.notEqual(body.thinking.type, "enabled");
  }
});

test("benchmark and production use identical generation settings by default", async () => {
  const prod = await captureProductionRequest();
  const bench = buildBenchmarkRequest({ id: "claude-haiku-5-5" }, "hello");
  assert.deepEqual(bench.thinking, prod.thinking);
  assert.deepEqual(bench.output_config, prod.output_config);
  assert.equal(bench.max_tokens, prod.max_tokens);
  assert.equal(benchmarkMaxTokens(), DEFAULT_MAX_OUTPUT_TOKENS);
  assert.equal(benchmarkEffort(), DEFAULT_EFFORT);
  assert.equal(DEFAULT_EFFORT, "low");
});

test("effort is validated: unknown values fall back to low, known values pass through", () => {
  assert.equal(resolveEffort(undefined), "low");
  assert.equal(resolveEffort("turbo"), "low");
  assert.equal(resolveEffort("MEDIUM"), "medium");
  assert.equal(generationParams({ effort: "high" }).output_config.effort, "high");
});

test("effort and output limit are part of the cache fingerprint", () => {
  assert.notEqual(generationFingerprint({ CLAUDE_EFFORT: "low" }), generationFingerprint({ CLAUDE_EFFORT: "medium" }));
  assert.notEqual(generationFingerprint({ MAX_OUTPUT_TOKENS: "3000" }), generationFingerprint({}));
});

test("responses generated under different effort settings never share a cache entry", async () => {
  const store = new Map();
  const cache = {
    match: async (r) => (store.has(r.url) ? new Response(store.get(r.url)) : undefined),
    put: async (r, res) => { store.set(r.url, await res.text()); },
  };
  let calls = 0;
  const fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "gift_ideas", input: { recipient_summary: "", ideas: [idea("Tea infuser", "tea infuser")] } }] }), { status: 200 });
  };
  const body = { mode: "describe", description: "My aunt is 60 and loves tea. Budget £25." };
  await handleRequest(req(body), { ...env, CLAUDE_EFFORT: "low" }, { fetch, budget: okBudget, cache });
  const other = await handleRequest(req(body), { ...env, CLAUDE_EFFORT: "medium" }, { fetch, budget: okBudget, cache });
  assert.equal((await other.json()).cached, undefined);
  assert.equal(calls, 2);
  const same = await handleRequest(req(body), { ...env, CLAUDE_EFFORT: "low" }, { fetch, budget: okBudget, cache });
  assert.equal((await same.json()).cached, true);
  assert.equal(calls, 2);
});

// ---------- production / benchmark parity ----------

test("production and the Haiku benchmark send byte-identical requests for the same input", async () => {
  const description = "My aunt is 60 and loves tea. Budget £25.";
  const parsed = normaliseInput({ mode: "describe", description }).value;
  const prod = await captureProductionRequest();
  const bench = buildBenchmarkRequest({ id: "claude-haiku-5-5", forceTool: true }, buildUserMessage(parsed));
  assert.deepEqual(bench, prod);
  assert.equal(JSON.stringify(bench), JSON.stringify(prod));
});

test("Haiku uses a forced, named, strict gift_ideas tool in production and the benchmark", async () => {
  const prod = await captureProductionRequest();
  const bench = buildBenchmarkRequest({ id: "claude-haiku-5-5", forceTool: true }, "x");
  for (const body of [prod, bench]) {
    assert.deepEqual(body.tool_choice, { type: "tool", name: "gift_ideas" });
    assert.equal(body.tools.length, 1);
    assert.equal(body.tools[0].name, "gift_ideas");
    assert.equal(body.tools[0].strict, true);
    assert.deepEqual(body.thinking, { type: "adaptive" });
    assert.deepEqual(body.output_config, { effort: "low" });
  }
});

test("the real benchmark model table forces the tool for Haiku only", async () => {
  const { MODELS } = await import("../scripts/run-benchmark.js");
  assert.equal(MODELS.haiku.forceTool, true);
  assert.equal(MODELS.haiku.id, "claude-haiku-5-5");
  assert.equal(MODELS.sonnet.forceTool, false);
});

test("the strict schema keeps known_facts evidence and exactly-ten wording, and closes every object", () => {
  const facts = STRICT_GIFT_TOOL.input_schema.properties.recipient_profile.properties.known_facts.items;
  assert.deepEqual(facts.required.sort(), ["evidence", "fact"]);
  assert.equal(facts.additionalProperties, false);
  assert.match(STRICT_GIFT_TOOL.description + SYSTEM_PROMPT, /exactly 10/);
});

test("benchmark results record stop_reason, thinking tokens and the request configuration", () => {
  const model = { key: "haiku", id: "claude-haiku-5-5", input: 0.1, output: 0.5 };
  const output = { recipient_summary: "", ideas: [idea("Tea infuser", "tea infuser")] };
  const rec = buildResultRecord({ caseId: "c", model, response: { output, usage: { input_tokens: 10, output_tokens: 20, output_tokens_details: { thinking_tokens: 0 } }, stop_reason: "tool_use" }, input: input("My aunt loves tea."), blindLabel: "A", latencyMs: 1 });
  assert.equal(rec.stop_reason, "tool_use");
  assert.equal(rec.thinking_tokens, 0);
  assert.equal(rec.effort, "low");
  assert.equal(rec.validation.raw_count, 1);
});

// ---------- exactly ten candidates ----------

test("the prompt and schema ask for exactly ten distinct candidates", () => {
  assert.equal(CANDIDATE_COUNT, 10);
  assert.match(SYSTEM_PROMPT, /exactly 10 distinct candidate ideas/);
  assert.doesNotMatch(SYSTEM_PROMPT, /Return fewer than/);
  assert.equal(GIFT_TOOL.input_schema.properties.ideas.maxItems, 10);
});

test("an under-delivering model is reported honestly with no server-side invented ideas", () => {
  const ctx = input("My aunt is 60 and loves tea. Budget £25.");
  const eight = ["tea infuser", "teapot cosy", "loose leaf sampler", "tea caddy", "biscuit tin", "mug warmer", "tea towel", "cake stand"].map((t) => idea(t, t));
  const r = curateIdeas({ recipient_summary: "", ideas: eight }, ctx);
  assert.equal(r.diagnostics.raw_count, 8);
  assert.equal(r.ideas.length, 8);
  const seven = curateIdeas({ recipient_summary: "", ideas: eight.slice(0, 7) }, ctx);
  assert.equal(seven.ideas.length, 7);
  assert.equal(seven.diagnostics.shortfall, true);
  assert.equal(seven.diagnostics.raw_count, 7);
});

// ---------- facts versus inferences ----------

const CASE16 = input("Choose age-appropriate products intended for babies under one. Avoid sleep-positioning products, teething medicines, food and anything with unclear safety suitability. New baby; parents appreciate practical, well-made items.");
const CASE25 = input("I'd like something thoughtful but neutral, around £20. I don't know their hobbies or personal preferences.");
const CASE26 = input("He dislikes technology gifts, fragrances, clutter and gimmicks and enjoys making practical notes. Budget £45.");
const facts = (...pairs) => ({ recipient_profile: { known_facts: pairs.map(([fact, evidence]) => ({ fact, evidence })) } });

test("case 16: shopper-stated safety exclusions are verified facts (positive control)", () => {
  const r = verifyKnownFacts(facts(
    ["Avoid sleep-positioning products", "Avoid sleep-positioning products"],
    ["Parents appreciate practical, well-made items", "parents appreciate practical, well-made items"],
  ), deriveRecipient(CASE16));
  assert.equal(r.verified.length, 2);
  assert.equal(r.unverified.length, 0);
});

test("guided form selections can be verified using their exact rendered evidence", () => {
  const parsed = normaliseInput({
    mode: "guided",
    relation: "child",
    age: "baby",
    budget: "30-50",
    occasion: "christmas",
    interests: "New baby; parents appreciate practical, well-made items",
    about: "Choose age-appropriate products intended for babies under one.",
  }).value;
  const result = verifyKnownFacts({
    recipient_profile: {
      known_facts: [
        { fact: "Buying for a child", evidence: "Buying for: a child" },
        { fact: "Age is a baby under one", evidence: "Age: a baby (under 1)" },
        { fact: "Occasion is Christmas", evidence: "Occasion: Christmas" },
        { fact: "Budget per gift is £30 to £50", evidence: "Budget per gift: £30 to £50" },
        { fact: "Parents appreciate practical, well-made items", evidence: "parents appreciate practical, well-made items" },
      ],
    },
  }, deriveRecipient(parsed));
  assert.equal(result.verified.length, 5);
  assert.equal(result.unverified.length, 0);
});

test("case 16: the same safety rule invented by the model is NOT a known fact when the shopper never said it", () => {
  const noSafetyText = input("A gift for a new baby from a colleague. Budget £30.");
  const r = verifyKnownFacts(facts(["Avoid sleep-positioning products", "Avoid sleep-positioning products"]), deriveRecipient(noSafetyText));
  assert.equal(r.verified.length, 0);
  assert.equal(r.unverified[0].reason, "evidence_not_in_input");
});

test("case 25: an unknown-preferences brief supports 'thoughtful but neutral', but a made-up hobby is rejected", () => {
  const ctx = deriveRecipient(CASE25);
  const ok = verifyKnownFacts(facts(["Wants something thoughtful but neutral", "something thoughtful but neutral"], ["Budget around £20", "around £20"]), ctx);
  assert.equal(ok.verified.length, 2);
  const bad = verifyKnownFacts(facts(["Enjoys cooking", "enjoys cooking"], ["Likes neutral colours", "neutral colours"]), ctx);
  assert.equal(bad.verified.length, 0);
  assert.equal(bad.unverified.length, 2);
});

test("case 26: stated dislikes are verified; a missing or fabricated quote is not", () => {
  const ctx = deriveRecipient(CASE26);
  const r = verifyKnownFacts(facts(
    ["Dislikes technology gifts, fragrances, clutter and gimmicks", "dislikes technology gifts, fragrances, clutter and gimmicks"],
    ["Budget £45", "Budget £45"],
    ["Loves fountain pens", "loves fountain pens"],
    ["Is an architect", ""],
  ), ctx);
  assert.equal(r.verified.length, 2);
  assert.deepEqual(r.unverified.map((u) => u.reason), ["evidence_not_in_input", "no_evidence"]);
});

test("evidence matching ignores case and punctuation but not substance", () => {
  const ctx = deriveRecipient(CASE26);
  assert.equal(verifyKnownFacts(facts(["Budget", "BUDGET   £45!"]), ctx).verified.length, 1);
  assert.equal(verifyKnownFacts(facts(["Budget", "budget £450"]), ctx).verified.length, 0);
});

test("legacy plain-string facts are only accepted when they appear in the input", () => {
  const ctx = deriveRecipient(CASE26);
  const r = verifyKnownFacts({ recipient_profile: { known_facts: ["dislikes technology gifts", "wants sleep products"] } }, ctx);
  assert.equal(r.verified.length, 1);
  assert.equal(r.unverified.length, 1);
});

test("unverified facts are reported in diagnostics and never used to build the summary", () => {
  const raw = {
    recipient_profile: { ...facts(["Loves fountain pens", "loves fountain pens"], ["Dislikes clutter", "dislikes technology gifts, fragrances, clutter"]).recipient_profile },
    recipient_summary: "A fountain pen enthusiast who adores calligraphy.",
    ideas: [idea("Pocket notebook", "pocket notebook"), idea("Pencil case", "canvas pencil case")],
  };
  const r = curateIdeas(raw, CASE26);
  assert.ok(!/fountain|calligraphy/i.test(r.recipientSummary), r.recipientSummary);
  assert.equal(r.diagnostics.facts_unverified.length, 1);
  assert.equal(r.diagnostics.facts_verified, 1);
  assert.ok(r.diagnostics.issues.some((i) => i.code === "fact_unverified"));
  assert.ok(r.diagnostics.issues.some((i) => i.code === "summary_unsupported_by_input"));
});

test("a summary grounded in the shopper's words is kept (positive control)", () => {
  const r = curateIdeas({
    recipient_summary: "Dislikes clutter and gimmicks; enjoys making practical notes.",
    ...facts(["Dislikes clutter", "clutter and gimmicks"]),
    ideas: [idea("Pocket notebook", "pocket notebook")],
  }, CASE26);
  assert.equal(r.recipientSummary, "Dislikes clutter and gimmicks; enjoys making practical notes.");
});

test("small doll-family sets are rejected for a four-year-old, but a large soft doll remains a positive control", () => {
  const ctx = input("My friend has a four-year-old daughter who enjoys imaginative play. Her parents prefer quiet toys without tiny loose pieces.");
  const blocked = curateIdeas({ recipient_summary: "", ideas: [idea("Doll family set for a dolls house", "doll family figures set", "Small figures for imaginative play.") ] }, ctx);
  assert.equal(blocked.ideas.length, 0);
  assert.ok(rejectionCodes(blocked).includes("small_loose_parts"));
  const safe = curateIdeas({ recipient_summary: "", ideas: [idea("Large soft doll", "large soft doll toy", "A large soft doll for imaginative play.")] }, ctx);
  assert.equal(safe.ideas.length, 1);
  assert.equal(safe.ideas[0].title, "Large soft doll");
});

test("summaries that invent preferences are replaced, including for unknown-preference recipients", () => {
  const r = curateIdeas({
    recipient_summary: "Loves cooking and enjoys hiking in the countryside.",
    ...facts(["Budget around £20", "around £20"]),
    ideas: [idea("Scented candle", "soy candle")],
  }, CASE25);
  assert.ok(!/cooking|hiking/i.test(r.recipientSummary));
});

// ---------- truncation stays distinguishable ----------

test("a truncated benchmark response is status 'truncated', never 'completed'", () => {
  const model = { key: "haiku", id: "claude-haiku-5-5", input: 0.1, output: 0.5 };
  const output = { recipient_summary: "", ideas: [idea("Tea infuser", "tea infuser")] };
  const usage = { input_tokens: 4000, output_tokens: 4500, output_tokens_details: { thinking_tokens: 3000 } };
  const cut = buildResultRecord({ caseId: "case-x", model, response: { output, usage, stop_reason: "max_tokens" }, input: input("My aunt loves tea."), blindLabel: "A", latencyMs: 1 });
  const fine = buildResultRecord({ caseId: "case-x", model, response: { output, usage, stop_reason: "tool_use" }, input: input("My aunt loves tea."), blindLabel: "A", latencyMs: 1 });
  assert.equal(cut.status, "truncated");
  assert.equal(cut.truncated, true);
  assert.ok(cut.auto_flags.includes("TRUNCATED_max_tokens"));
  assert.equal(fine.status, "completed");
  assert.equal(fine.truncated, false);
  assert.equal(cut.thinking_tokens, 3000);
  assert.equal(cut.effort, "low");
});
