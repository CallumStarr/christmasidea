import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleRequest, normaliseInput } from "../src/core.js";
import { CATEGORIES } from "../src/constants.js";
import { CONCEPT_BY_KEY, conceptKey, matchConcept } from "../src/engine/concepts.js";
import { feedbackKeys } from "../src/engine/feedback.js";
import { CONCEPTS, GRAPH_VERSION } from "../src/engine/interest-graph.js";
import { understand } from "../src/engine/index.js";
import { KNOWLEDGE_POLICY } from "../src/engine/knowledge-policy.js";
import {
  assessKnowledge, knowledgeCsv, reusableProfile, reuseKnowledge, supportedConcept, utcDay, wilsonLowerBound,
} from "../src/engine/knowledge.js";
import { applyLearning, learningContext } from "../src/engine/learning.js";
import { proposeKnowledge } from "../scripts/review-knowledge.mjs";
import { evaluateKnowledge } from "../scripts/evaluate-knowledge.mjs";

const now = new Date("2026-11-06T14:00:00Z");
const input = normaliseInput({ mode: "describe", description: "My 8-year-old son loves trains. Budget \u00a350." }).value;
const enabled = { KNOWLEDGE_REUSE_ENABLED: "true" };
const context = learningContext(input);
// Synthetic evidence exercises routing, not real-world gift quality or eligibility for a release.
function fixture() {
  return {
    version: "knowledge-v1", approved: true, evidence: "signed-card-v1", graph: GRAPH_VERSION,
    evidenceThrough: "2026-11-05", expiresAt: "2026-12-01",
    cells: CONCEPTS.map((concept) => ({
      ...context, category: concept.category, concept: conceptKey(concept),
      shown: 200, good: 40, bad: 0, lastRated: "2026-11-04",
    })),
  };
}
const first = CONCEPTS[0];
const cell = fixture().cells[0];

test("concept identity is controlled, stable, conservative and does not retain personal prose", () => {
  assert.equal(CONCEPT_BY_KEY.size, CONCEPTS.length, "query-derived keys must be unique");
  assert.equal(matchConcept({ title: first.title, query: first.query }), conceptKey(first));
  assert.equal(matchConcept({ title: "Alice's private novel gift", query: "private rare thing" }), null);
  assert.equal(matchConcept({ title: CONCEPTS[0].title, query: CONCEPTS[10].query }), null, "conflicting known identities must not share feedback");
  assert.equal(matchConcept({ title: "Unrelated private diary", query: first.query }), null, "an exact query alone cannot override a conflicting title");
  const [idea] = applyLearning([{ title: first.title, query: first.query, category: first.category }], input);
  assert.equal(idea.learning.concept, conceptKey(first));
  assert.equal(idea.learning.graph, GRAPH_VERSION);
  assert.doesNotMatch(JSON.stringify(idea.learning), /description|8-year|Budget|son/);
});

test("concept counters accept only controlled identities, graph version and matching categories", () => {
  const learning = { ...cell, policy: "control-v1", graph: GRAPH_VERSION, singleTopic: true };
  const item = { source: "graph", strategy: "core-interest", position: 0, learning };
  const recorded = feedbackKeys({ event: "good", item }, { verified: true });
  assert.equal(recorded.keys.length, 6);
  assert.ok(recorded.keys.includes(`V|good|trains|child|30-50|${CATEGORIES.indexOf(first.category)}|control-v1|0|${cell.concept}|${GRAPH_VERSION}`));
  for (const change of [{ concept: "private-name" }, { graph: "old-graph" }, { category: "Books" }]) {
    assert.ok(feedbackKeys({ event: "good", item: { ...item, learning: { ...learning, ...change } } }, { verified: true }).keys.every((key) => !key.startsWith("V|")));
  }
  const batch = feedbackKeys({ event: "shown", items: Array.from({ length: 12 }, (_, position) => ({ ...item, position })) }, { verified: true });
  assert.equal(batch.keys.length, 72, "all concept and category counters fit the 80-key storage cap");
  assert.ok(Buffer.byteLength(JSON.stringify({ event: "shown", items: Array.from({ length: 12 }, (_, position) => ({ ...item,
    position, learning: { topic: learning.topic, age: learning.age, budget: learning.budget, category: learning.category,
      policy: learning.policy, concept: learning.concept, graph: learning.graph } })) })) < 4000);
});

test("support and uncertainty guards test exact thresholds rather than click volume", () => {
  assert.ok(wilsonLowerBound(40, 0) > 0.9);
  assert.equal(wilsonLowerBound(0, 0), 0);
  assert.equal(supportedConcept({ ...cell, shown: 199 }), false);
  assert.equal(supportedConcept({ ...cell, good: 29 }), false);
  assert.equal(supportedConcept({ ...cell, good: 30 }), true);
  assert.equal(supportedConcept({ ...cell, good: 20, bad: 20 }), false);
  assert.equal(supportedConcept({ ...cell, good: 201 }), false);
  assert.equal(supportedConcept({ ...cell, good: 0, click: 100000, bought: 10000 }), false);
  assert.equal(supportedConcept({ ...cell, topic: "unknown" }), false);
  assert.equal(supportedConcept({ ...cell, category: "Books" }), false);
});

test("reviewed reuse returns eight grounded, diverse, budget-checked ideas without mutating input", () => {
  const policy = fixture();
  const before = JSON.stringify({ policy, input });
  const result = reuseKnowledge(input, enabled, policy, now);
  assert.equal(result.ideas.length, 8);
  assert.equal(result.knowledgeVersion, policy.version);
  assert.ok(new Set(result.ideas.map((idea) => idea.category)).size >= 3);
  assert.ok(result.ideas.every((idea) => idea.connection && idea.source === "graph"));
  assert.ok(result.ideas.some((idea) => /train/i.test(idea.title)));
  assert.ok(result.ideas.every((idea) => idea.productSpec.budgetMaxGbp === 50));
  assert.equal(JSON.stringify({ policy, input }), before);
});

test("routing abstains on disabled, unapproved, stale, future, mismatched and thin knowledge", () => {
  assert.equal(reuseKnowledge(input, {}, fixture(), now), null);
  for (const patch of [
    { approved: false }, { evidence: "legacy" }, { version: "control-v1" }, { cells: {} }, { graph: "old" }, { evidenceThrough: "2026-11-06" },
    { expiresAt: "2026-11-06" }, { expiresAt: "2027-01-01" }, { expiresAt: "2026-02-31" },
    { evidenceThrough: "2026-09-01" }, { cells: fixture().cells.slice(0, 4) },
    { cells: fixture().cells.map((entry) => ({ ...entry, lastRated: "2026-09-01" })) },
    { cells: fixture().cells.map((entry) => ({ ...entry, budget: "15-30" })) },
    { cells: fixture().cells.map((entry) => ({ ...entry, lastRated: "2026-11-06" })) },
    { cells: fixture().cells.filter((entry) => entry.category === "Games & toys") },
  ]) assert.equal(reuseKnowledge(input, enabled, { ...fixture(), ...patch }, now), null, JSON.stringify(patch).slice(0, 100));
  assert.equal(utcDay("2026-02-31"), null);
});

test("profile understanding abstains on unknown interests, identifiers, nuanced needs and unknown age or budget", () => {
  assert.equal(reusableProfile(input, understand(input)), true);
  for (const description of [
    "My 8-year-old son loves trains and speleology. Budget \u00a350.",
    "My 8-year-old son loves trains and dinosaurs. Budget \u00a350.",
    "My creative 8-year-old son loves trains. Budget \u00a350.",
    "My 8-year-old son loves trains and \u56f4\u68cb. Budget \u00a350.",
    "My 8-year-old son loves trains 12345. Budget \u00a350.",
    "Alice is 8 and loves trains. Budget \u00a350.",
    "My 8-year-old son loves trains but hates books. Budget \u00a350.",
    "My 8-year-old son loves trains and already has a train set. Budget \u00a350.",
    "My 8-year-old son loves trains and needs sensory support. Budget \u00a350.",
    "My son loves trains. Budget \u00a350.",
    "My 8-year-old son loves trains.",
    "My 2-year-old son loves trains. Budget \u00a350.",
  ]) {
    const value = normaliseInput({ mode: "describe", description }).value;
    assert.equal(reuseKnowledge(value, enabled, fixture(), now), null, description);
  }
});

test("exclusions are revalidated and missing direct coverage returns to Claude", () => {
  const original = reuseKnowledge(input, enabled, fixture(), now);
  const exclude = original.ideas.map((idea) => idea.title);
  const next = reuseKnowledge({ ...input, exclude }, enabled, fixture(), now);
  assert.ok(next === null || next.ideas.every((idea) => !exclude.includes(idea.title)));
  const noDirect = fixture();
  noDirect.cells = noDirect.cells.filter((entry) => !CONCEPT_BY_KEY.get(entry.concept).interests.includes("trains"));
  assert.equal(reuseKnowledge(input, enabled, noDirect, now), null);
});

const csvRow = (event, n, day = "2026-11-04", policy = "control-v1", position = 0) => ({
  bucket: `F${day}`,
  k: `V|${event}|trains|child|30-50|${CATEGORIES.indexOf(first.category)}|${policy}|${position}|${cell.concept}|${GRAPH_VERSION}`, n,
});

test("review uses complete recent control days and explicit ratings, retaining position diagnostics", () => {
  const csv = knowledgeCsv([
    csvRow("shown", 200), csvRow("good", 40), csvRow("click", 100000), csvRow("bought", 100000),
    csvRow("bad", 200, "2026-11-04", "knowledge-v1"),
    csvRow("bad", 200, "2026-11-06"), csvRow("bad", 200, "2026-08-01"),
  ]);
  const proposal = proposeKnowledge(csv, now);
  assert.equal(proposal.approved, false);
  assert.equal(proposal.cells.length, 1);
  assert.equal(proposal.cells[0].good, 40);
  assert.equal(proposal.cells[0].bad, 0);
  assert.deepEqual(proposal.cells[0].positions["0"], { shown: 200, good: 40, bad: 0 });
  assert.equal(proposal.evidenceThrough, "2026-11-05");
  assert.equal(proposal.expiresAt, "2026-12-06");
  assert.equal(proposal.review.excludedRows, 5);
  assert.equal(proposeKnowledge(knowledgeCsv([csvRow("shown", 200), csvRow("good", 40, "2026-10-01")]), now).cells.length, 0);
});

test("review rejects malformed, duplicated or unsafe exports", () => {
  const csv = knowledgeCsv([csvRow("shown", 200), csvRow("good", 40)]);
  assert.throws(() => proposeKnowledge(csv.replace('"trains"', '"=private"'), now), /Invalid knowledge dimensions/);
  assert.throws(() => proposeKnowledge(knowledgeCsv([csvRow("shown", 200), csvRow("shown", 200)]), now), /Duplicate/);
  assert.throws(() => proposeKnowledge(csv.replace('"200"', '"9007199254740992"'), now), /Invalid knowledge dimensions/);
  assert.throws(() => proposeKnowledge("bad header", now), /schema/);
  const legacy = knowledgeCsv([csvRow("shown", 200), csvRow("good", 40)].map((row) => ({ ...row, k: row.k.replace(/^V/, "K") })));
  assert.equal(proposeKnowledge(legacy, now).cells.length, 0, "old unverified evidence is never promoted");
});

test("multi-interest and trait-influenced searches cannot supply single-topic reuse evidence", () => {
  for (const description of [
    "My 8-year-old son loves trains and dinosaurs. Budget \u00a350.",
    "My creative 8-year-old son loves trains. Budget \u00a350.",
  ]) {
    const request = normaliseInput({ mode: "describe", description }).value;
    const [idea] = applyLearning([{ title: first.title, query: first.query, category: first.category, source: "graph" }], request);
    assert.equal(idea.learning.singleTopic, false);
    const result = feedbackKeys({ event: "good", item: { ...idea, position: 0 } }, { verified: true });
    assert.ok(result.keys.every((key) => !key.startsWith("V|")));
  }
});

test("offline readiness reports exact bypass and abstention counts without claiming recommendation quality", () => {
  const cases = [
    { id: "supported", input, set: "simple" },
    { id: "unknown", input: { ...input, description: `${input.description} Speleology.` }, set: "long-tail" },
  ];
  const report = evaluateKnowledge(cases, fixture(), now);
  assert.equal(report.cases, 2);
  assert.equal(report.reused, 1);
  assert.equal(report.bypassFraction, 0.5);
  assert.deepEqual(report.reasons, { reused: 1, "unsupported-profile": 1 });
  assert.deepEqual(report.bySet.simple, { cases: 1, reused: 1 });
  assert.equal(report.qualityClaim, false);
  assert.equal(report.structure.mean_shown, 8);
  assert.equal(report.structure.total_match_cap_over_budget, 0);
  assert.equal(report.structure.total_near_duplicate_pairs, 0);
  assert.doesNotMatch(JSON.stringify(report), /description|Speleology|8-year/);
  assert.equal(assessKnowledge(input, enabled, { ...fixture(), evidence: "legacy" }, now).reason, "invalid-policy");
  assert.equal(assessKnowledge(input, enabled, { ...fixture(), cells: [] }, now).reason, "insufficient-evidence");
  assert.throws(() => evaluateKnowledge([], fixture(), now), /non-empty/);
  assert.throws(() => evaluateKnowledge([cases[0], cases[0]], fixture(), now), /unique/);
  assert.throws(() => evaluateKnowledge([{ id: "bad", input: {} }], fixture(), now), /Invalid evaluation input/);
});

const ORIGIN = "https://gifts.example.com";
const env = { ...enabled, ALLOWED_ORIGINS: ORIGIN, IP_SALT: "test-ip-salt-0123456789abcdef01234567",
  FEEDBACK_ADMIN_TOKEN: "test-admin-token-0123456789abcdef01234567", ANTHROPIC_API_KEY: "test-key" };
const request = (path, body, token = "") => new Request(`${ORIGIN}${path}`, {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

test("knowledge export is authenticated, paginated and separate from category export", async () => {
  let calls = 0;
  const deps = { feedback: { export: async (after, kind) => {
    calls++;
    assert.equal(kind, "V");
    assert.equal(after, undefined);
    return { rows: [csvRow("good", 40)], next: { bucket: "F2026-11-04", key: csvRow("good", 40).k } };
  } } };
  assert.equal((await handleRequest(request("/api/knowledge/export", {}), env, deps)).status, 401);
  assert.equal(calls, 0);
  assert.equal((await handleRequest(request("/api/knowledge/export", { after: { bucket: "F2026-11-04", key: "L|shown" } }, env.FEEDBACK_ADMIN_TOKEN), env, deps)).status, 400);
  const response = await handleRequest(request("/api/knowledge/export", {}, env.FEEDBACK_ADMIN_TOKEN), env, deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(response.headers.get("X-Feedback-Next"));
  assert.match(await response.text(), /position,concept,graph,evidence,count/);
  assert.equal(calls, 1);
});

test("real API routing skips Claude and AI budget only with fresh approved evidence; reuse remains rate limited", async () => {
  const original = { ...KNOWLEDGE_POLICY };
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400_000).toISOString().slice(0, 10);
  const policy = fixture();
  policy.evidenceThrough = yesterday;
  policy.expiresAt = new Date(today.getTime() + 10 * 86400_000).toISOString().slice(0, 10);
  policy.cells = policy.cells.map((entry) => ({ ...entry, lastRated: yesterday }));
  Object.assign(KNOWLEDGE_POLICY, policy);
  let reuseCalls = 0;
  let allowed = true;
  const deps = {
    fetch: async () => assert.fail("Claude must not be called for a reviewed library hit"),
    budget: { consume: async () => assert.fail("AI budget must not be consumed"), reuse: async () => {
      reuseCalls++; return { ok: allowed };
    } },
  };
  try {
    const response = await handleRequest(request("/api/ideas", input), { ...env, ANTHROPIC_API_KEY: "" }, deps);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.source, "knowledge");
    assert.equal(result.ideas.length, 8);
    assert.ok(result.ideas.every((idea) => idea.learning.policy === KNOWLEDGE_POLICY.version));
    assert.equal(reuseCalls, 1);
    allowed = false;
    assert.equal((await handleRequest(request("/api/ideas", input), env, deps)).status, 429);
    const blocked = await handleRequest(request("/api/ideas", input), { ...env, TURNSTILE_SECRET: "test" }, {
      ...deps, fetch: async () => assert.fail("No token should fail before provider calls"),
    });
    assert.equal(blocked.status, 403);
  } finally {
    Object.assign(KNOWLEDGE_POLICY, original);
  }
});

test("empty shipped library preserves Claude behavior; web and mobile receive controlled metadata", async () => {
  assert.equal(KNOWLEDGE_POLICY.approved, false);
  let calls = 0;
  const response = await handleRequest(request("/api/ideas", input), env, {
    budget: { consume: async () => ({ ok: true }) },
    fetch: async () => {
      calls++;
      return Response.json({ content: [{ type: "tool_use", name: "gift_ideas", input: { ideas: [] } }] });
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).source, "ai");
  assert.equal(calls, 1);
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(html, /learning: idea\.learning/);
  assert.match(html, /out\.source === "knowledge"/);
  assert.match(html, /prefetchPaused = out\.source !== "ai"/, "reviewed-library results must not cause endless automatic requests");
});
