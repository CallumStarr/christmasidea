import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";

// Exercise the real SQLite-backed object in local workerd; no provider or production calls.
const bundle = await build({
  stdin: {
    contents: `
      import { BudgetCounter } from "./src/index.js";
      export { BudgetCounter };
      export default { async fetch(request, env) {
        const url = new URL(request.url);
        const counter = env.BUDGET.get(env.BUDGET.idFromName(url.searchParams.get("scenario")));
        const visitor = url.searchParams.get("visitor");
        return Response.json(url.pathname === "/products"
          ? await counter.takeProducts(visitor, 2)
          : await counter.consume(visitor));
      } };`,
    resolveDir: fileURLToPath(new URL("../", import.meta.url)),
  },
  bundle: true, write: false, format: "esm", platform: "neutral",
  external: ["cloudflare:workers"],
});
const worker = new Miniflare({
  cf: false,
  enableDevRegistry: false,
  telemetry: { enabled: false },
  workers: [{ config: {
    name: "audit-budget",
    compatibilityDate: "2026-10-01",
    manifest: {
      mainModule: "audit.mjs",
      modules: { "audit.mjs": { type: "esm", contents: bundle.outputFiles[0].text } },
    },
    exports: { BudgetCounter: { type: "durable-object", storage: "sqlite" } },
    env: {
      BUDGET: { type: "durable-object", worker: "audit-budget", exportName: "BudgetCounter" },
      ...Object.fromEntries(Object.entries({
        DAILY_AI_LIMIT: "25", PER_VISITOR_DAILY_LIMIT: "3", PER_VISITOR_MINUTE_LIMIT: "3",
        PRODUCT_SEARCH_DAILY_LIMIT: "40", PRODUCT_SEARCH_HOURLY_LIMIT: "40",
        PRODUCT_SEARCH_PER_SECOND_LIMIT: "40",
        PRODUCT_SEARCH_PER_VISITOR_DAILY_LIMIT: "4", PRODUCT_SEARCH_PER_VISITOR_MINUTE_LIMIT: "4",
      }).map(([name, value]) => [name, { type: "text", value }])),
    },
  } }],
});

try {
  const results = [];
  for (const count of [10, 50, 100]) {
    for (const operation of ["ideas", "products"]) {
      const start = performance.now();
      const responses = await Promise.all(Array.from({ length: count }, async (_, i) => {
        const response = await worker.dispatchFetch(
          `http://audit.local/${operation}?scenario=${operation}-${count}&visitor=synthetic-${i}`,
        );
        assert.equal(response.status, 200);
        return response.json();
      }));
      const reserved = operation === "ideas"
        ? responses.filter((response) => response.ok).length
        : responses.reduce((sum, allowance) => sum + allowance, 0);
      assert.equal(reserved, Math.min(count * (operation === "products" ? 2 : 1), operation === "products" ? 40 : 25));
      results.push({ operation, concurrent: count, reserved, wallMs: Math.round(performance.now() - start) });
    }
  }
  for (const operation of ["ideas", "products"]) {
    const responses = await Promise.all(Array.from({ length: 20 }, async () => {
      const response = await worker.dispatchFetch(
        `http://audit.local/${operation}?scenario=visitor-${operation}&visitor=same-synthetic-visitor`,
      );
      return response.json();
    }));
    const reserved = operation === "ideas"
      ? responses.filter((response) => response.ok).length
      : responses.reduce((sum, allowance) => sum + allowance, 0);
    assert.equal(reserved, operation === "ideas" ? 3 : 4);
    results.push({ operation, concurrent: 20, sameVisitor: true, reserved });
  }
  console.log(JSON.stringify({ environment: "local workerd; not production capacity", results }, null, 2));
} finally {
  await worker.dispose();
}
