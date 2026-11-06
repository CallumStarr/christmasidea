import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://gifts.example.com";
const token = "synthetic-admin-token-0123456789abcdef";
let bundlePromise;

async function startWorker(t, name) {
  bundlePromise ||= build({
    entryPoints: [path.join(root, "src", "index.js")], bundle: true, format: "esm", platform: "neutral",
    external: ["cloudflare:workers"], conditions: ["workerd", "worker", "browser"], mainFields: ["module", "main"],
    write: false, logLevel: "silent",
  });
  const bundle = await bundlePromise;
  const worker = new Miniflare({
    cf: false, enableDevRegistry: false, telemetry: { enabled: false },
    workers: [{ config: {
      name,
      compatibilityDate: "2026-10-01",
      manifest: { mainModule: "worker.mjs", modules: { "worker.mjs": { type: "esm", contents: bundle.outputFiles[0].text } } },
      exports: { BudgetCounter: { type: "durable-object", storage: "sqlite" } },
      env: {
        BUDGET: { type: "durable-object", worker: name, exportName: "BudgetCounter" },
        ALLOWED_ORIGINS: { type: "text", value: origin },
        IP_SALT: { type: "text", value: "synthetic-test-salt-0123456789abcdef" },
        FEEDBACK_ADMIN_TOKEN: { type: "text", value: token },
      },
    } }],
  });
  t.after(() => worker.dispose());
  return worker;
}

async function rawAttempt(worker, ip, secret) {
  const response = await worker.dispatchFetch(`${origin}/api/feedback/export`, {
    method: "POST", body: "{}",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": ip, Authorization: `Bearer ${secret}` },
  });
  await response.arrayBuffer();
  return response;
}

const attempt = async (worker, ip, secret) => (await rawAttempt(worker, ip, secret)).status;

test("workerd Durable Object throttles repeated admin-token failures per visitor without locking out others", async (t) => {
  const worker = await startWorker(t, "admin-auth-sequential");
  for (let i = 0; i < 10; i++) assert.equal(await attempt(worker, "198.51.100.7", `wrong-${i}`), 401);
  assert.equal(await attempt(worker, "198.51.100.7", "wrong-final"), 429, "the eleventh failure in an hour is throttled");
  assert.equal(await attempt(worker, "198.51.100.7", token), 429, "the throttle applies before the token is compared");
  assert.equal(await attempt(worker, "198.51.100.8", token), 200, "another visitor with the correct token is not locked out");
  assert.equal(await attempt(worker, "198.51.100.8", token), 200, "successful requests do not consume the failure allowance");
});

test("workerd admin throttle admits at most the hourly limit of token checks under a concurrent burst", async (t) => {
  const worker = await startWorker(t, "admin-auth-burst");
  const statuses = await Promise.all(Array.from({ length: 100 }, (_, i) => attempt(worker, "198.51.100.20", `burst-${i}`)));
  assert.equal(statuses.filter((s) => s === 401).length, 10, "only the configured allowance reaches token comparison");
  assert.equal(statuses.filter((s) => s === 429).length, 90);
  const locked = await rawAttempt(worker, "198.51.100.20", token);
  assert.equal(locked.status, 429, "the per-visitor lockout also applies to the correct token");
  const retryAfter = Number(locked.headers.get("Retry-After"));
  assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 3600);
  assert.equal(await attempt(worker, "198.51.100.21", token), 200, "a different visitor is not locked out");
});

// A reservation is held while the token is compared, so more than the hourly limit of simultaneous correct requests from
// one visitor can briefly receive 429. Comparing first would let a correct guess inside a burst succeed past the limit.
test("workerd successful admin requests release their reservation", async (t) => {
  const worker = await startWorker(t, "admin-auth-release");
  for (let i = 0; i < 25; i++) assert.equal(await attempt(worker, "198.51.100.30", token), 200, "sequential successes never lock out");
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => attempt(worker, "198.51.100.30", token)));
  assert.deepEqual([...new Set(concurrent)], [200], "concurrency within the limit succeeds");
  for (let i = 0; i < 10; i++) assert.equal(await attempt(worker, "198.51.100.30", `wrong-${i}`), 401);
  assert.equal(await attempt(worker, "198.51.100.30", "wrong-final"), 429, "successes did not use up failure allowance");
});
