import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const site = (p) => new URL(`../site/${p}`, import.meta.url);
const read = (p) => readFile(site(p), "utf8");

test("at least ten gift guides exist, each with eight ideas and tagged sponsored Amazon links", async () => {
  const files = (await readdir(site("gifts/"))).filter((f) => f.startsWith("gifts-for-") || f.startsWith("secret-santa"));
  assert.ok(files.length >= 10);
  const tag = (await read("index.html")).match(/AMAZON_TAG:\s*"([^"]+)"/)[1];
  for (const file of files) {
    const html = await read(`gifts/${file}`);
    const links = html.match(/<a href="https:\/\/www\.amazon\.co\.uk\/s\?[^"]+"[^>]*>/g) || [];
    assert.equal(links.length, 8, `${file} should have 8 ideas`);
    for (const link of links) {
      assert.match(link, /rel="sponsored noopener"/, file);
      assert.ok(link.includes(`tag=${tag}`), `${file} missing affiliate tag`);
    }
    assert.match(html, /Ad: we earn a commission/, `${file} needs a disclosure`);
    assert.match(html, /<link rel="canonical"/, file);
  }
});

test("sitemap lists every guide and robots.txt points to it", async () => {
  const sitemap = await read("sitemap.xml");
  const files = (await readdir(site("gifts/"))).filter((f) => f.startsWith("gifts-for-") || f.startsWith("secret-santa"));
  for (const file of files) assert.ok(sitemap.includes(`/gifts/${file.replace(".html", "")}`), file);
  assert.match(await read("robots.txt"), /Sitemap: https:\/\/christmasidea\.co\.uk\/sitemap\.xml/);
});

test("404 page exists and is noindex; social image and touch icon are present", async () => {
  assert.match(await read("404.html"), /name="robots" content="noindex"/);
  assert.ok((await readFile(site("og-image.png"))).length > 5000);
  assert.ok((await readFile(site("apple-touch-icon.png"))).length > 100);
  assert.match(await read("index.html"), /og:image/);
});

test("site files are valid UTF-8 without mojibake or a byte-order mark", async () => {
  const names = ["index.html", "about.html", "privacy.html", "404.html", "gifts/index.html", "gifts/gifts-for-mum.html"];
  for (const name of names) {
    const bytes = await readFile(site(name));
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${name} has a BOM`);
    assert.doesNotMatch(bytes.toString("utf8"), /\u00c2|\u00e2\u20ac|\u00c3/, `${name} has mojibake`);
  }
});

test("Worker sets CSP and HSTS headers and locks framing", async () => {
  const src = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(src, /Strict-Transport-Security/);
  assert.match(src, /Content-Security-Policy/);
  assert.match(src, /frame-ancestors 'none'/);
  assert.match(src, /object-src 'none'/);
  assert.match(src, /https:\/\/m\.media-amazon\.com/);
  assert.doesNotMatch(src, /images\.pexels\.com/);
});

test("product cards link the verified image and shopping button to the same Amazon listing", async () => {
  const html = await read("index.html");
  assert.match(html, /\/api\/products/);
  assert.match(html, /link\.href = product\.affiliateUrl/);
  assert.match(html, /shop\.href = product\.affiliateUrl/);
  assert.match(html, /heading\.textContent = product\.title/);
  assert.match(html, /product\.price\?\.currency === "GBP"/);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /loading = "lazy"/);
  assert.match(html, /decoding = "async"/);
  assert.match(html, /Illustrative placeholder/);
  assert.match(html, /Product photo unavailable/);
  assert.doesNotMatch(html, /api\/photos|pexels\.com|images\.pexels\.com/i);
});

test("site privacy text describes optional Amazon product search without Pexels processing", async () => {
  const privacy = await read("privacy.html");
  assert.match(privacy, /Optional product discovery/);
  assert.match(privacy, /one hour/);
  assert.doesNotMatch(privacy, /Pexels/i);
});
