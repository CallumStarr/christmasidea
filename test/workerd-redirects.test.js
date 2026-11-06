import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATUSES = [301, 302, 303, 307, 308];
const TARGETS = ["turnstile", "anthropic", "amazon-token", "amazon-api", "ebay-token", "ebay-search"];
const SECRETS = ["synthetic-turnstile-secret", "synthetic-anthropic-key", "synthetic-amazon-secret", "synthetic-ebay-secret",
  "synthetic-amazon-bearer", "synthetic-ebay-bearer"];

// Runs inside workerd. Upstream URLs are rewritten to a loopback server so workerd's real fetch handles the redirect.
const ENTRY = `
import { callClaudeDetailed, normaliseInput, verifyTurnstile } from "./src/core.js";
import { createAmazonProvider } from "./src/providers/amazon.js";
import { createEbayProvider } from "./src/providers/ebay.js";

function label(url) {
  const value = String(url);
  if (value.includes("challenges.cloudflare.com")) return "turnstile";
  if (value.includes("anthropic.com")) return "anthropic";
  if (value.includes("/auth/")) return "amazon-token";
  if (value.includes("/catalog/")) return "amazon-api";
  if (value.includes("/oauth2/")) return "ebay-token";
  return "ebay-search";
}

async function outcome(run) {
  try { return { value: await run() }; } catch (error) { return { error: error?.code || error?.name || "error" }; }
}

async function scenario(base, target, status, id) {
  const modes = [];
  const fetchImpl = (url, init) => {
    const name = label(url);
    modes.push(init.redirect);
    return fetch(name === target ? base + "/redirect/" + status + "/" + name : base + "/ok/" + name, init);
  };
  const turnstileEnv = { CANONICAL_HOST: "gifts.example.com", TURNSTILE_REQUIRED: "true",
    TURNSTILE_SECRET: "synthetic-turnstile-secret" };
  const amazonEnv = { PRODUCT_DISCOVERY_ENABLED: "true", AMAZON_CREATORS_CLIENT_ID: "workerd-amazon-" + id,
    AMAZON_CREATORS_CLIENT_SECRET: "synthetic-amazon-secret", AMAZON_PARTNER_TAG: "test-21" };
  const ebayEnv = { PRODUCT_DISCOVERY_ENABLED: "true", EBAY_PRODUCT_DISCOVERY_ENABLED: "true",
    EBAY_CLIENT_ID: "workerd-ebay-" + id, EBAY_CLIENT_SECRET: "synthetic-ebay-secret" };
  const kind = target.replace(/^none:/, "");
  let result;
  if (kind === "turnstile") result = { value: await verifyTurnstile("synthetic-token", "192.0.2.1", turnstileEnv, fetchImpl) };
  else if (kind === "anthropic") {
    result = await outcome(async () => (await callClaudeDetailed(normaliseInput({ interests: "coffee" }).value,
      { ANTHROPIC_API_KEY: "synthetic-anthropic-key" }, fetchImpl)).stopReason);
  } else if (kind.startsWith("amazon")) result = await outcome(() => createAmazonProvider(amazonEnv, fetchImpl).searchProducts("mug"));
  else result = await outcome(() => createEbayProvider(ebayEnv, fetchImpl).searchProducts("mug"));
  return { target, status, modes, ...result };
}

export default {
  async fetch(request) {
    const base = new URL(request.url).searchParams.get("base");
    const results = [];
    let id = 0;
    for (const target of ${JSON.stringify(TARGETS)}) {
      for (const status of ${JSON.stringify(STATUSES)}) results.push(await scenario(base, target, status, id++));
      results.push(await scenario(base, "none:" + target, 0, id++));
    }
    return Response.json(results);
  },
};`;

function success(name) {
  if (name === "turnstile") return { success: true, hostname: "gifts.example.com", action: "" };
  if (name === "anthropic") return { content: [{ type: "tool_use", input: { ideas: [] } }], stop_reason: "tool_use" };
  if (name === "amazon-token") return { access_token: "synthetic-amazon-bearer", token_type: "bearer", expires_in: 3600 };
  if (name === "amazon-api") return { searchResult: { items: [] } };
  if (name === "ebay-token") return { access_token: "synthetic-ebay-bearer", expires_in: 3600 };
  return { total: 0 };
}

test("workerd rejects every upstream redirect without contacting the destination, and successes still work", async (t) => {
  const starts = [];
  let destinations = 0;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const [, kind, first, second] = request.url.split("/");
      if (kind === "redirect") {
        const basic = /^Basic (.+)$/.exec(request.headers.authorization || "");
        const seen = `${JSON.stringify(request.headers)}${Buffer.concat(chunks)}${basic ? Buffer.from(basic[1], "base64") : ""}`;
        starts.push({ status: Number(first), name: second, credential: SECRETS.some((secret) => seen.includes(secret)) });
        response.writeHead(Number(first), { Location: `http://127.0.0.1:${server.address().port}/dest/${second}` });
        response.end();
        return;
      }
      const name = first;
      if (kind === "dest") destinations++;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(success(name)));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const bundle = await build({
    stdin: { contents: ENTRY, resolveDir: root, sourcefile: "workerd-redirect-entry.js", loader: "js" },
    bundle: true, format: "esm", platform: "neutral", conditions: ["workerd", "worker", "browser"],
    mainFields: ["module", "main"], write: false, logLevel: "silent",
  });
  const worker = new Miniflare({
    cf: false, enableDevRegistry: false, telemetry: { enabled: false },
    workers: [{ config: {
      name: "redirect-regression",
      compatibilityDate: "2026-10-01",
      manifest: { mainModule: "worker.mjs", modules: { "worker.mjs": { type: "esm", contents: bundle.outputFiles[0].text } } },
    } }],
  });
  t.after(() => worker.dispose());

  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await worker.dispatchFetch(`http://local/?base=${encodeURIComponent(base)}`);
  assert.equal(response.status, 200, await response.clone().text());
  const results = await response.json();

  for (const result of results) {
    assert.ok(result.modes.length > 0 && result.modes.every((mode) => mode === "manual"), JSON.stringify(result));
    if (result.target.startsWith("none:")) {
      const target = result.target.slice(5);
      if (target === "turnstile") assert.equal(result.value, true);
      else if (target === "anthropic") assert.equal(result.value, "tool_use");
      else assert.deepEqual(result.value, [], JSON.stringify(result));
      continue;
    }
    const expected = {
      turnstile: undefined, anthropic: "upstream_redirect", "amazon-token": "token_network_error",
      "amazon-api": "api_network_error", "ebay-token": "request_failed", "ebay-search": "request_failed",
    }[result.target];
    if (result.target === "turnstile") assert.equal(result.value, false, JSON.stringify(result));
    else assert.equal(result.error, expected, JSON.stringify(result));
  }

  assert.equal(starts.length, TARGETS.length * STATUSES.length);
  for (const target of TARGETS) {
    assert.deepEqual(starts.filter((start) => start.name === target).map((start) => start.status), STATUSES);
  }
  assert.ok(starts.every((start) => start.credential), "each redirected request carried a synthetic credential");
  assert.equal(destinations, 0, "no redirect destination was contacted");
});
