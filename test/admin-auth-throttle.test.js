import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { adminAuthHourlyLimit, pruneUsageBuckets, releaseAdminAuthAttempt, reserveAdminAuthAttempt } from "../src/budget-storage.js";
import { handleRequest } from "../src/core.js";

function counterAt(clock) {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE usage (bucket TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (bucket, k))");
  const sql = { exec: (query, ...params) => {
    const rows = /^\s*SELECT/i.test(query) ? db.prepare(query).all(...params) : (db.prepare(query).run(...params), []);
    return { toArray: () => rows };
  } };
  return {
    sql,
    buckets: () => pruneUsageBuckets(sql, clock.now),
    count(bucket, k) { return sql.exec("SELECT n FROM usage WHERE bucket = ? AND k = ?", bucket, k).toArray()[0]?.n || 0; },
    add(bucket, k) { sql.exec("INSERT INTO usage (bucket, k, n) VALUES (?, ?, 1) ON CONFLICT(bucket, k) DO UPDATE SET n = n + 1", bucket, k); },
  };
}

test("admin reservations lock out after the limit and expire with the UTC hour", () => {
  const clock = { now: new Date("2026-11-06T21:10:00Z") };
  const counter = counterAt(clock);
  for (let i = 0; i < 10; i++) assert.equal(reserveAdminAuthAttempt(counter, {}, "ip-a").ok, true);
  assert.deepEqual(reserveAdminAuthAttempt(counter, {}, "ip-a"), { ok: false });
  assert.equal(reserveAdminAuthAttempt(counter, {}, "ip-b").ok, true, "the lockout is per visitor");
  clock.now = new Date("2026-11-06T21:59:59Z");
  assert.equal(reserveAdminAuthAttempt(counter, {}, "ip-a").ok, false, "still locked within the hour");
  clock.now = new Date("2026-11-06T22:00:00Z");
  const next = reserveAdminAuthAttempt(counter, {}, "ip-a");
  assert.deepEqual(next, { ok: true, bucket: "H2026-11-06T22" }, "a new hour restores the allowance");
  assert.equal(counter.count("H2026-11-06T21", "adminfail:ip-a"), 0, "expired buckets are pruned");
});

test("admin reservation release refunds only its own bucket and never goes negative", () => {
  const clock = { now: new Date("2026-11-06T21:59:59Z") };
  const counter = counterAt(clock);
  const old = reserveAdminAuthAttempt(counter, {}, "ip-a");
  clock.now = new Date("2026-11-06T22:00:01Z");
  for (let i = 0; i < 10; i++) reserveAdminAuthAttempt(counter, {}, "ip-a");
  assert.equal(releaseAdminAuthAttempt(counter.sql, "ip-a", old.bucket), true);
  assert.equal(reserveAdminAuthAttempt(counter, {}, "ip-a").ok, false, "a late refund cannot reopen the next hour's allowance");
  assert.equal(releaseAdminAuthAttempt(counter.sql, "ip-c", "H2026-11-06T22"), true);
  assert.equal(counter.count("H2026-11-06T22", "adminfail:ip-c"), 0, "release without a reservation does not go negative");
  for (const bucket of [undefined, "", "D2026-11-06", "H2026-11-06T22' OR 1=1 --"]) {
    assert.equal(releaseAdminAuthAttempt(counter.sql, "ip-a", bucket), false);
  }
});

test("admin failure limit is a bounded positive integer", () => {
  assert.equal(adminAuthHourlyLimit({}), 10);
  assert.equal(adminAuthHourlyLimit({ ADMIN_AUTH_HOURLY_FAILURE_LIMIT: "5" }), 5);
  for (const value of ["0", "-1", "1.5", "101", "1e9", "Infinity", "abc"]) {
    assert.equal(adminAuthHourlyLimit({ ADMIN_AUTH_HOURLY_FAILURE_LIMIT: value }), 10, value);
  }
});

const origin = "https://gifts.example.com";
const token = "synthetic-admin-token-0123456789abcdef";
const env = { ALLOWED_ORIGINS: origin, IP_SALT: "synthetic-test-salt-0123456789abcdef", FEEDBACK_ADMIN_TOKEN: token };
const exportRequest = (secret) => new Request(`${origin}/api/feedback/export`, {
  method: "POST", body: "{}",
  headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.40", Authorization: `Bearer ${secret}` },
});

test("admin endpoints fail closed when the throttle is missing or its storage fails", async () => {
  const logs = [];
  const original = [console.error, console.warn];
  console.error = (...args) => logs.push(args.join(" "));
  console.warn = (...args) => logs.push(args.join(" "));
  try {
    const missing = await handleRequest(exportRequest(token), env, {});
    assert.equal(missing.status, 503, "no throttle dependency means no token check");
    let compared = false;
    const failing = { reserve: async () => { throw new Error("storage offline"); }, release: async () => { compared = true; } };
    const unavailable = await handleRequest(exportRequest(token), env, { adminAuth: failing });
    assert.equal(unavailable.status, 503);
    assert.equal(compared, false);
    assert.doesNotMatch(await unavailable.text(), /storage offline|token|Bearer/i, "no internal detail is disclosed");
    const releaseFails = {
      reserve: async () => ({ ok: true, bucket: "H2026-11-06T21" }),
      release: async () => { throw new Error("storage offline"); },
    };
    const feedback = { export: async () => ({ rows: [], next: null }) };
    const ok = await handleRequest(exportRequest(token), env, { adminAuth: releaseFails, feedback });
    assert.equal(ok.status, 200, "an authenticated request is not lost because its refund failed");
    assert.ok(logs.every((line) => !line.includes(token)), "the admin token is never logged");
  } finally {
    [console.error, console.warn] = original;
  }
});

test("wrong and malformed admin tokens are rejected with a generic 401", async () => {
  const adminAuth = { reserve: async () => ({ ok: true, bucket: "H2026-11-06T21" }), release: async () => true };
  for (const secret of ["", token.slice(0, -1), `${token}x`, token.toUpperCase(), `Basic ${token}`]) {
    const response = await handleRequest(exportRequest(secret), env, { adminAuth });
    assert.equal(response.status, 401, JSON.stringify(secret));
    assert.deepEqual(await response.json(), { error: "Unauthorised." });
  }
});
