import test from "node:test";
import assert from "node:assert/strict";
import { pruneUsageBuckets, scheduleBudgetPrune } from "../src/budget-storage.js";

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
