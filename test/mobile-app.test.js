import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { apiEndpoint, fetchIdeas, fetchProducts, sendFeedback } from "../site/api.js";
import { APP_ORIGIN, createAppVerification, validVerificationMessage } from "../site/app-verification.js";
import { appFrameHeaders } from "../src/app-headers.js";
import { allowedOrigin } from "../src/core.js";

test("unapproved mobile builds contain no Amazon Special Links", async () => {
  execFileSync(process.execPath, ["scripts/build-mobile.mjs"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, AMAZON_MOBILE_APPROVED: "false" }, stdio: "pipe",
  });
  const html = await readFile(new URL("../mobile/www/index.html", import.meta.url), "utf8");
  assert.match(html, /AMAZON_TAG:\s*""/);
  assert.doesNotMatch(html, /AMAZON_TAG:\s*"mcstarrstud0c-21"/);
  const config = await readFile(new URL("../mobile/www/monetization-config.js", import.meta.url), "utf8");
  assert.match(config, /"AMAZON_TAG":\s*""/);
  const guide = await readFile(new URL("../mobile/www/gifts/gifts-for-mum.html", import.meta.url), "utf8");
  assert.doesNotMatch(guide, /[&;]tag=/);
  assert.match(guide, /https:\/\/www\.amazon\.co\.uk\/s\?/);
});

test("native API routes all request types to HTTPS while browsers remain same-origin", async (t) => {
  t.after(() => { delete globalThis.GIFT_APP_API_BASE; });
  assert.equal(apiEndpoint("/api/ideas"), "/api/ideas");
  globalThis.GIFT_APP_API_BASE = APP_ORIGIN;
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return Response.json({ ideas: [{ title: "Coffee" }], products: [], recorded: true });
  };
  await fetchIdeas({ description: "A coffee lover" }, { fetchImpl });
  await fetchProducts([{ title: "Coffee" }], { fetchImpl });
  await sendFeedback({ event: "more" }, { fetchImpl });
  assert.deepEqual(calls, ["ideas", "products", "feedback"].map((name) => `${APP_ORIGIN}/api/${name}`));
});

test("only the verification page can be framed, only by the two packaged app origins", () => {
  const headers = { "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'" };
  for (const pathname of ["/", "/api/ideas", "/privacy", "/app-verify.js", "/app-verify/"]) {
    assert.equal(appFrameHeaders(pathname, headers), headers);
  }
  for (const pathname of ["/app-verify", "/app-verify.html"]) {
    const framed = appFrameHeaders(pathname, headers);
    assert.equal(framed["X-Frame-Options"], undefined);
    assert.equal(framed["Cache-Control"], "no-store");
    assert.equal(framed["Content-Security-Policy"], "default-src 'self'; frame-ancestors capacitor://localhost https://localhost");
  }
  assert.equal(headers["X-Frame-Options"], "DENY");
});

test("native verification messages require the exact hosted origin and frame window", () => {
  const frame = {};
  const message = { origin: APP_ORIGIN, source: frame, data: { type: "gift-app-verification" } };
  assert.equal(validVerificationMessage(message, frame), true);
  assert.equal(validVerificationMessage({ ...message, origin: "https://evil.example" }, frame), false);
  assert.equal(validVerificationMessage({ ...message, source: {} }, frame), false);
  assert.equal(validVerificationMessage({ ...message, data: {} }, frame), false);
});

function verificationFixture(t) {
  const previous = { document: globalThis.document, window: globalThis.window, location: globalThis.location };
  const listeners = {};
  const classes = new Set();
  const classList = { add: (value) => classes.add(value), remove: (value) => classes.delete(value) };
  const frame = { contentWindow: {}, classList, addEventListener() {} };
  const container = { hidden: true, classList, append() {} };
  globalThis.document = { createElement: () => frame };
  globalThis.window = { addEventListener: (name, callback) => { listeners[name] = callback; } };
  globalThis.location = { protocol: "capacitor:", origin: "null" };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const tokens = [], errors = [], expirations = [];
  const verification = createAppVerification({
    container, siteKey: "test-site-key",
    onToken: (token) => tokens.push(token), onError: (error) => errors.push(error),
    onExpire: () => expirations.push(true),
  });
  const send = (data) => listeners.message({ origin: APP_ORIGIN, source: frame.contentWindow, data: { type: "gift-app-verification", ...data } });
  return { frame, container, classes, tokens, errors, expirations, verification, send };
}

test("verification renews tokens, exposes interactive challenges and releases touch interception", (t) => {
  const fixture = verificationFixture(t);
  const url = new URL(fixture.frame.src);
  assert.equal(url.origin, APP_ORIGIN);
  assert.equal(url.pathname, "/app-verify");
  assert.equal(url.searchParams.get("parent"), "capacitor://localhost");
  assert.equal(url.searchParams.get("sitekey"), "test-site-key");
  fixture.send({ state: "interactive" });
  assert.equal(fixture.container.hidden, false);
  assert.equal(fixture.classes.has("turnstile-interactive"), true);
  fixture.send({ state: "token", token: "verified-token" });
  assert.deepEqual(fixture.tokens, ["verified-token"]);
  assert.equal(fixture.container.hidden, true);
  assert.equal(fixture.classes.has("turnstile-interactive"), false);
  fixture.send({ state: "expired" });
  assert.equal(fixture.expirations.length, 1);
  fixture.verification.reset();
  assert.notEqual(fixture.frame.src, url.href);
  fixture.send({ state: "error" });
  assert.match(fixture.errors[0], /couldn't load/);
});

test("a missing hosted check fails explicitly instead of leaving a search stuck", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fixture = verificationFixture(t);
  t.mock.timers.tick(25000);
  assert.match(fixture.errors[0], /timed out/);
  assert.equal(fixture.container.hidden, true);
});

test("deployed CORS configuration admits exact app origins without opening arbitrary sites", async () => {
  const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const ALLOWED_ORIGINS = config.match(/^ALLOWED_ORIGINS = "([^"]+)"/m)[1];
  for (const origin of ["capacitor://localhost", "https://localhost", APP_ORIGIN]) {
    assert.equal(allowedOrigin(origin, { ALLOWED_ORIGINS }), origin);
  }
  for (const origin of ["null", "http://localhost", "https://localhost.evil.example", "https://evil.example"]) {
    assert.equal(allowedOrigin(origin, { ALLOWED_ORIGINS }), null);
  }
});

test("native sharing distinguishes cancellation from failures and submission dismisses text input", async () => {
  const source = await readFile(new URL("../mobile/native-bridge.js", import.meta.url), "utf8");
  const listeners = new Map(), window = {};
  let failure = new Error("Share canceled"), blurred = false;
  const document = {
    activeElement: { matches: () => true, blur: () => { blurred = true; } },
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  vm.runInNewContext(source.replace(/^import .*\r?\n/gm, ""), {
    window, document, DOMException, console,
    Share: { share: async () => { if (failure) throw failure; return { activityType: "test" }; } },
    App: { addListener: async () => {} }, Browser: {}, Clipboard: {}, Haptics: {}, ImpactStyle: {},
    StatusBar: { setStyle: async () => {} }, Style: { Light: "LIGHT" }, SplashScreen: { hide: async () => {} },
  });
  await assert.rejects(window.GIFT_NATIVE.share({}), (error) => error.name === "AbortError");
  failure = new Error("System sharing is unavailable");
  await assert.rejects(window.GIFT_NATIVE.share({}), (error) => error === failure);
  failure = null;
  assert.equal((await window.GIFT_NATIVE.share({})).activityType, "test");
  listeners.get("submit")();
  assert.equal(blurred, true);
});
