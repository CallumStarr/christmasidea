import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const site = new URL("../site/", import.meta.url);
const read = (name) => readFile(new URL(name, site), "utf8");
const tokens = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]));
function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("the approved light palette stays fixed and its text, controls and focus tokens meet AA", async () => {
  const css = await read("theme.css");
  assert.match(css, /color-scheme:only light;/);
  assert.doesNotMatch(css, /prefers-color-scheme/);
  const root = css.match(/:root\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(root);
  for (const [theme, palette] of [["approved light", tokens(root)]]) {
    for (const background of ["paper", "surface", "inset"]) {
      for (const foreground of ["ink", "muted", "accent", "gold-ink"]) {
        assert.ok(contrast(palette[foreground], palette[background]) >= 4.5, `${theme}: ${foreground} on ${background}`);
      }
      assert.ok(contrast(palette.focus, palette[background]) >= 3, `${theme}: focus on ${background}`);
      assert.ok(contrast(palette.muted, palette[background]) >= 3, `${theme}: control border on ${background}`);
    }
    for (const background of ["accent", "accent-hover"]) {
      assert.ok(contrast(palette["on-accent"], palette[background]) >= 4.5, `${theme}: button on ${background}`);
    }
    assert.ok(contrast(palette.error, palette["error-bg"]) >= 4.5, `${theme}: error message`);
  }
});

test("every page uses shared local fonts and theme, without inline font drift", async () => {
  const names = [
    ...(await readdir(site)).filter((name) => name.endsWith(".html")),
    ...(await readdir(new URL("gifts/", site))).filter((name) => name.endsWith(".html")).map((name) => `gifts/${name}`),
  ];
  for (const name of names) {
    const html = await read(name);
    assert.match(html, /href="\/theme\.css"/, name);
    assert.match(html, /href="\/fonts\/fraunces\.woff2"/, name);
    assert.match(html, /href="\/fonts\/figtree\.woff2"/, name);
    assert.match(html, /name="theme-color" content="#FBF7F0"/, name);
    assert.match(html, /name="color-scheme" content="only light"/, name);
    assert.doesNotMatch(html, /name="theme-color"[^>]*media=|#1C1518/i, name);
    assert.doesNotMatch(html, /font-family:Arial|<canvas|linearGradient|radial-gradient/i, name);
  }
  const css = await read("theme.css");
  assert.match(css, /--display:"Fraunces"/);
  assert.match(css, /--body:"Figtree"/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("editorial styles stay lightweight and avoid gradients, shadows and uniform three-column cards", async () => {
  const styles = await Promise.all(["theme.css", "home.css", "guide.css"].map(read));
  const css = styles.join("\n");
  assert.ok(gzipSync(css).length < 10000, "combined styles must stay below 10 kB gzipped");
  assert.doesNotMatch(css, /gradient\(|box-shadow:|drop-shadow\(|repeat\(3,1fr\)/);
  assert.match(styles[1], /\.card\.featured\{\s*grid-column:span 7/);
  assert.match(styles[1], /\.card\.companion\{grid-column:span 5/);
  assert.match(styles[1], /@media\(max-width:760px\)/);
  assert.match(styles[1], /\.cards\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(styles[1], /\.card\.solo\{grid-column:1\/-1\}/);
  const mobile = styles[1].slice(styles[1].indexOf("@media(max-width:760px)"));
  assert.match(mobile, /\.card,\.card\.featured,\.card\.companion,\.card\.solo\{grid-column:1\/-1\}/,
    "all recommendation roles must collapse into a single mobile reading column");
});

test("the homepage keeps a focused finder without an example sidebar or fake product imagery", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /example-edit|example-title|example-try|gift-objects\.svg#finder/);
  assert.match(html, /id="form"/);
  assert.match(html, /data-description="[^"]+"/);
  assert.match(html, /description\.value = button\.dataset\.description/);
  assert.match(html, /id="nav-shortlist"/);
  assert.match(html, /class="recommendation-disclosure"/);
  assert.doesNotMatch(html, /GIFT_SVG|Illustrative placeholder/);
  const styles = await read("home.css");
  assert.match(styles, /\.atelier\{max-width:840px;/);
  assert.match(html, /class="seasonal-hero"/);
  assert.match(html, /class="browse-band"/);
  assert.match(styles, /\.browse-band\{[^}]*border-block:3px double var\(--accent\)/);
  assert.doesNotMatch(styles, /\.example-/);
  assert.match(styles, /\.media\{display:none\}/);
  assert.match(styles, /\.verified \.media\{display:block/);
  assert.equal((html.match(/<img class="editorial-photo"/g) || []).length, 3);
  assert.doesNotMatch(html, /gift-objects\.svg/);
  assert.match(html, /guide images are AI-created illustrations, not photos of products we've tested/);
});

test("featured recommendations retain readable oxblood palettes in either theme", async () => {
  const css = await read("home.css");
  const featured = tokens(css.match(/\.card\.featured\{([\s\S]*?)\n\}/)[1]);
  for (const foreground of ["ink", "muted", "accent", "gold-ink"]) {
    assert.ok(contrast(featured[foreground], featured.paper) >= 4.5, foreground);
    assert.ok(contrast(featured[foreground], featured.surface) >= 4.5, `${foreground} on inset`);
  }
  assert.ok(contrast(featured.focus, featured.paper) >= 3);
  assert.equal(featured.paper, "#591125");
  assert.doesNotMatch((await Promise.all(["theme.css", "home.css", "guide.css"].map(read))).join("\n"), /#1b3b2b|#284735/i);
});

test("photographic guides remain unframed and captions use the shared accessible palette", async () => {
  const css = await read("home.css");
  assert.doesNotMatch(css, /\.guide-(?:garden|books|gesture) \.guide-art\{background:/);
  assert.match(css, /\.guide-copy h3\{[^}]*color:var\(--accent\)/);
  assert.match(await read("theme.css"), /\.editorial-photo\{[^}]*aspect-ratio:10\/7/);
  assert.match(css, /\.guide-art \.editorial-photo\{/);
  assert.match(await read("theme.css"), /\.site-footer\{[^}]*background:var\(--paper\);color:var\(--accent\)/);
});
