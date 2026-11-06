import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://gifts.example.com";
const token = "synthetic-admin-token-0123456789abcdef";

test("workerd Durable Object throttles repeated admin-token failures per visitor without locking out others", async (t) => {
  const bundle = await build({
    entryPoints: [path.join(root, "src", "index.js")], bundle: true, format: "esm", platform: "neutral",
    external: ["cloudflare:workers"], conditions: ["workerd", "worker", "browser"], mainFields: ["module", "main"],
    write: false, logLevel: "silent",
  });
  const worker = new Miniflare({
    cf: false, enableDevRegistry: false, telemetry: { enabled: false },
    workers: [{ config: {
      name: "admin-auth-regression",
      compatibilityDate: "2026-10-01",
      manifest: { mainModule: "worker.mjs", modules: { "worker.mjs": { type: "esm", contents: bundle.outputFiles[0].text } } },
      exports: { BudgetCounter: { type: "durable-object", storage: "sqlite" } },
      env: {
        BUDGET: { type: "durable-object", worker: "admin-auth-regression", exportName: "BudgetCounter" },
        ALLOWED_ORIGINS: { type: "text", value: origin },
        IP_SALT: { type: "text", value: "synthetic-test-salt-0123456789abcdef" },
        FEEDBACK_ADMIN_TOKEN: { type: "text", value: token },
      },
    } }],
  });
  t.after(() => worker.dispose());

  const attempt = async (ip, secret) => {
    const response = await worker.dispatchFetch(`${origin}/api/feedback/export`, {
      method: "POST", body: "{}",
      headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": ip, Authorization: `Bearer ${secret}` },
    });
    await response.arrayBuffer();
    return response.status;
  };

  for (let i = 0; i < 10; i++) assert.equal(await attempt("198.51.100.7", `wrong-${i}`), 401);
  assert.equal(await attempt("198.51.100.7", "wrong-final"), 429, "the eleventh failure in an hour is throttled");
  assert.equal(await attempt("198.51.100.7", token), 429, "the throttle applies before the token is compared");
  assert.equal(await attempt("198.51.100.8", token), 200, "another visitor with the correct token is not locked out");
  assert.equal(await attempt("198.51.100.8", token), 200, "successful requests do not consume the failure allowance");
});
