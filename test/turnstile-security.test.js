import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest, normaliseInput, verifyTurnstile } from "../src/core.js";

const ORIGIN = "https://gifts.example.com";
const ENV = {
  ALLOWED_ORIGINS: ORIGIN,
  CANONICAL_HOST: "gifts.example.com",
  IP_SALT: "synthetic-test-salt-0123456789abcdef",
  TURNSTILE_REQUIRED: "true",
  TURNSTILE_SECRET: "synthetic-turnstile-secret",
  ANTHROPIC_API_KEY: "synthetic-unused-api-key",
};
const good = { success: true, hostname: "gifts.example.com", action: "ideas" };
const noFetch = async () => assert.fail("Unexpected dependency access");
const verify = (data, env = ENV, status = 200) =>
  verifyTurnstile("synthetic-token", "192.0.2.10", env, async () => Response.json(data, { status }));
const request = (token = "synthetic-token", extra = {}) =>
  new Request(`${ORIGIN}/api/ideas`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10" },
    body: JSON.stringify({ interests: "coffee", turnstileToken: token, ...extra }),
  });

test("required Turnstile fails closed while explicitly optional local environments remain compatible", async () => {
  for (const secret of [undefined, "", "   "]) {
    assert.equal(await verifyTurnstile("", "", { ...ENV, TURNSTILE_SECRET: secret }, noFetch), false);
  }
  assert.equal(await verifyTurnstile("", "", {}, noFetch), true);
  assert.equal(await verifyTurnstile("", "", ENV, noFetch), false);
  assert.equal(await verifyTurnstile("token", "", { ...ENV, CANONICAL_HOST: "" }, noFetch), false);
});

test("Turnstile accepts exact challenge hostnames and legacy clients without actions", async () => {
  for (const action of ["ideas", "", undefined]) assert.equal(await verify({ ...good, action }), true);
  assert.equal(await verify({ ...good, hostname: "GIFTS.EXAMPLE.COM" }), true);
  assert.equal(await verify({ ...good, hostname: "verify.example.com" }, {
    ...ENV, TURNSTILE_ALLOWED_HOSTNAMES: "verify.example.com",
  }), true);
});

test("a successful challenge response cannot bypass hostname, action or HTTP checks", async () => {
  for (const patch of [
    { success: false }, { success: "true" }, { hostname: undefined }, { hostname: null },
    { hostname: "attacker.invalid" }, { hostname: "gifts.example.com.attacker.invalid" },
    { hostname: "gifts.example.com." }, { hostname: "https://gifts.example.com" },
    { hostname: "localhost" }, { action: "different-action" }, { action: null }, { action: 1 },
  ]) assert.equal(await verify({ ...good, ...patch }), false, JSON.stringify(patch));
  assert.equal(await verify(good, ENV, 500), false);
});

test("Siteverify uses a fixed HTTPS endpoint and a bounded timeout", async (t) => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    assert.equal(milliseconds, 8000);
    return controller.signal;
  });
  assert.equal(await verifyTurnstile("synthetic-token", "192.0.2.10", ENV, async (url, init) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(init.method, "POST");
    assert.equal(init.signal, controller.signal);
    assert.deepEqual(JSON.parse(init.body), {
      secret: ENV.TURNSTILE_SECRET, response: "synthetic-token", remoteip: "192.0.2.10",
    });
    return Response.json(good);
  }), true);
});

test("network errors, timeout and malformed Siteverify JSON fail closed", async (t) => {
  t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort(new DOMException("Synthetic timeout", "TimeoutError")));
  for (const fetchImpl of [
    async () => { throw new Error("synthetic network failure"); },
    async () => new Response("{", { status: 200 }),
    async (_url, init) => { init.signal.throwIfAborted(); },
  ]) assert.equal(await verifyTurnstile("synthetic-token", "", ENV, fetchImpl), false);
});

test("Siteverify replay rejection precedes cache, budget and model access", async () => {
  let verifications = 0;
  let cacheReads = 0;
  const deps = {
    fetch: async (url) => {
      assert.match(String(url), /\/turnstile\/v0\/siteverify$/);
      return Response.json(++verifications === 1 ? good : {
        success: false, "error-codes": ["timeout-or-duplicate"],
      });
    },
    budget: { consume: noFetch },
    cache: { match: async () => { cacheReads++; return Response.json({ ideas: [] }); } },
  };
  assert.equal((await handleRequest(request(), ENV, deps)).status, 200);
  const replay = await handleRequest(request(), ENV, deps);
  assert.equal(replay.status, 403);
  assert.equal((await replay.json()).retryTurnstile, true);
  assert.equal(verifications, 2);
  assert.equal(cacheReads, 1);
});

test("client flags cannot disable required verification", async () => {
  const response = await handleRequest(request("", { TURNSTILE_REQUIRED: "false", skipTurnstile: true }), ENV, {});
  assert.equal(response.status, 403);
});

test("missing required configuration is unavailable rather than an impossible challenge retry", async () => {
  const env = { ...ENV, TURNSTILE_SECRET: "" };
  for (const req of [request(), new Request(`${ORIGIN}/api/ready`)]) {
    const response = await handleRequest(req, env, {});
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /synthetic|secret|hostname|retryTurnstile/);
  }
  assert.equal((await handleRequest(new Request(`${ORIGIN}/api/health`), env, {})).status, 200);
});

test("Turnstile diagnostics never contain upstream content or credentials", async (t) => {
  const calls = [];
  t.mock.method(console, "warn", (...args) => calls.push(args));
  await verifyTurnstile("private-token-marker", "192.0.2.10", ENV, async () => {
    throw new Error("private-upstream-marker");
  });
  assert.deepEqual(calls, [["Turnstile verification failed", "verification_unavailable"]]);
});

test("preflight validates exact origins without requiring challenge tokens", async () => {
  for (const [origin, expected] of [[ORIGIN, 204], ["https://attacker.invalid", 403], ["null", 403]]) {
    const response = await handleRequest(new Request(`${ORIGIN}/api/ideas`, {
      method: "OPTIONS", headers: { Origin: origin },
    }), ENV, {});
    assert.equal(response.status, expected);
  }
});

test("token normalization rejects objects and bounds strings", () => {
  assert.equal(normaliseInput({ interests: "coffee", turnstileToken: "x".repeat(3000) }).token.length, 2048);
  assert.equal(normaliseInput({ interests: "coffee", turnstileToken: { token: "fake" } }).token, "");
});
