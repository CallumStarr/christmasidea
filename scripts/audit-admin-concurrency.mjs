// Audit harness: exercises admin-token throttling in local workerd (Miniflare) with synthetic secrets only.
// Usage: node scripts/audit-admin-concurrency.mjs [output.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://gifts.example.com";
const token = "synthetic-admin-token-0123456789abcdef";
const LIMIT = 10;

const bundle = await build({
  entryPoints: [path.join(root, "src", "index.js")], bundle: true, format: "esm", platform: "neutral",
  external: ["cloudflare:workers"], conditions: ["workerd", "worker", "browser"], mainFields: ["module", "main"],
  write: false, logLevel: "silent",
});

function start() {
  return new Miniflare({
    cf: false, enableDevRegistry: false, telemetry: { enabled: false },
    workers: [{ config: {
      name: "admin-concurrency-audit",
      compatibilityDate: "2026-10-01",
      manifest: { mainModule: "worker.mjs", modules: { "worker.mjs": { type: "esm", contents: bundle.outputFiles[0].text } } },
      exports: { BudgetCounter: { type: "durable-object", storage: "sqlite" } },
      env: {
        BUDGET: { type: "durable-object", worker: "admin-concurrency-audit", exportName: "BudgetCounter" },
        ALLOWED_ORIGINS: { type: "text", value: origin },
        IP_SALT: { type: "text", value: "synthetic-test-salt-0123456789abcdef" },
        FEEDBACK_ADMIN_TOKEN: { type: "text", value: token },
        ADMIN_AUTH_HOURLY_FAILURE_LIMIT: { type: "text", value: String(LIMIT) },
      },
    } }],
  });
}

async function attempt(worker, ip, secret) {
  const response = await worker.dispatchFetch(`${origin}/api/feedback/export`, {
    method: "POST", body: "{}",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": ip, Authorization: `Bearer ${secret}` },
  });
  await response.arrayBuffer();
  return response.status;
}

const tally = (statuses) => statuses.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});

async function scenario(name, fn) {
  const worker = start();
  const startedAt = Date.now();
  try {
    const result = await fn(worker);
    return { name, ms: Date.now() - startedAt, ...result };
  } finally {
    await worker.dispose();
  }
}

const results = [];
results.push(await scenario("A sequential brute force (15 wrong tokens)", async (w) => {
  const statuses = [];
  for (let i = 0; i < 15; i++) statuses.push(await attempt(w, "198.51.100.10", `wrong-${i}`));
  return { submitted: 15, statuses: tally(statuses), tokenComparisons: statuses.filter((s) => s === 401).length };
}));
for (const n of [60, 100, 400]) {
  results.push(await scenario(`B/C concurrent burst (${n} wrong tokens, one IP)`, async (w) => {
    const statuses = await Promise.all(Array.from({ length: n }, (_, i) => attempt(w, "198.51.100.11", `wrong-${i}`)));
    const after = await attempt(w, "198.51.100.11", "wrong-after");
    return { submitted: n, statuses: tally(statuses), tokenComparisons: statuses.filter((s) => s === 401).length, nextAttempt: after };
  }));
}
results.push(await scenario("D correct token inside a 100-request concurrent attack (same IP)", async (w) => {
  const attack = Array.from({ length: 100 }, (_, i) => attempt(w, "198.51.100.12", `wrong-${i}`));
  const legit = attempt(w, "198.51.100.12", token);
  const [statuses, legitStatus] = await Promise.all([Promise.all(attack), legit]);
  const legitAfter = await attempt(w, "198.51.100.12", token);
  return { submitted: 101, statuses: tally(statuses), tokenComparisons: statuses.filter((s) => s === 401).length, legitDuring: legitStatus, legitAfter };
}));
results.push(await scenario("E repeated waves after lockout (5 waves x 50)", async (w) => {
  const waves = [];
  for (let k = 0; k < 5; k++) {
    const statuses = await Promise.all(Array.from({ length: 50 }, (_, i) => attempt(w, "198.51.100.13", `wave-${k}-${i}`)));
    waves.push(tally(statuses));
  }
  return { submitted: 250, waves, tokenComparisons: waves.reduce((n, wv) => n + (wv[401] || 0), 0) };
}));
results.push(await scenario("F other visitors during a 100-request attack", async (w) => {
  const attack = Promise.all(Array.from({ length: 100 }, (_, i) => attempt(w, "198.51.100.14", `wrong-${i}`)));
  const others = Promise.all([attempt(w, "198.51.100.15", token), attempt(w, "198.51.100.16", "wrong-other")]);
  const [statuses, [otherGood, otherBad]] = await Promise.all([attack, others]);
  return { submitted: 102, statuses: tally(statuses), otherVisitorCorrectToken: otherGood, otherVisitorWrongToken: otherBad };
}));

const out = { generatedAt: new Date().toISOString(), limitPerHour: LIMIT, results };
const text = JSON.stringify(out, null, 2);
if (process.argv[2]) fs.writeFileSync(process.argv[2], `${text}\n`);
console.log(text);
