import test from "node:test";
import assert from "node:assert/strict";
import { fetchIdeas, fetchProducts, sendFeedback } from "../site/api.js";

const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const idea = { title: "A model-making kit", query: "model building kit" };

test("ideas request sends the existing description and Turnstile token", async () => {
  let request;
  const result = await fetchIdeas({ mode: "describe", description: "My sister likes astronomy." }, {
    turnstileToken: "turnstile-token",
    fetchImpl: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return response({ ideas: [idea], source: "ai" });
    },
  });
  assert.equal(request.url, "/api/ideas");
  assert.equal(request.body.description, "My sister likes astronomy.");
  assert.equal(request.body.turnstileToken, "turnstile-token");
  assert.equal(result.ideas[0].title, idea.title);
  assert.equal(result.error, false);
});

test("catalogue fallback ideas remain usable when the AI request returns an error status", async () => {
  const result = await fetchIdeas({ mode: "describe", description: "A young train fan." }, {
    fetchImpl: async () => response({
      fallback: true,
      source: "catalogue",
      ideas: [idea],
      error: "AI recommendations are temporarily unavailable.",
    }, 503),
  });
  assert.equal(result.source, "catalogue");
  assert.deepEqual(result.ideas, [idea]);
  assert.match(result.notice, /temporarily unavailable/);
});

test("malformed success responses produce a retryable user-facing error", async () => {
  const result = await fetchIdeas({}, {
    fetchImpl: async () => new Response("{", { status: 200 }),
  });
  assert.equal(result.ideas.length, 0);
  assert.equal(result.error, true);
  assert.match(result.notice, /description is still here/i);
});

test("HTTP errors are translated without exposing response internals", async () => {
  const forbidden = await fetchIdeas({}, {
    fetchImpl: async () => response({ error: "secret provider detail" }, 403),
  });
  assert.match(forbidden.notice, /security check/);
  assert.doesNotMatch(forbidden.notice, /secret provider detail/);

  const limited = await fetchIdeas({}, {
    fetchImpl: async () => response({ error: "private implementation detail" }, 429),
  });
  assert.match(limited.notice, /too many searches/i);
  assert.doesNotMatch(limited.notice, /private implementation detail/);
});

test("Turnstile retry responses preserve the recovery signal and show an actionable notice", async () => {
  const result = await fetchIdeas({}, {
    fetchImpl: async () => response({ error: "verification detail", retryTurnstile: true }, 403),
  });
  assert.equal(result.retryTurnstile, true);
  assert.match(result.notice, /security check needs refreshing/i);
  assert.doesNotMatch(result.notice, /verification detail/);
});

test("network interruption and timeout preserve the shopper's description and allow retry", async () => {
  const disconnected = await fetchIdeas({}, { fetchImpl: async () => { throw new TypeError("offline"); } });
  assert.equal(disconnected.error, true);
  assert.match(disconnected.notice, /description is still here/i);

  const controller = new AbortController();
  controller.abort("timeout");
  const timedOut = await fetchIdeas({}, {
    signal: controller.signal,
    fetchImpl: async (_url, init) => {
      if (init.signal.aborted) throw new DOMException("Aborted", "AbortError");
      return response({});
    },
  });
  assert.equal(timedOut.error, true);
  assert.match(timedOut.notice, /taking longer/i);

  const cancelledController = new AbortController();
  cancelledController.abort("cancelled");
  const cancelled = await fetchIdeas({}, {
    signal: cancelledController.signal,
    fetchImpl: async (_url, init) => {
      if (init.signal.aborted) throw new DOMException("Aborted", "AbortError");
      return response({});
    },
  });
  assert.equal(cancelled.error, false);
  assert.match(cancelled.notice, /cancelled/i);
});

test("no suitable ideas is distinct from a request failure", async () => {
  const result = await fetchIdeas({}, {
    fetchImpl: async () => response({ ideas: [], note: "No suitable catalogue ideas." }),
  });
  assert.equal(result.error, false);
  assert.match(result.notice, /No suitable catalogue ideas/);
});

test("product discovery failures safely keep gift concepts available", async () => {
  assert.deepEqual(await fetchProducts([idea], {
    fetchImpl: async () => response({ error: "provider detail" }, 429),
  }), { products: [], unavailable: true });

  assert.deepEqual(await fetchProducts([idea], {
    fetchImpl: async () => response({ products: "not a list" }),
  }), { products: [], unavailable: true });

  assert.deepEqual(await fetchProducts([idea], {
    enabled: false,
    fetchImpl: async () => { throw new Error("must not make a request"); },
  }), { products: [], unavailable: false });
});

test("feedback reports success only when the endpoint confirms it was recorded", async () => {
  const body = { event: "dismiss", item: { strategy: "core-interest", source: "model", position: 0 } };
  assert.equal(await sendFeedback(body, { fetchImpl: async () => response({ ok: true, recorded: true }, 202) }), true);
  assert.equal(await sendFeedback(body, { fetchImpl: async () => response({ ok: true, recorded: false }, 202) }), false);
  assert.equal(await sendFeedback(body, { fetchImpl: async () => response({ error: "rate limited" }, 429) }), false);
  assert.equal(await sendFeedback(body, { fetchImpl: async () => { throw new TypeError("offline"); } }), false);
});
