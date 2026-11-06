import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { pruneUsageBuckets, reserveProductSearches, scheduleBudgetPrune, seedProductDailyUsage } from "../src/budget-storage.js";

function productCounter() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE usage (bucket TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (bucket, k))");
  const sql = { exec: (query, ...params) => db.prepare(query).run(...params) };
  let now = new Date("2026-11-04T03:00:00Z");
  const counter = {
    buckets: () => pruneUsageBuckets(sql, now),
    count: (bucket, key) => db.prepare("SELECT n FROM usage WHERE bucket = ? AND k = ?").get(bucket, key)?.n || 0,
    add: (bucket, key, n) => db.prepare("INSERT INTO usage (bucket, k, n) VALUES (?, ?, ?) ON CONFLICT(bucket, k) DO UPDATE SET n = n + ?").run(bucket, key, n, n),
  };
  return { counter, sql, db, advance: (value) => { now = new Date(value); } };
}

test("daily product capacity survives hour changes and applies across visitors", () => {
  const { counter, db, advance } = productCounter();
  const env = { PRODUCT_SEARCH_DAILY_LIMIT: "20" };
  assert.equal(reserveProductSearches(counter, env, "one", 16), 16);
  advance("2026-11-04T04:00:00Z");
  assert.equal(reserveProductSearches(counter, env, "two", 16), 4);
  assert.equal(reserveProductSearches(counter, env, "three", 1), 0);
  advance("2026-11-05T04:00:00Z");
  assert.equal(reserveProductSearches(counter, env, "three", 16), 16);
  db.close();
});

test("product reservations apply every burst and visitor cap without overshooting", () => {
  for (const [key, advance, visitor] of [
    ["PRODUCT_SEARCH_HOURLY_LIMIT", "2026-11-04T03:01:00Z", "other"],
    ["PRODUCT_SEARCH_PER_SECOND_LIMIT", "2026-11-04T03:00:00Z", "other"],
    ["PRODUCT_SEARCH_PER_VISITOR_DAILY_LIMIT", "2026-11-04T04:00:00Z", "same"],
    ["PRODUCT_SEARCH_PER_VISITOR_MINUTE_LIMIT", "2026-11-04T03:00:01Z", "same"],
  ]) {
    const fixture = productCounter();
    const env = { [key]: "18" };
    assert.equal(reserveProductSearches(fixture.counter, env, "same", 16), 16, key);
    fixture.advance(advance);
    assert.equal(reserveProductSearches(fixture.counter, env, visitor, 16), 2, key);
    assert.equal(reserveProductSearches(fixture.counter, env, visitor, 1), 0, key);
    fixture.db.close();
  }
});

test("launch visitor limits cover all allowed AI searches while remaining bounded", () => {
  const { counter, db, advance } = productCounter();
  for (let index = 0; index < 15; index++) {
    advance(`2026-11-04T03:${String(index).padStart(2, "0")}:00Z`);
    assert.equal(reserveProductSearches(counter, {}, "visitor", 16), 16);
  }
  assert.equal(reserveProductSearches(counter, {}, "visitor", 1), 0);
  assert.equal(counter.count(counter.buckets().day, "product:__global__"), 240);
  db.close();
});

test("daily migration counts earlier product reservations once without resetting capacity", () => {
  const { counter, sql, db } = productCounter();
  const day = counter.buckets().day;
  counter.add(day, "product:one", 12);
  counter.add(day, "product:two", 8);
  counter.add(day, "ai:__global__", 100);
  seedProductDailyUsage(sql);
  assert.equal(counter.count(day, "product:__global__"), 20);
  assert.equal(reserveProductSearches(counter, { PRODUCT_SEARCH_DAILY_LIMIT: "25" }, "three", 16), 5);
  seedProductDailyUsage(sql);
  assert.equal(counter.count(day, "product:__global__"), 25);
  assert.equal(reserveProductSearches(counter, { PRODUCT_SEARCH_DAILY_LIMIT: "25" }, "four", 1), 0);
  db.close();
});

test("daily pruning removes feedback buckets at or beyond the 90-day cutoff", () => {
  let executed;
  const now = new Date("2026-11-04T03:00:00.000Z");
  const buckets = pruneUsageBuckets({
    exec: (...args) => { executed = args; },
  }, now);

  assert.deepEqual(buckets, {
    day: "D2026-11-04",
    minute: "M2026-11-04T03:00",
    hour: "H2026-11-04T03",
    second: "S2026-11-04T03:00:00",
  });
  assert.match(executed[0], /bucket LIKE 'F%' AND bucket <= \?/);
  assert.equal(executed.at(-1), "F2026-08-06");
});

test("the scheduled cleanup reaches the global budget Durable Object", async () => {
  let name;
  let awaited;
  scheduleBudgetPrune({
    BUDGET: {
      idFromName: (value) => { name = value; return "global-id"; },
      get: (id) => {
        assert.equal(id, "global-id");
        return { prune: async () => "pruned" };
      },
    },
  }, {
    waitUntil: (promise) => { awaited = promise; },
  });
  assert.equal(name, "global");
  assert.equal(await awaited, "pruned");
});

test("scheduled cleanup exposes storage failure and a later retry can succeed", async () => {
  let awaited, fail = true;
  const env = {
    BUDGET: {
      idFromName: () => "global-id",
      get: () => ({
        prune: async () => {
          if (fail) throw new Error("Synthetic storage failure");
          return true;
        },
      }),
    },
  };
  const context = { waitUntil: (promise) => { awaited = promise; } };
  scheduleBudgetPrune(env, context);
  await assert.rejects(awaited, /Synthetic storage failure/);
  fail = false;
  scheduleBudgetPrune(env, context);
  assert.equal(await awaited, true);
});
