import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { scheduleBudgetPrune } from "../src/budget-storage.js";
import { createEbayProvider } from "../src/providers/ebay.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const baseline = "74a6ddf2b5855710f2a2e762b0805e57645f85c1";
const supplied = process.argv[2];
if (!supplied) throw new Error("Provide an empty, disposable local directory for the recovery drill.");
const workdir = path.resolve(supplied);
if (workdir === root || root.startsWith(`${workdir}${path.sep}`)) {
  throw new Error("The recovery directory cannot be the repository or one of its parent directories.");
}
await mkdir(workdir, { recursive: true });
if ((await readdir(workdir)).length) throw new Error("The recovery directory must be empty.");

const hash = (value) => createHash("sha256").update(value).digest("hex");
const gitFile = (name) => execFileSync("git", ["show", `${baseline}:${name}`], {
  cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
const historicalHtml = gitFile("site/index.html");
const currentHtml = await readFile(path.join(root, "site", "index.html"), "utf8");
assert.notEqual(hash(historicalHtml), hash(currentHtml), "The two static releases must differ.");

const historicalSources = {
  name: "historical-sources",
  setup(builder) {
    builder.onLoad({ filter: /\.[cm]?js$/ }, ({ path: filename }) => {
      const relative = path.relative(root, filename).split(path.sep).join("/");
      if (!relative.startsWith("src/") && !relative.startsWith("site/")) return;
      return { contents: gitFile(relative), loader: "js", resolveDir: path.dirname(filename) };
    });
  },
};

async function bundle(html, useBaseline) {
  const result = await build({
    stdin: {
      contents: `
        import release, { BudgetCounter } from "./src/index.js";
        export { BudgetCounter };
        const html = ${JSON.stringify(html)};
        export default {
          async fetch(request, env, ctx) {
            if (new URL(request.url).pathname === "/__audit/consume") {
              const counter = env.BUDGET.get(env.BUDGET.idFromName("global"));
              return Response.json(await counter.consume("synthetic-visitor"));
            }
            return release.fetch(request, {
              ...env, ASSETS: { fetch: async () => new Response(html, {
                headers: { "Content-Type": "text/html; charset=utf-8" }
              }) }
            }, ctx);
          }
        };
      `,
      resolveDir: root,
    },
    bundle: true, write: false, format: "esm", platform: "neutral",
    external: ["cloudflare:workers"],
    plugins: useBaseline ? [historicalSources] : [],
  });
  return result.outputFiles[0].text;
}

const [oldBundle, newBundle] = await Promise.all([
  bundle(historicalHtml, true), bundle(currentHtml, false),
]);

function simulator(contents, restoredSecret = false) {
  const vars = {
    IP_SALT: "synthetic-only-salt-".padEnd(32, "x"),
    CANONICAL_HOST: "audit.local",
    TURNSTILE_REQUIRED: "true",
    DAILY_AI_LIMIT: "3",
    PER_VISITOR_DAILY_LIMIT: "3",
    PER_VISITOR_MINUTE_LIMIT: "3",
  };
  if (restoredSecret) vars.TURNSTILE_SECRET = "synthetic-only-secret";
  return new Miniflare({
    cf: false, enableDevRegistry: false, telemetry: { enabled: false },
    resourcePersistencePath: workdir,
    workers: [{ config: {
      name: "recovery-drill",
      compatibilityDate: "2026-10-01",
      manifest: { mainModule: "worker.mjs", modules: { "worker.mjs": { type: "esm", contents } } },
      exports: { BudgetCounter: { type: "durable-object", storage: "sqlite" } },
      env: {
        BUDGET: { type: "durable-object", worker: "recovery-drill", exportName: "BudgetCounter" },
        ...Object.fromEntries(Object.entries(vars).map(([name, value]) => [name, { type: "text", value }])),
      },
    } }],
  });
}

async function inspect(worker, expectedHtml, expectedReady) {
  const page = await worker.dispatchFetch("http://audit.local/");
  assert.equal(page.status, 200);
  assert.equal(hash(await page.text()), hash(expectedHtml));
  const ready = await worker.dispatchFetch("http://audit.local/api/ready");
  assert.equal(ready.status, expectedReady);
}

async function consume(worker) {
  const response = await worker.dispatchFetch("http://audit.local/__audit/consume");
  assert.equal(response.status, 200);
  return response.json();
}

let worker = simulator(oldBundle);
try {
  await inspect(worker, historicalHtml, 200);
  assert.equal((await consume(worker)).ok, true);
  assert.equal((await consume(worker)).ok, true);
} finally {
  await worker.dispose();
}
worker = simulator(newBundle);
try {
  await inspect(worker, currentHtml, 503);
  assert.equal((await consume(worker)).ok, true);
  assert.equal((await consume(worker)).ok, false);
} finally {
  await worker.dispose();
}
worker = simulator(oldBundle);
try {
  await inspect(worker, historicalHtml, 200);
  assert.equal((await consume(worker)).ok, false);
} finally {
  await worker.dispose();
}
worker = simulator(newBundle, true);
try {
  await inspect(worker, currentHtml, 200);
  assert.equal((await consume(worker)).ok, false);
} finally {
  await worker.dispose();
}

let scheduled;
const context = { waitUntil: (promise) => { scheduled = promise; } };
const budget = (prune) => ({ idFromName: () => "synthetic", get: () => ({ prune }) });
scheduleBudgetPrune({ BUDGET: budget(async () => { throw new Error("synthetic storage outage"); }) }, context);
await assert.rejects(scheduled, /synthetic storage outage/);
let retried = false;
scheduleBudgetPrune({ BUDGET: budget(async () => { retried = true; return true; }) }, context);
assert.equal(await scheduled, true);
assert.equal(retried, true);

const ebayEnv = {
  EBAY_PRODUCT_DISCOVERY_ENABLED: "true",
  EBAY_CLIENT_ID: "synthetic-recovery-client",
  EBAY_CLIENT_SECRET: "synthetic-expired-secret",
};
let restored = false;
const provider = createEbayProvider(ebayEnv, async (url) => {
  if (String(url).includes("/oauth2/")) {
    return Response.json(restored
      ? { access_token: "synthetic-token", expires_in: 3600 }
      : { error: "invalid_client" }, { status: restored ? 200 : 401 });
  }
  return Response.json({ itemSummaries: [] });
});
await assert.rejects(() => provider.searchProducts("synthetic item"), { code: "token_invalid_client", status: 401 });
ebayEnv.EBAY_CLIENT_SECRET = "synthetic-restored-secret";
restored = true;
assert.deepEqual(await provider.searchProducts("synthetic item"), []);

let tokenRequests = 0, browseRequests = 0, retryReservations = 0;
const expiredTokenProvider = createEbayProvider({
  ...ebayEnv, EBAY_CLIENT_ID: "synthetic-expired-token-client",
}, async (url) => {
  if (String(url).includes("/oauth2/")) {
    tokenRequests++;
    return Response.json({ access_token: `synthetic-token-${tokenRequests}`, expires_in: 3600 });
  }
  browseRequests++;
  return browseRequests === 1
    ? Response.json({}, { status: 401 })
    : Response.json({ itemSummaries: [] });
});
assert.deepEqual(await expiredTokenProvider.searchProducts("synthetic item", {
  reserveRetry: async () => { retryReservations++; return true; },
}), []);
assert.deepEqual([tokenRequests, browseRequests, retryReservations], [2, 2, 1]);

const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const d1Root = path.join(workdir, "d1");
const d1Source = path.join(d1Root, "source");
const d1Restore = path.join(d1Root, "restore");
const migrations = ["0001_awin_catalog.sql", "0002_awin_catalogue_facts.sql"];
for (const [directory, name, id] of [
  [d1Source, "audit-source", "00000000-0000-4000-8000-000000000001"],
  [d1Restore, "audit-restore", "00000000-0000-4000-8000-000000000002"],
]) {
  await mkdir(path.join(directory, "migrations"), { recursive: true });
  await writeFile(path.join(directory, "worker.mjs"), "export default { fetch: () => new Response('local') };\n");
  await writeFile(path.join(directory, "wrangler.toml"), `
name = "${name}"
main = "worker.mjs"
compatibility_date = "2026-10-01"
workers_dev = false
[[d1_databases]]
binding = "DB"
database_name = "${name}"
database_id = "${id}"
migrations_dir = "migrations"
`);
  for (const migration of migrations) {
    await copyFile(path.join(root, "migrations", migration), path.join(directory, "migrations", migration));
  }
}

function localD1(directory, args, expectedFailure, allowSuccess = false) {
  try {
    const output = execFileSync(process.execPath, [
      wrangler, "d1", ...args, "--local", "--config", path.join(directory, "wrangler.toml"), "--cwd", directory,
    ], {
      cwd: directory, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
    });
    if (expectedFailure && !allowSuccess) throw new Error(`Expected local D1 failure matching ${expectedFailure}`);
    return output;
  } catch (error) {
    const output = `${error.stdout || ""}\n${error.stderr || ""}`;
    if (!expectedFailure || !expectedFailure.test(output)) throw error;
    return output;
  }
}

localD1(d1Source, ["migrations", "apply", "audit-source"]);
await writeFile(path.join(d1Source, "synthetic.sql"), `
UPDATE awin_catalogue_state SET active_generation = 'synthetic-recovery',
  published_at = '2026-11-06T12:00:00.000Z' WHERE id = 1;
INSERT INTO awin_products
  (generation, product_id, advertiser_id, title, description, brand, merchant_name,
   category, price_gbp, delivery_cost_gbp, delivery_known, currency, image_url,
   merchant_url, affiliate_url, gtin, in_stock, facts_json)
VALUES
  ('synthetic-recovery', 'test-001', 'synthetic-advertiser', 'Synthetic garden item',
   'Isolated backup validation', 'Synthetic', 'Test shop', 'Garden', 12.50, 0,
   1, 'GBP', '', 'https://example.invalid/item', 'https://example.invalid/item',
   '', 1, '{"condition":"new"}');
`);
localD1(d1Source, ["execute", "audit-source", "--file", path.join(d1Source, "synthetic.sql")]);
const fullExport = path.join(d1Root, "full-export.sql");
const fullExportResult = localD1(d1Source, [
  "export", "audit-source", "--output", fullExport,
], /cannot export databases with Virtual Tables/i, true);
const fullExportFailed = /cannot export databases with Virtual Tables/i.test(fullExportResult);
await writeFile(path.join(d1Root, "full-export.log"), fullExportResult);
const selectedExport = path.join(d1Root, "selected-data.sql");
localD1(d1Source, [
  "export", "audit-source", "--output", selectedExport,
  "--table", "awin_catalogue_state", "awin_products", "--no-schema",
]);
localD1(d1Restore, ["migrations", "apply", "audit-restore"]);
localD1(d1Restore, ["execute", "audit-restore", "--command", "DELETE FROM awin_catalogue_state WHERE id = 1"]);
localD1(d1Restore, ["execute", "audit-restore", "--file", selectedExport]);
const verifySql = `SELECT
  (SELECT active_generation FROM awin_catalogue_state WHERE id = 1) AS generation,
  (SELECT COUNT(*) FROM awin_products) AS products,
  (SELECT COUNT(*) FROM awin_products_fts WHERE awin_products_fts MATCH 'garden') AS fts_hits,
  (SELECT COUNT(*) FROM d1_migrations) AS migrations,
  (SELECT title FROM awin_products LIMIT 1) AS title`;
function queryD1(directory, name, command) {
  const result = JSON.parse(localD1(directory, ["execute", name, "--command", command, "--json"]));
  assert.equal(result[0].success, true);
  return result[0].results[0];
}
const originalData = queryD1(d1Source, "audit-source", verifySql);
const restoredData = queryD1(d1Restore, "audit-restore", verifySql);
assert.deepEqual(originalData, {
  generation: "synthetic-recovery", products: 1, fts_hits: 1, migrations: 2, title: "Synthetic garden item",
});
assert.deepEqual(restoredData, originalData);
await writeFile(path.join(d1Source, "migrations", "0003_synthetic_failure.sql"),
  "CREATE TABLE audit_partial_migration (id INTEGER PRIMARY KEY);\nINSERT INTO audit_missing_table (id) VALUES (1);\n");
const failedMigration = localD1(d1Source, ["migrations", "apply", "audit-source"], /no such table: audit_missing_table/i);
await writeFile(path.join(d1Root, "failed-migration.log"), failedMigration);
const afterFailure = queryD1(d1Source, "audit-source", `SELECT
  (SELECT COUNT(*) FROM sqlite_master WHERE name = 'audit_partial_migration') AS partial_table,
  (SELECT COUNT(*) FROM d1_migrations WHERE name = '0003_synthetic_failure.sql') AS failed_ledger,
  (SELECT COUNT(*) FROM awin_products) AS products`);
assert.deepEqual(afterFailure, { partial_table: 0, failed_ledger: 0, products: 1 });

console.log(JSON.stringify({
  environment: "isolated local workerd and synthetic provider; no remote requests",
  baselineCommit: baseline,
  releaseSequence: ["baseline", "current without required secret", "baseline rollback", "current with synthetic secret"],
  htmlHashes: { baseline: hash(historicalHtml), current: hash(currentHtml) },
  readinessStatuses: [200, 503, 200, 200],
  durableObjectReservations: [true, true, true, false, false, false],
  scheduledFailurePropagatedAndRetrySucceeded: true,
  expiredProviderCredentialRejectedAndRecovered: true,
  expiredAccessTokenRefreshedWithReservedRetry: true,
  localD1FullExport: fullExportFailed
    ? "failed because the database contains an FTS5 virtual table"
    : "succeeded; full-export restoration was not tested",
  localD1SelectiveRestore: restoredData,
  localD1FailedMigrationRollback: afterFailure,
  caveat: "Local release switching is not Cloudflare deployment rollback or a backup of production Durable Object data.",
}, null, 2));
