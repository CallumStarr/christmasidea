import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { issueFeedbackReceipts, RECEIPT_LIFETIME_MS, verifyFeedbackReceipts } from "../src/engine/feedback-receipts.js";
import { initialiseFeedbackReceipts, pruneFeedbackReceipts, recordVerifiedFeedback } from "../src/engine/feedback-storage.js";
import { feedbackKeys } from "../src/engine/feedback.js";
import { CONCEPTS, GRAPH_VERSION } from "../src/engine/interest-graph.js";
import { conceptKey } from "../src/engine/concepts.js";
import { applyLearning, feedbackCsv } from "../src/engine/learning.js";
import { handleRequest, normaliseInput } from "../src/core.js";
import { fetchProducts, sendFeedback } from "../site/api.js";
import { proposePolicy } from "../scripts/review-feedback.mjs";

const now = Date.parse("2026-11-06T15:00:00Z");
const env = { IP_SALT: "receipt-test-salt-0123456789abcdef01234567", RECEIPT_SIGNING_KEY: "receipt-test-secret-0123456789abcdef01234567", ALLOWED_ORIGINS: "https://gifts.example.com" };
const input = normaliseInput({ mode: "describe", description: "My 8-year-old son loves trains. Budget \u00a350." }).value;
const concept = CONCEPTS[0];
const ideas = applyLearning([{ title: concept.title, query: concept.query, category: concept.category,
  source: "graph", strategy: "adjacent-driver", discovery: true }], input);
const signedItem = async (position = 0) => ({ ...(await issueFeedbackReceipts(ideas, env, now))[0], position });

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec("CREATE TABLE usage (bucket TEXT, k TEXT, n INTEGER, PRIMARY KEY (bucket,k))");
  const sql = { exec(query, ...params) {
    const statement = db.prepare(query);
    if (!statement.columns().length) { statement.run(...params); return; }
    return { toArray: () => statement.all(...params) };
  } };
  initialiseFeedbackReceipts(sql);
  const add = (bucket, key) => db.prepare("INSERT INTO usage VALUES (?, ?, 1) ON CONFLICT(bucket,k) DO UPDATE SET n=n+1").run(bucket, key);
  const record = (records, bucket = "F2026-11-06", at = now) => {
    db.exec("BEGIN");
    try {
      const result = recordVerifiedFeedback(sql, records, bucket, add, at);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const count = (prefix) => db.prepare("SELECT COALESCE(SUM(n),0) AS n FROM usage WHERE k LIKE ?").get(prefix + "%").n;
  return { db, sql, record, count };
}

test("receipts sign controlled metadata only, without recipient text, titles, IPs or secret material", async () => {
  const item = await signedItem();
  const payload = JSON.parse(Buffer.from(item.feedbackToken.split(".")[0], "base64url").toString());
  assert.equal(payload.v, 1);
  assert.equal(payload.expires, now + RECEIPT_LIFETIME_MS);
  assert.equal(payload.item.learning.concept, conceptKey(concept));
  assert.equal(payload.item.learning.singleTopic, true);
  assert.doesNotMatch(JSON.stringify(payload), /description|8-year|Budget|title|IP_SALT|receipt-test-secret/);
  const verified = await verifyFeedbackReceipts({ event: "good", item }, env, now);
  assert.equal(verified.ok, true);
  assert.equal(verified.legacy, false);
  assert.ok(verified.records[0].keys.some((key) => key.startsWith("V|good|")));
  const another = await signedItem();
  assert.notEqual(another.feedbackToken, item.feedbackToken, "cards have independent opaque receipt IDs");
});

test("signed server dimensions win over browser-supplied cohort, source and policy", async () => {
  const item = await signedItem(3);
  const verified = await verifyFeedbackReceipts({ event: "good", item: {
    ...item, source: "model", learning: { ...item.learning, topic: "coffee", policy: "knowledge-v1" },
  } }, env, now);
  assert.equal(verified.ok, true);
  assert.ok(verified.records[0].keys.includes("good|src:graph"));
  assert.ok(verified.records[0].keys.includes("good|p:3"), "display position remains browser reported after photo compaction");
  assert.ok(verified.records[0].keys.some((key) => key.startsWith("V|good|trains|") && key.includes("|control-v1|")));
  assert.ok(verified.records[0].keys.every((key) => !key.includes("coffee")));
});

test("invalid, modified, expired, wrong-key and mixed receipts fail explicitly", async () => {
  const item = await signedItem();
  const [payload, signature] = item.feedbackToken.split(".");
  const edited = JSON.parse(Buffer.from(payload, "base64url").toString());
  edited.item.learning.topic = "coffee";
  const tampered = `${Buffer.from(JSON.stringify(edited)).toString("base64url")}.${signature}`;
  for (const token of ["bad", "", "a.a", `${payload}.${"a".repeat(43)}`, tampered, "x".repeat(2001)]) {
    assert.equal((await verifyFeedbackReceipts({ event: "good", item: { ...item, feedbackToken: token } }, env, now)).ok, false);
  }
  assert.equal((await verifyFeedbackReceipts({ event: "good", item }, env, now + RECEIPT_LIFETIME_MS)).ok, false);
  assert.equal((await verifyFeedbackReceipts({ event: "good", item }, { RECEIPT_SIGNING_KEY: "another-test-secret-0123456789abcdef01234567" }, now)).ok, false);
  assert.equal((await verifyFeedbackReceipts({ event: "shown", items: [item, ideas[0]] }, env, now)).ok, false);
  assert.equal((await verifyFeedbackReceipts({ event: "good", item: { ...item, position: 12 } }, env, now)).ok, false);
  assert.equal((await verifyFeedbackReceipts({ event: "shown", items: Array(13).fill(item) }, env, now)).ok, false);
});

test("unsigned feedback is refused for every event type", async () => {
  const legacy = { ...ideas[0], position: 0 };
  const verified = await verifyFeedbackReceipts({ event: "good", item: legacy }, env, now);
  assert.equal(verified.ok, false);
  for (const event of ["more", "shown", "click", "save", "dismiss", "good", "bad", "bought"]) {
    assert.equal((await verifyFeedbackReceipts({ event, item: legacy, items: [legacy] }, env, now)).ok, false, event);
  }
});

test("receipt-verified cards still contribute learning evidence", async () => {
  const item = await signedItem();
  const { records } = await verifyFeedbackReceipts({ event: "good", item }, env, now);
  assert.ok(records[0].keys.some((key) => key.startsWith("L|good|")));
  assert.ok(records[0].shownKeys.some((key) => key.startsWith("L|shown|")));
});

test("signed more events are counted once per issued card", async (t) => {
  const { record, count } = fixture(t);
  const item = await signedItem();
  const result = await verifyFeedbackReceipts({ event: "more", item }, env, now);
  assert.equal(result.ok, true);
  assert.equal(record(result.records).accepted, 1);
  assert.equal(record(result.records).accepted, 0);
  assert.equal(count("more"), 1);
});

test("forged unsigned feedback cannot manufacture a learning-policy proposal", async () => {
  const counts = new Map();
  const deps = { feedback: { record: async (_ip, keys) => {
    for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
    return { ok: true };
  } } };
  const learning = { topic: "trains", age: "adult", budget: "15-30", category: "Tech", policy: "control-v1" };
  const send = async (body) => (await handleRequest(new Request("https://gifts.example.com/api/feedback", {
    method: "POST", headers: { Origin: "https://gifts.example.com", "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
    body: JSON.stringify(body),
  }), env, deps)).status;
  for (let i = 0; i < 20; i++) {
    assert.equal(await send({ event: "shown", items: Array.from({ length: 12 }, (_, position) => ({ source: "model", strategy: "unknown", position, learning })) }), 400);
  }
  for (let i = 0; i < 40; i++) assert.equal(await send({ event: "good", item: { source: "model", position: 0, learning } }), 400);
  const rows = [...counts].filter(([key]) => key.startsWith("L|")).map(([k, n]) => ({ bucket: "F2026-11-06", k, n }));
  assert.equal(rows.length, 0);
  assert.deepEqual(proposePolicy(feedbackCsv(rows)).cells, []);
  assert.equal(counts.size, 0, "unsigned events never reach storage");
});

test("SQLite deduplicates replayed cards, prevents conflicting ratings, and handles rating before shown", async (t) => {
  const { record, count } = fixture(t);
  const item = await signedItem();
  const good = (await verifyFeedbackReceipts({ event: "good", item }, env, now)).records;
  const shown = (await verifyFeedbackReceipts({ event: "shown", items: [item, item] }, env, now)).records;
  const bad = (await verifyFeedbackReceipts({ event: "bad", item }, env, now)).records;
  assert.equal(record(good).accepted, 1);
  assert.equal(count("V|shown|"), 1, "an explicit interaction establishes one rendered card");
  assert.equal(count("V|good|"), 1);
  assert.equal(record(good).accepted, 0);
  assert.equal(record(shown).accepted, 0);
  assert.equal(record(bad).accepted, 0, "good and bad share a single rating slot");
  assert.equal(count("V|shown|"), 1);
  assert.equal(count("V|good|"), 1);
  assert.equal(count("V|bad|"), 0);
  const bought = (await verifyFeedbackReceipts({ event: "bought", item }, env, now)).records;
  record(bought); record(bought);
  assert.equal(count("V|bought|"), 1, "purchase report is independent but also idempotent");
});

test("expired receipts cannot be replayed after marker pruning, and counters outlive markers", async (t) => {
  const { record, count, sql, db } = fixture(t);
  const item = await signedItem();
  const good = (await verifyFeedbackReceipts({ event: "good", item }, env, now)).records;
  record(good);
  pruneFeedbackReceipts(sql, now + RECEIPT_LIFETIME_MS - 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM feedback_receipts").get().n, 2);
  pruneFeedbackReceipts(sql, now + RECEIPT_LIFETIME_MS);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM feedback_receipts").get().n, 0);
  assert.deepEqual(record(good, "F2026-11-07", now + RECEIPT_LIFETIME_MS), { ok: false, reason: "expired" });
  assert.equal(count("V|good|"), 1);
});

test("failed counter writes roll back receipt markers and allow a safe retry", async (t) => {
  const { sql, db, record, count } = fixture(t);
  const item = await signedItem();
  const good = (await verifyFeedbackReceipts({ event: "good", item }, env, now)).records;
  db.exec("BEGIN");
  assert.throws(() => recordVerifiedFeedback(sql, good, "F2026-11-06", () => { throw new Error("storage failure"); }, now), /storage failure/);
  db.exec("ROLLBACK");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM feedback_receipts").get().n, 0);
  assert.equal(record(good).accepted, 1);
  assert.equal(count("V|good|"), 1);
});

test("full signed 12-card payload fits the endpoint byte limit and carries no free-text fields", async () => {
  const signed = await issueFeedbackReceipts(Array.from({ length: 12 }, () => ideas[0]), env, now);
  const body = { event: "shown", items: signed.map((idea, position) => ({
    strategy: idea.strategy, source: idea.source, position, discovery: idea.discovery, learning: idea.learning, feedbackToken: idea.feedbackToken,
  })) };
  assert.ok(Buffer.byteLength(JSON.stringify(body)) < 16000);
  const verified = await verifyFeedbackReceipts(body, env, now);
  assert.equal(verified.records.length, 12);
});

test("real feedback API validates before storage and passes only server-verified records", async () => {
  const item = { ...(await issueFeedbackReceipts(ideas, env))[0], position: 0 };
  let records;
  const deps = { feedback: { record: async (_hash, keys, value) => {
    assert.deepEqual(keys, []);
    records = value;
    return { ok: true };
  } } };
  const req = (body) => new Request(`${env.ALLOWED_ORIGINS}/api/feedback`, {
    method: "POST", headers: { Origin: env.ALLOWED_ORIGINS, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal((await handleRequest(req({ event: "good", item: { ...item, feedbackToken: "invalid" } }), env, deps)).status, 400);
  assert.equal(records, undefined);
  assert.equal((await handleRequest(req({ event: "good", item }), env, deps)).status, 202);
  assert.equal(records.length, 1);
  assert.ok(records[0].keys.some((key) => key.startsWith("V|good|")));
});

test("browser API forwards immutable-card receipts to product lookup without learning dimensions", async () => {
  const item = { ...(await signedItem()), position: 0 };
  let products;
  await fetchProducts([item], { fetchImpl: async (_url, init) => {
    products = JSON.parse(init.body).ideas;
    return Response.json({ products: [] });
  } });
  assert.equal(products[0].feedbackToken, item.feedbackToken);
  assert.equal(products[0].learning, undefined);
  let feedback;
  await sendFeedback({ event: "good", item }, { enabled: true, fetchImpl: async (_url, init) => {
    feedback = JSON.parse(init.body);
    return Response.json({ recorded: true });
  } });
  assert.equal(feedback.item.feedbackToken, item.feedbackToken);
});
