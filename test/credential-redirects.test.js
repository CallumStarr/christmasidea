import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { callClaudeDetailed, normaliseInput, verifyTurnstile } from "../src/core.js";
import { createAmazonProvider } from "../src/providers/amazon.js";
import { createEbayProvider } from "../src/providers/ebay.js";

test("credential-bearing provider requests fail closed on a local 307 redirect", async (t) => {
  let starts = 0;
  let destinations = 0;
  const server = createServer((request, response) => {
    request.resume();
    if (request.url === "/start") {
      starts++;
      response.writeHead(307, { Location: "/destination" });
      response.end();
    } else {
      destinations++;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}/start`;
  const redirects = [];
  const redirectFetch = async (_upstream, init) => {
    redirects.push(init.redirect);
    return fetch(url, init);
  };
  t.mock.method(console, "warn", () => {});

  assert.equal(await verifyTurnstile("synthetic-token", "192.0.2.1", {
    CANONICAL_HOST: "gifts.example.com", TURNSTILE_REQUIRED: "true", TURNSTILE_SECRET: "synthetic-secret",
  }, redirectFetch), false);
  const input = normaliseInput({ interests: "coffee" }).value;
  await assert.rejects(() => callClaudeDetailed(input, { ANTHROPIC_API_KEY: "synthetic-key" }, redirectFetch));

  const ebayEnv = {
    PRODUCT_DISCOVERY_ENABLED: "true", EBAY_PRODUCT_DISCOVERY_ENABLED: "true",
    EBAY_CLIENT_ID: "redirect-token-ebay", EBAY_CLIENT_SECRET: "synthetic-secret",
  };
  await assert.rejects(() => createEbayProvider(ebayEnv, redirectFetch).searchProducts("mug"),
    { code: "request_failed" });
  const ebaySearchFetch = async (upstream, init) => {
    if (String(upstream).includes("/oauth2/")) {
      redirects.push(init.redirect);
      return Response.json({ access_token: "synthetic-token", expires_in: 3600 });
    }
    return redirectFetch(upstream, init);
  };
  await assert.rejects(() => createEbayProvider({ ...ebayEnv, EBAY_CLIENT_ID: "redirect-search-ebay" },
    ebaySearchFetch).searchProducts("mug"), { code: "request_failed" });

  const amazonEnv = {
    PRODUCT_DISCOVERY_ENABLED: "true", AMAZON_CREATORS_CLIENT_ID: "redirect-token-amazon",
    AMAZON_CREATORS_CLIENT_SECRET: "synthetic-secret", AMAZON_PARTNER_TAG: "test-21",
  };
  await assert.rejects(() => createAmazonProvider(amazonEnv, redirectFetch).searchProducts("mug"),
    { code: "token_network_error" });
  const amazonSearchFetch = async (upstream, init) => {
    if (String(upstream).includes("/auth/")) {
      redirects.push(init.redirect);
      return Response.json({ access_token: "synthetic-token", token_type: "bearer", expires_in: 3600 });
    }
    return redirectFetch(upstream, init);
  };
  await assert.rejects(() => createAmazonProvider({ ...amazonEnv, AMAZON_CREATORS_CLIENT_ID: "redirect-search-amazon" },
    amazonSearchFetch).searchProducts("mug"), { code: "api_network_error" });

  assert.equal(starts, 6);
  assert.equal(destinations, 0);
  assert.deepEqual(redirects, Array(8).fill("manual"));
});

test("Worker source never uses the redirect mode workerd rejects", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const files = (await readdir(new URL("../src/", import.meta.url), { recursive: true }))
    .filter((file) => file.endsWith(".js"));
  const offenders = [];
  for (const file of files) {
    const lines = (await readFile(new URL(`../src/${file.replaceAll("\\", "/")}`, import.meta.url), "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (!/^\s*(?:\/\/|\*|\/\*)/.test(line) && /redirect\s*:\s*["'`]error["'`]/.test(line)) offenders.push(`${file}:${index + 1}`);
    });
  }
  assert.ok(files.length > 10);
  assert.deepEqual(offenders, []);
});
