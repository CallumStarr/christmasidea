import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/core.js";

const origin = "https://gifts.example.com";
const env = {
  ALLOWED_ORIGINS: `${origin},https://www.gifts.example.com,capacitor://localhost,https://localhost`,
  IP_SALT: "synthetic-test-salt-0123456789abcdef",
  FEEDBACK_ADMIN_TOKEN: "synthetic-admin-token-0123456789abcdef",
};
const routes = [
  ["ideas", 8000], ["products", 12000], ["feedback", 16000],
  ["feedback/export", 2000], ["knowledge/export", 2000], ["feedback/review", 2000],
];
const headers = {
  Origin: origin, "Content-Type": "application/json",
  Authorization: `Bearer ${env.FEEDBACK_ADMIN_TOKEN}`,
};

for (const [route, limit] of routes) {
  test(`${route}: direct callers cannot bypass methods, origin or JSON boundaries`, async () => {
    const cases = [
      [{ method: "GET" }, 405],
      [{ method: "PUT", body: "{}" }, 405],
      [{ headers: { ...headers, Origin: "null" }, body: "{}" }, 403],
      [{ headers: { ...headers, Origin: `${origin}.attacker.invalid` }, body: "{}" }, 403],
      [{ headers: { ...headers, "Content-Type": "text/plain" }, body: "{}" }, 415],
      [{ body: "{" }, 400],
      [{ body: " ".repeat(limit + 1) }, 413],
      [{ headers: { ...headers, "Content-Length": String(limit + 1) }, body: "{}" }, 413],
    ];
    for (const [options, expected] of cases) {
      const result = await handleRequest(new Request(`${origin}/api/${route}`, {
        method: "POST", headers, ...options,
      }), env, {});
      assert.equal(result.status, expected, `${route}: ${JSON.stringify(options).slice(0,160)}`);
      assert.match(result.headers.get("Content-Type"), /application\/json/);
      assert.equal(result.headers.get("Cache-Control"), "no-store");
    }
  });

  test(`${route}: understated content length cannot hide an oversized streamed body`, async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(" ".repeat(limit + 1)));
        controller.close();
      },
    });
    const result = await handleRequest(new Request(`${origin}/api/${route}`, {
      method: "POST", headers: { ...headers, "Content-Length": "2" }, body: stream, duplex: "half",
    }), env, {});
    assert.equal(result.status, 413);
  });
}

test("every administrative endpoint independently requires bearer authorization", async () => {
  for (const route of ["feedback/export", "knowledge/export", "feedback/review"]) {
    for (const authorization of ["", "Bearer wrong-token", "Basic synthetic"]) {
      const result = await handleRequest(new Request(`${origin}/api/${route}`, {
        method: "POST", headers: { ...headers, Authorization: authorization }, body: "{}",
      }), env, {});
      assert.equal(result.status, 401, `${route}: unauthorized caller`);
    }
  }
});

test("preflight distinguishes all deployed origin classes from spoofed or malformed origins", async () => {
  for (const allowed of env.ALLOWED_ORIGINS.split(",")) {
    const result = await handleRequest(new Request(`${origin}/api/ideas`, {
      method: "OPTIONS", headers: { Origin: allowed },
    }), env, {});
    assert.equal(result.status, 204);
    assert.equal(result.headers.get("Access-Control-Allow-Origin"), allowed);
    assert.match(result.headers.get("Vary"), /Origin/i);
    assert.notEqual(result.headers.get("Access-Control-Allow-Credentials"), "true");
  }
  for (const rejected of ["null", "", "http://gifts.example.com", `${origin}.`, `${origin}/`, `${origin}:444`, "https://gifts.example.com@attacker.invalid"]) {
    const result = await handleRequest(new Request(`${origin}/api/ideas`, {
      method: "OPTIONS", headers: { Origin: rejected },
    }), env, {});
    assert.equal(result.status, 403, rejected);
    assert.equal(result.headers.get("Access-Control-Allow-Origin"), null);
  }
});

test("health is liveness, while readiness fails closed on an unusable salt", async () => {
  for (const salt of [undefined, "", "x".repeat(31)]) {
    const config = { ...env, IP_SALT: salt };
    assert.equal((await handleRequest(new Request(`${origin}/api/health`), config, {})).status, 200);
    assert.equal((await handleRequest(new Request(`${origin}/api/ready`), config, {})).status, 503);
  }
  assert.equal((await handleRequest(new Request(`${origin}/api/ready`), env, {})).status, 200);
});

test("Anthropic error bodies and exception strings never reach logs or responses", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  for (const fetch of [
    async () => new Response("synthetic-private-upstream-marker", { status: 502 }),
    async () => { throw new Error("synthetic-private-exception-marker"); },
  ]) {
    const response = await handleRequest(new Request(`${origin}/api/ideas`, {
      method: "POST", headers, body: JSON.stringify({ interests: "gardening", age: "adult" }),
    }), { ...env, ANTHROPIC_API_KEY: "synthetic-unused-api-key" }, {
      fetch, budget: { consume: async () => ({ ok: true }) },
    });
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /synthetic-private/);
  }
  assert.deepEqual(logs, [["Claude call failed", 502], ["Claude call failed", 0]]);
});
