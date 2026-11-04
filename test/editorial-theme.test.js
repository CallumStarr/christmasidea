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

test("heritage text, controls and focus tokens meet AA in both themes", async () => {
  const css = await read("theme.css");
  const [light, dark] = css.split("@media(prefers-color-scheme:dark)");
  for (const [theme, palette] of [["light", tokens(light)], ["dark", { ...tokens(light), ...tokens(dark) }]]) {
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

test("the atelier uses original lightweight local art without fake product imagery", async () => {
  const html = await read("index.html");
  assert.match(html, /src="\/atelier\.svg" width="640" height="700" alt=""/);
  assert.match(html, /data-description="[^"]+"/);
  assert.match(html, /description\.value = button\.dataset\.description/);
  assert.match(html, /id="nav-shortlist"/);
  assert.match(html, /class="recommendation-disclosure"/);
  assert.doesNotMatch(html, /GIFT_SVG|Illustrative placeholder/);
  const styles = await read("home.css");
  assert.match(styles, /\.media\{display:none\}/);
  assert.match(styles, /\.verified \.media\{display:block/);
  for (const name of ["atelier.svg", "guide-motifs.svg"]) {
    const svg = await read(name);
    assert.ok(Buffer.byteLength(svg) < 30000, `${name} exceeds artwork budget`);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|https?:\/\/(?!www\.w3\.org)/i);
  }
});

test("featured recommendation and colophon have readable fixed palettes in either theme", async () => {
  const css = await read("home.css");
  const featured = tokens(css.match(/\.card\.featured\{([\s\S]*?)\n\}/)[1]);
  for (const foreground of ["ink", "muted", "accent", "gold-ink"]) {
    assert.ok(contrast(featured[foreground], featured.paper) >= 4.5, foreground);
    assert.ok(contrast(featured[foreground], featured.surface) >= 4.5, `${foreground} on inset`);
  }
  assert.ok(contrast(featured.focus, featured.paper) >= 3);
  assert.ok(contrast("#f4ead5", "#1b3b2b") >= 4.5, "footer wordmark");
  assert.ok(contrast("#cbd2c2", "#1b3b2b") >= 4.5, "footer small print");
});

test("original artwork captions meet AA on their fixed paper colours", async () => {
  const css = await read("home.css");
  const panels = [...css.matchAll(/\.guide-(?:garden|books|gesture) \.guide-art\{background:(#[\da-f]{6});color:(#[\da-f]{6})/gi)];
  assert.equal(panels.length, 3);
  for (const [, background, foreground] of panels) assert.ok(contrast(foreground, background) >= 4.5);
  const note = css.match(/\.art-note\{[^}]*background:(#[\da-f]{6});color:(#[\da-f]{6})/i);
  assert.ok(note);
  assert.ok(contrast(note[2], note[1]) >= 4.5);
});
