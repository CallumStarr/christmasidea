import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { acknowledgeFeedbackReview, initialiseFeedbackReview, prepareFeedbackReview, pruneFeedbackReview } from "../src/engine/feedback-review.js";
import { notifyFeedback } from "../scripts/notify-feedback.mjs";
import { handleRequest } from "../src/core.js";

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec("CREATE TABLE usage (bucket TEXT, k TEXT, n INTEGER, PRIMARY KEY (bucket, k))");
  const sql = {
    exec(query, ...params) {
      const statement = db.prepare(query);
      if (!statement.columns().length) { statement.run(...params); return; }
      const rows = statement.all(...params);
      return { toArray: () => rows, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
  initialiseFeedbackReview(sql);
  const add = (day, event, n, { category = 3, policy = "control-v1", position = 0, topic = "trains" } = {}) => {
    db.prepare("INSERT INTO usage VALUES (?, ?, ?) ON CONFLICT(bucket, k) DO UPDATE SET n = n + excluded.n")
      .run(`F${day}`, `L|${event}|${topic}|child|15-30|${category}|${policy}|${position}`, n);
    db.prepare("INSERT INTO usage VALUES (?, ?, ?) ON CONFLICT(bucket, k) DO UPDATE SET n = n + excluded.n")
      .run(`F${day}`, `${event}|src:model`, n);
  };
  const check = (day = "2026-11-05") => prepareFeedbackReview(sql, new Date(`${day}T04:00:00Z`));
  return { db, sql, add, check };
}

test("usage and quality readiness have independent thresholds", (t) => {
  const { add, check, sql } = fixture(t);
  add("2026-11-04", "shown", 199);
  add("2026-11-04", "good", 29);
  add("2026-11-04", "click", 500);
  add("2026-11-04", "bought", 500);
  add("2026-11-04", "good", 500, { policy: "reviewed-v1" });
  assert.equal(check().id, null);
  add("2026-11-04", "shown", 1);
  const usage = check();
  assert.equal(usage.usage.shown, 200);
  assert.equal(usage.cohorts.length, 0);
  acknowledgeFeedbackReview(sql, usage.id);
  add("2026-11-04", "bad", 1);
  const report = check();
  assert.equal(report.cohorts.length, 1);
  assert.deepEqual(report.thresholds, { shown: 200, ratings: 30 });
  assert.equal(report.cohorts[0].new_ratings, 30);
  assert.equal(report.cohorts[0].shown, 200);
  assert.equal(report.cohorts[0].policy, "control-v1");
});

test("open days and expired counters are excluded, positions are combined", (t) => {
  const { add, check } = fixture(t);
  for (const day of ["2026-08-07", "2026-11-05"]) {
    add(day, "shown", 200);
    add(day, "good", 30);
  }
  assert.equal(check().id, null);
  add("2026-11-04", "shown", 100, { position: 0 });
  add("2026-11-04", "shown", 100, { position: 1 });
  add("2026-11-04", "good", 15, { position: 0 });
  add("2026-11-04", "bad", 15, { position: 1 });
  assert.equal(check().cohorts[0].shown, 200);
});

test("delivery retries return a stable snapshot until acknowledgement", (t) => {
  const { add, check, sql } = fixture(t);
  add("2026-11-04", "shown", 200);
  add("2026-11-04", "good", 30);
  const report = check();
  add("2026-11-05", "shown", 200);
  add("2026-11-05", "good", 30);
  assert.deepEqual(check("2026-11-06"), report);
  assert.equal(acknowledgeFeedbackReview(sql, "wrong").ok, false);
  assert.deepEqual(check("2026-11-06"), report);
  assert.equal(acknowledgeFeedbackReview(sql, report.id).acknowledged, true);
  assert.equal(acknowledgeFeedbackReview(sql, report.id).acknowledged, false);
  const next = check("2026-11-06");
  assert.notEqual(next.id, report.id);
  assert.equal(next.cohorts[0].new_shown, 200, "events after frozen cutoff survive acknowledgement");
});

test("reminders require both additional shown cards and additional ratings", (t) => {
  const { add, check, sql } = fixture(t);
  add("2026-11-04", "shown", 200);
  add("2026-11-04", "good", 30);
  acknowledgeFeedbackReview(sql, check().id);
  assert.equal(check("2026-11-06").id, null);
  add("2026-11-05", "shown", 200);
  add("2026-11-05", "bad", 29);
  const usage = check("2026-11-06");
  assert.equal(usage.cohorts.length, 0);
  assert.equal(usage.usage.new_shown, 200);
  acknowledgeFeedbackReview(sql, usage.id);
  add("2026-11-05", "bad", 1);
  assert.equal(check("2026-11-06").cohorts[0].last_notified_through, "F2026-11-04");
});

test("site-wide shown alerts combine small cohorts and do not require ratings", (t) => {
  const { add, check, sql } = fixture(t);
  add("2026-11-04", "shown", 100, { category: 0 });
  add("2026-11-04", "shown", 99, { category: 3, policy: "reviewed-v1" });
  assert.equal(check().id, null);
  add("2026-11-04", "shown", 1, { category: 3, policy: "reviewed-v1" });
  const report = check();
  assert.equal(report.cohorts.length, 0);
  assert.equal(report.usage.shown, 200, "marginal and joint counters are not double counted");
  assert.equal(report.usage.good, 0);
  acknowledgeFeedbackReview(sql, report.id);
  assert.equal(check().id, null);
  add("2026-11-05", "shown", 199);
  add("2026-11-05", "click", 1000);
  assert.equal(check("2026-11-06").id, null);
  add("2026-11-05", "shown", 1);
  const reminder = check("2026-11-06");
  assert.equal(reminder.usage.new_shown, 200);
  assert.equal(reminder.usage.shown, 400);
  assert.equal(reminder.usage.last_notified_through, "F2026-11-04");
  assert.equal(reminder.cohorts.length, 0);
});

test("site alert counts historical cards without learning metadata and ignores duplicated dimensions", (t) => {
  const { db, check } = fixture(t);
  const insert = db.prepare("INSERT INTO usage VALUES (?, ?, ?)");
  insert.run("F2026-11-04", "shown|src:catalogue", 199);
  insert.run("F2026-11-04", "shown|p:0", 199);
  insert.run("F2026-11-04", "shown|s:unknown", 199);
  assert.equal(check().id, null);
  insert.run("F2026-11-04", "shown|src:graph", 1);
  assert.equal(check().usage.shown, 200);
});

test("old pending rated-only reports retain delivery IDs and do not acknowledge new site alerts", (t) => {
  const { add, check, sql, db } = fixture(t);
  add("2026-11-04", "shown", 200);
  add("2026-11-04", "good", 30);
  const report = check();
  delete report.usage;
  db.prepare("UPDATE feedback_review_pending SET payload = ?").run(JSON.stringify(report));
  assert.deepEqual(check(), report);
  acknowledgeFeedbackReview(sql, report.id);
  const usage = check();
  assert.equal(usage.usage.shown, 200);
  assert.equal(usage.cohorts.length, 0);
});

test("independent cohorts notify independently and invalid rating totals do not trigger", (t) => {
  const { add, check, sql } = fixture(t);
  add("2026-11-04", "shown", 200);
  add("2026-11-04", "good", 30);
  add("2026-11-04", "shown", 200, { category: 0 });
  add("2026-11-04", "good", 201, { category: 0 });
  const first = check();
  assert.equal(first.cohorts.length, 1);
  acknowledgeFeedbackReview(sql, first.id);
  add("2026-11-05", "shown", 1, { category: 0 });
  const next = check("2026-11-06");
  assert.equal(next.cohorts.length, 1);
  assert.equal(next.cohorts[0].category, "Tech");
});

test("scheduled pruning removes undelivered snapshots at the 90-day cutoff", (t) => {
  const { add, check, sql, db } = fixture(t);
  add("2026-11-04", "shown", 200);
  add("2026-11-04", "good", 30);
  check();
  pruneFeedbackReview(sql, new Date("2027-02-02T04:00:00Z"));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM feedback_review_pending").get().n, 0);
  assert.equal(check("2027-02-02").id, null);
});

test("batched alerts cap at 50 cohorts and leave the remainder for the next check", (t) => {
  const { add, check, sql } = fixture(t);
  for (const topic of ["trains", "unknown", "dinosaurs", "vehicles", "space"]) {
    for (let category = 0; category < 12; category++) {
      add("2026-11-04", "shown", 200, { topic, category });
      add("2026-11-04", "good", 30, { topic, category });
    }
  }
  const first = check();
  assert.equal(first.cohorts.length, 50);
  acknowledgeFeedbackReview(sql, first.id);
  initialiseFeedbackReview(sql);
  assert.equal(check().cohorts.length, 10, "schema reinitialisation preserves delivery checkpoints");
});

const adminEnv = { ALLOWED_ORIGINS: "https://christmasidea.co.uk", FEEDBACK_ADMIN_TOKEN: "test-admin-notification-0123456789" };
function adminRequest(body, token = adminEnv.FEEDBACK_ADMIN_TOKEN, method = "POST") {
  return new Request("https://christmasidea.co.uk/api/feedback/review", {
    method, headers: { Origin: adminEnv.ALLOWED_ORIGINS, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

test("review endpoint shares export authentication, validates actions and surfaces conflicts", async () => {
  const calls = [];
  const deps = { adminAuth: { reserve: async () => ({ ok: true, bucket: "H2026-11-06T21" }), release: async () => true }, feedback: { review: async (...args) => { calls.push(args); return { ok: false, error: "Changed" }; } } };
  assert.equal((await handleRequest(adminRequest({ action: "check" }, "wrong"), adminEnv, deps)).status, 401);
  assert.equal((await handleRequest(adminRequest({ action: "check" }, undefined, "GET"), adminEnv, deps)).status, 405);
  assert.equal((await handleRequest(adminRequest({ action: "ack", id: "wrong" }), adminEnv, deps)).status, 400);
  assert.equal((await handleRequest(adminRequest({ action: "train" }), adminEnv, deps)).status, 400);
  assert.equal((await handleRequest(adminRequest({ action: "check" }), adminEnv, {})).status, 503);
  assert.equal(calls.length, 0);
  const response = await handleRequest(adminRequest({ action: "check" }), adminEnv, deps);
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, [["check", undefined]]);
});

function deliveryFixture(t, options = {}) {
  const { add, check, sql } = fixture(t);
  add("2026-11-04", "shown", 200);
  if (!options.usageOnly) add("2026-11-04", "good", 30);
  const report = check();
  const issues = [];
  const calls = [];
  let failAck = options.failAck;
  const env = { FEEDBACK_ADMIN_TOKEN: adminEnv.FEEDBACK_ADMIN_TOKEN, GITHUB_TOKEN: "test-github", GITHUB_REPOSITORY: "example/gifts" };
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/api/feedback/review")) {
      const body = JSON.parse(init.body);
      if (body.action === "check") return Response.json(check());
      if (failAck) { failAck = false; return new Response("", { status: 503 }); }
      return Response.json(acknowledgeFeedbackReview(sql, body.id));
    }
    if (init.method === "POST") {
      if (options.failIssue) return new Response("", { status: 403 });
      issues.push({ ...JSON.parse(init.body), html_url: "https://github.com/example/gifts/issues/1" });
      return Response.json(issues.at(-1), { status: 201 });
    }
    return Response.json(issues);
  };
  return { env, fetchImpl, issues, calls, report, check };
}

test("daily automation is quiet below threshold and never contacts GitHub", async () => {
  const calls = [];
  const result = await notifyFeedback({
    env: { FEEDBACK_ADMIN_TOKEN: adminEnv.FEEDBACK_ADMIN_TOKEN, GITHUB_TOKEN: "test-github", GITHUB_REPOSITORY: "example/gifts" },
    fetchImpl: async (url) => { calls.push(url); return Response.json({ id: null, cohorts: [] }); },
  });
  assert.equal(result.notified, false);
  assert.equal(calls.length, 1);
});

test("successful delivery contains a review summary, not an attachment or credentials", async (t) => {
  const f = deliveryFixture(t);
  const result = await notifyFeedback(f);
  assert.equal(result.notified, true);
  assert.equal(f.issues.length, 1);
  assert.match(f.issues[0].body, /not proven statistical significance/);
  assert.match(f.issues[0].body, /https:\/\/github.com\/example\/gifts\/blob\/HEAD/);
  assert.doesNotMatch(f.issues[0].body, /test-admin|test-github|recipient description:/);
  assert.equal(f.check().id, null);
  assert.equal((await notifyFeedback(f)).notified, false);
});

test("failed GitHub delivery leaves checkpoint untouched", async (t) => {
  const f = deliveryFixture(t, { failIssue: true });
  await assert.rejects(notifyFeedback(f), /GitHub notification failed \(403\)/);
  assert.equal(f.check().id, f.report.id);
  assert.equal(f.calls.filter((c) => c.init.body && JSON.parse(c.init.body).action === "ack").length, 0);
});

test("delivery retries after failed acknowledgement reuse even a closed issue", async (t) => {
  const f = deliveryFixture(t, { failAck: true });
  await assert.rejects(notifyFeedback(f), /Feedback review request failed \(503\)/);
  f.issues[0].state = "closed";
  assert.equal(f.check().id, f.report.id);
  await notifyFeedback(f);
  assert.equal(f.issues.length, 1);
  assert.equal(f.check().id, null);
});

test("usage-only delivery triggers without cohorts, explains limitations and deduplicates retries", async (t) => {
  const f = deliveryFixture(t, { usageOnly: true, failAck: true });
  assert.equal(f.report.cohorts.length, 0);
  await assert.rejects(notifyFeedback(f), /Feedback review request failed/);
  assert.match(f.issues[0].body, /Site-wide usage data ready for analysis/);
  assert.match(f.issues[0].body, /no ratings are required/);
  assert.match(f.issues[0].body, /shown cards alone cannot approve ranking updates/);
  assert.doesNotMatch(f.issues[0].body, /Rated cohorts ready for quality review/);
  assert.equal((await notifyFeedback(f)).notified, true);
  assert.equal(f.issues.length, 1);
  assert.equal((await notifyFeedback(f)).notified, false);
});

test("issue lookup paginates without using eventually consistent search", async (t) => {
  const f = deliveryFixture(t);
  const original = f.fetchImpl;
  f.fetchImpl = async (url, init) => {
    if (new URL(url).searchParams.get("page") === "1") return Response.json(Array.from({ length: 100 }, () => ({ body: "Other issue" })));
    return original(url, init);
  };
  await notifyFeedback(f);
  assert.ok(f.calls.some((c) => c.url.includes("page=2")));
});

test("missing secrets and transport failures surface errors without acknowledgement", async () => {
  await assert.rejects(notifyFeedback({ env: {} }), /Actions secret/);
  await assert.rejects(notifyFeedback({
    env: { FEEDBACK_ADMIN_TOKEN: adminEnv.FEEDBACK_ADMIN_TOKEN, GITHUB_TOKEN: "test", GITHUB_REPOSITORY: "example/gifts" },
    fetchImpl: async () => { throw new Error("Network unavailable"); },
  }), /Network unavailable/);
});

test("workflow runs daily with deduplication and only issue-write permissions", async () => {
  const workflow = await readFile(new URL("../.github/workflows/feedback-review.yml", import.meta.url), "utf8");
  assert.match(workflow, /cron: "0 4 \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /issues: write/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /secrets\.FEEDBACK_ADMIN_TOKEN/);
  assert.match(workflow, /vars\.FEEDBACK_REVIEW_NOTIFICATIONS_ENABLED == 'true'/);
  assert.doesNotMatch(workflow, /npm ci|wrangler deploy|contents: write/);
});
