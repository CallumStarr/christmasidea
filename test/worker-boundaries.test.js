import test from "node:test";
import assert from "node:assert/strict";
import { fetchWorker } from "../src/worker-fetch.js";

const origin = "https://gifts.example.com";
const env = {
  CANONICAL_HOST: "gifts.example.com",
  ALLOWED_ORIGINS: origin,
  FEEDBACK_ADMIN_TOKEN: "synthetic-feedback-token-0123456789",
  ASSETS: { fetch: async () => new Response("asset") },
};
const ctx = { waitUntil: () => {} };

test("canonical redirects receive security headers without changing their destination", async () => {
  const response = await fetchWorker(new Request("http://www.gifts.example.com/path?x=1"), env, ctx);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("Location"), `${origin}/path?x=1`);
  assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=31536000");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
});

test("asset and app verification responses retain their distinct frame policies", async () => {
  const normal = await fetchWorker(new Request(`${origin}/`), env, ctx);
  assert.equal(await normal.text(), "asset");
  assert.equal(normal.headers.get("X-Frame-Options"), "DENY");
  for (const host of ["gifts.example.com", "www.gifts.example.com"]) {
    const app = await fetchWorker(new Request(`https://${host}/app-verify`), env, ctx);
    assert.equal(app.status, host === "gifts.example.com" ? 200 : 301);
    assert.equal(app.headers.get("X-Frame-Options"), null);
    assert.match(app.headers.get("Content-Security-Policy"), /frame-ancestors capacitor:\/\/localhost https:\/\/localhost/);
  }
});

test("textual asset responses declare a UTF-8 charset without altering binary or explicit charsets", async () => {
  for (const [served, expected] of [
    ["text/html", "text/html; charset=utf-8"],
    ["text/css", "text/css; charset=utf-8"],
    ["application/javascript", "application/javascript; charset=utf-8"],
    ["application/manifest+json", "application/manifest+json; charset=utf-8"],
    ["image/svg+xml", "image/svg+xml; charset=utf-8"],
    ["text/plain; charset=iso-8859-1", "text/plain; charset=iso-8859-1"],
    ["image/png", "image/png"],
    ["font/woff2", "font/woff2"],
  ]) {
    const response = await fetchWorker(new Request(`${origin}/asset`), {
      ...env, ASSETS: { fetch: async () => new Response("x", { headers: { "Content-Type": served } }) },
    }, ctx);
    assert.equal(response.headers.get("Content-Type"), expected, served);
  }
});

test("unexpected storage and asset failures return logged, sanitized, non-cacheable errors", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const assetError = new Error("synthetic-private-asset-marker");
  assetError.name = "synthetic-private-error-name";
  const failing = {
    ...env,
    ASSETS: { fetch: async () => { throw assetError; } },
    BUDGET: {
      idFromName: () => "synthetic",
      get: () => ({
        reserveAdminAuth: async () => ({ ok: true, bucket: "H2026-11-06T21" }),
        releaseAdminAuth: async () => true,
        exportFeedback: async () => { throw new Error("synthetic-private-storage-marker"); },
      }),
    },
  };
  const asset = await fetchWorker(new Request(`${origin}/`), failing, ctx);
  const feedback = await fetchWorker(new Request(`${origin}/api/feedback/export`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: `Bearer ${env.FEEDBACK_ADMIN_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }), failing, ctx);
  for (const response of [asset, feedback]) {
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(response.headers.get("Content-Type"), /application\/json/);
    assert.doesNotMatch(await response.text(), /synthetic-private/);
  }
  assert.equal(feedback.headers.get("Access-Control-Allow-Origin"), origin);
  assert.deepEqual(logs, [
    ["Worker request failed unexpectedly.", { area: "asset", type: "other" }],
    ["Worker request failed unexpectedly.", { area: "api", type: "Error" }],
  ]);
});

test("unexpected API failures do not allow an untrusted CORS origin", async (t) => {
  t.mock.method(console, "error", () => {});
  const response = await fetchWorker(new Request(`${origin}/api/ideas`, {
    method: "POST", headers: { Origin: "https://attacker.invalid" },
  }), { ...env, BUDGET: { idFromName: () => { throw new Error("synthetic failure"); } } }, ctx);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(response.headers.get("Vary"), "Origin");
});
