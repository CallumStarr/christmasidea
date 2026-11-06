import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createTurnstileTokenGate, TurnstileTokenError } from "../site/turnstile-token.js";
import { fetchIdeas } from "../site/api.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("the real widget is visible and interactive only when a challenge needs input", async () => {
  const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
  const source = html.slice(html.indexOf("let tsWidget = null;"), html.indexOf("/* ---------- API ---------- */"));
  const classes = new Set(), widget = {
    classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value) },
  };
  let options, resets = 0;
  const context = {
    CFG: { USE_API: true, TURNSTILE_SITE_KEY: "test-site-key" },
    createTurnstileTokenGate, TurnstileTokenError, $: () => widget,
    setStatus() {},
    document: { createElement: () => ({ addEventListener() {} }), head: { append() {} } },
    window: { turnstile: {
      render(_selector, value) { options = value; return 1; },
      reset() { resets++; },
    } },
  };
  runInNewContext(source, context);
  context.window.onTurnstileLoad();
  assert.equal(options.appearance, "interaction-only");
  options["before-interactive-callback"]();
  assert.equal(classes.has("turnstile-interactive"), true);
  options["after-interactive-callback"]();
  assert.equal(classes.has("turnstile-interactive"), false);
  options["before-interactive-callback"]();
  options.callback("fresh-widget-token");
  assert.equal(classes.has("turnstile-interactive"), false);
  assert.equal(await runInNewContext("tsGate.acquire()", context), "fresh-widget-token");
  runInNewContext("tsGate.finish()", context);
  options["before-interactive-callback"]();
  runInNewContext("resetTurnstile()", context);
  assert.equal(resets, 1);
  assert.equal(classes.has("turnstile-interactive"), false);
  options["before-interactive-callback"]();
  options["error-callback"]();
  assert.equal(classes.has("turnstile-interactive"), false);
  assert.equal(runInNewContext("tsGate.failed", context), true);
});

test("initial search and Show me different ideas consume distinct, freshly supplied tokens", async () => {
  const gate = createTurnstileTokenGate();
  const used = new Set();
  const submitted = [];
  let resets = 0;
  const request = async (action, token) => {
    assert.ok(!used.has(token), `token ${token} was reused`);
    used.add(token);
    submitted.push({ action, token });
    return { ok: true };
  };
  const reset = () => { resets += 1; };

  gate.provide("token-A");
  await gate.execute((token) => request("search", token), { reset });
  const second = gate.execute((token) => request("more", token), { reset });
  await tick();
  assert.deepEqual(submitted, [{ action: "search", token: "token-A" }]);
  gate.provide("token-B");
  await second;

  assert.deepEqual(submitted, [
    { action: "search", token: "token-A" },
    { action: "more", token: "token-B" },
  ]);
  assert.equal(resets, 2);
});

test("a failed or uncertain request consumes its token and resets for the next attempt", async () => {
  const gate = createTurnstileTokenGate();
  const used = new Set();
  let resets = 0;
  gate.provide("token-A");
  await assert.rejects(gate.execute(async (token) => {
    used.add(token);
    throw new TypeError("network disconnected after send");
  }, { reset: () => { resets += 1; } }), /network disconnected/);

  const next = gate.execute(async (token) => {
    assert.equal(used.has(token), false);
    used.add(token);
    return token;
  }, { reset: () => { resets += 1; } });
  await tick();
  gate.provide("token-B");
  assert.equal(await next, "token-B");
  assert.equal(resets, 2);
});

test("duplicate submissions cannot obtain or send a second token while busy", async () => {
  const gate = createTurnstileTokenGate();
  let finishRequest;
  let requests = 0;
  gate.provide("token-A");
  const first = gate.execute(() => new Promise((resolve) => {
    requests += 1;
    finishRequest = resolve;
  }));
  await tick();

  await assert.rejects(gate.execute(async () => { requests += 1; }), TurnstileTokenError);
  assert.equal(requests, 1);
  finishRequest("done");
  assert.equal(await first, "done");
});

test("expired tokens are discarded and the next search waits for a new token", async () => {
  const gate = createTurnstileTokenGate();
  const request = async (token) => token;
  gate.provide("expired-token");
  gate.invalidate();
  const pending = gate.execute(request);
  await tick();
  gate.provide("fresh-token");
  assert.equal(await pending, "fresh-token");
});

test("cancelling while waiting for a challenge submits nothing and permits a later fresh token", async () => {
  const gate = createTurnstileTokenGate();
  const controller = new AbortController();
  let requests = 0;
  const pending = gate.execute(async () => { requests += 1; }, { signal: controller.signal });
  await tick();
  controller.abort("cancelled");
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requests, 0);

  gate.provide("fresh-token");
  assert.equal(await gate.execute(async (token) => {
    requests += 1;
    return token;
  }), "fresh-token");
  assert.equal(requests, 1);
});

test("cancellation after sending a token resets it and requires a fresh token", async () => {
  const gate = createTurnstileTokenGate();
  const controller = new AbortController();
  const submitted = [];
  let resets = 0;
  gate.provide("token-A");
  const pending = gate.execute((token) => new Promise((resolve) => {
    submitted.push(token);
    controller.signal.addEventListener("abort", () => resolve("cancelled"), { once: true });
  }), {
    signal: controller.signal,
    reset: () => { resets += 1; },
  });
  await tick();
  controller.abort("cancelled");
  assert.equal(await pending, "cancelled");
  assert.deepEqual(submitted, ["token-A"]);

  const next = gate.execute(async (token) => {
    submitted.push(token);
    return token;
  }, { reset: () => { resets += 1; } });
  await tick();
  gate.provide("token-B");
  assert.equal(await next, "token-B");
  assert.deepEqual(submitted, ["token-A", "token-B"]);
  assert.equal(resets, 2);
});

test("API retryTurnstile response resets the widget and the next request uses a fresh token", async () => {
  const gate = createTurnstileTokenGate();
  let resets = 0;
  const send = (token) => fetchIdeas({}, {
    turnstileToken: token,
    fetchImpl: async () => new Response(JSON.stringify({
      error: "verification failed",
      retryTurnstile: true,
    }), { status: 403 }),
  });

  gate.provide("token-A");
  const retryResponse = await gate.execute(send, { reset: () => { resets += 1; } });
  assert.equal(retryResponse.retryTurnstile, true);
  assert.match(retryResponse.notice, /security check needs refreshing/i);
  assert.equal(resets, 1);

  const next = gate.execute(async (token) => token, { reset: () => { resets += 1; } });
  await tick();
  gate.provide("token-B");
  assert.equal(await next, "token-B");
  assert.equal(resets, 2);
});

test("reset failure blocks retries until the widget is explicitly recovered", async () => {
  const gate = createTurnstileTokenGate();
  gate.provide("token-A");
  await assert.rejects(gate.execute(async () => "sent", {
    reset: () => {
      gate.fail("Refresh the security check.");
      throw new TurnstileTokenError("Refresh the security check.");
    },
  }), TurnstileTokenError);
  await assert.rejects(gate.execute(async () => "must not run"), /Refresh the security check/);

  gate.recover();
  gate.provide("token-B");
  assert.equal(await gate.execute(async (token) => token), "token-B");
});
