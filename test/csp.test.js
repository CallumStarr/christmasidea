import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inlineScriptHashes, renderHashModule, siteInlineScriptHashes } from "../scripts/build-csp-hashes.mjs";
import { fetchWorker } from "../src/worker-fetch.js";

const origin = "https://christmasidea.co.uk";
const directive = (csp, name) => csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) || "";
const html = (body) => new Response(body, { headers: { "Content-Type": "text/html" } });
const env = { ASSETS: { fetch: async () => html("<!doctype html><title>t</title>") } };
const ctx = { waitUntil() {} };

test("generated CSP hash module matches every executable inline script in site HTML", () => {
  const generated = readFileSync(new URL("../src/csp-hashes.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(generated, renderHashModule(siteInlineScriptHashes()), "run `npm run build:pages` after editing inline scripts");
});

test("served pages allow inline scripts only by hash and never by 'unsafe-inline'", async () => {
  for (const path of ["/", "/gifts/gifts-for-mum", "/app-verify", "/missing-page"]) {
    const response = await fetchWorker(new Request(`${origin}${path}`), env, ctx);
    const csp = response.headers.get("Content-Security-Policy");
    const scripts = directive(csp, "script-src");
    assert.doesNotMatch(scripts, /'unsafe-inline'|'unsafe-eval'|\*/, path);
    for (const [hash] of siteInlineScriptHashes()) assert.ok(scripts.includes(hash), `${path} missing ${hash}`);
    assert.match(scripts, /https:\/\/challenges\.cloudflare\.com/, "Turnstile remains allowed");
    for (const [name, value] of [["object-src", "'none'"], ["base-uri", "'self'"], ["form-action", "'self'"]]) {
      assert.equal(directive(csp, name), `${name} ${value}`, `${path} ${name}`);
    }
  }
  const verify = await fetchWorker(new Request(`${origin}/app-verify`), env, ctx);
  assert.match(verify.headers.get("Content-Security-Policy"), /frame-ancestors capacitor:\/\/localhost https:\/\/localhost/);
});

test("hashes follow browser newline normalisation and ignore external and data scripts", () => {
  const lf = inlineScriptHashes('<script>\nwindow.A = 1;\n</script>');
  assert.deepEqual(inlineScriptHashes('<script>\r\nwindow.A = 1;\r\n</script>'), lf);
  assert.equal(lf.length, 1);
  assert.match(lf[0], /^'sha256-[A-Za-z0-9+/]{43}='$/);
  assert.deepEqual(inlineScriptHashes('<script src="/a.js"></script><script type="application/ld+json">{}</script>'), []);
  assert.equal(inlineScriptHashes('<script type="module">x()</script>').length, 1);
  assert.notDeepEqual(inlineScriptHashes("<script>window.A = 2;</script>"), lf, "any edit changes the hash");
});

test("native verification removes DENY inherited from static asset headers", async () => {
  const assetEnv = { ASSETS: { fetch: async () => new Response("<!doctype html>", {
    headers: { "Content-Type": "text/html", "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'" },
  }) } };
  for (const path of ["/app-verify", "/app-verify.html"]) {
    const response = await fetchWorker(new Request(`${origin}${path}`), assetEnv, ctx);
    assert.equal(response.headers.get("X-Frame-Options"), null);
    assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors capacitor:\/\/localhost https:\/\/localhost/);
  }
  const normal = await fetchWorker(new Request(`${origin}/`), assetEnv, ctx);
  assert.equal(normal.headers.get("X-Frame-Options"), "DENY");
});

test("the mobile WebView CSP is built from the bundled HTML without 'unsafe-inline' scripts", () => {
  const build = readFileSync(new URL("../scripts/build-mobile.mjs", import.meta.url), "utf8");
  assert.match(build, /script-src 'self' \$\{\[\.\.\.new Set\(inlineScriptHashes\(html\)\)\]/);
  assert.doesNotMatch(build, /script-src 'self' 'unsafe-inline'/);
});
