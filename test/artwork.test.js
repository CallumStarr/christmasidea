import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";

const site = new URL("../site/", import.meta.url);
const read = (file) => readFile(new URL(file, site), "utf8");
const scenes = ["garden", "books", "space", "play", "baby", "history", "coffee", "mum", "dad", "gesture"];

test("all approved editorial images have correctly sized and budgeted responsive variants", async () => {
  for (const name of scenes) {
    const master = await sharp(await readFile(new URL(`../assets/editorial/${name}.webp`, import.meta.url))).metadata();
    assert.equal(master.width, 1400, name);
    assert.equal(master.height, 980, name);
    for (const [width, budget] of [[400, 35000], [800, 100000], [1200, 180000]]) {
      const bytes = await readFile(new URL(`images/${name}-${width}.webp`, site));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "webp", name);
      assert.equal(metadata.width, width, name);
      assert.equal(metadata.height, width * 0.7, name);
      assert.ok(bytes.length < budget, `${name} ${width}: ${bytes.length} exceeds ${budget}`);
    }
  }
});

test("all rendered editorial images reserve space and expose responsive local sources", async () => {
  const files = ["index.html", ...(await readdir(new URL("gifts/", site))).map((name) => `gifts/${name}`)];
  for (const file of files) {
    const html = await read(file);
    assert.doesNotMatch(html, /gift-objects\.svg|guide-motifs\.svg|atelier\.svg/, file);
    const images = [...html.matchAll(/<img class="editorial-photo"[^>]+>/g)];
    assert.ok(images.length, file);
    assert.match(html, /AI-created illustrations, not (?:a photograph|photos) of products we've tested/, file);
    for (const [image] of images) {
      const name = image.match(/src="\/images\/([a-z]+)-800\.webp"/)?.[1];
      assert.ok(scenes.includes(name), file);
      assert.match(image, /width="1200" height="840"/);
      assert.match(image, /decoding="async"/);
      assert.match(image, /sizes="[^"]+"/);
      for (const width of [400, 800, 1200]) assert.ok(image.includes(`/images/${name}-${width}.webp ${width}w`));
    }
  }
});

test("guide heroes describe AI-created scenes and decorative linked images avoid repeated descriptions", async () => {
  const names = (await readdir(new URL("gifts/", site))).filter((name) => name !== "index.html");
  for (const name of names) {
    const html = await read(`gifts/${name}`);
    const hero = html.match(/<div class="guide-illustration[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    assert.ok(hero, name);
    assert.match(hero, /alt="AI-created scene of [^"]{35,}"/, name);
    assert.match(hero, /loading="eager"/, name);
    assert.match(html, /class="directory-art[^"]*" aria-hidden="true"/, name);
    for (const [, image] of html.matchAll(/<div class="directory-art[^>]+>([\s\S]*?)<\/div>/g)) {
      assert.match(image, /alt="" loading="lazy"/, name);
    }
  }
});

test("the approved Christmas banner has local responsive variants and priority loading", async () => {
  for (const [width, height, budget] of [[800, 356, 40000], [1400, 622, 90000], [2000, 889, 160000]]) {
    const bytes = await readFile(new URL(`images/christmas-${width}.webp`, site));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.equal(metadata.format, "webp");
    assert.ok(bytes.length < budget);
  }
  const html = await read("index.html");
  const hero = html.match(/<img class="hero-photo"[^>]+>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /fetchpriority="high"/);
  assert.match(hero, /alt=""/);
  assert.match(hero, /width="2000" height="889"/);
  assert.doesNotMatch(hero, /loading="lazy"/);
  for (const width of [800, 1400, 2000]) assert.ok(hero.includes(`/images/christmas-${width}.webp ${width}w`));
  assert.match(html, /A little thought\.<br>A lovely gift\./);
  const css = await read("home.css");
  assert.match(css.slice(css.indexOf("@media(max-width:760px)")), /\.hero-photo\{object-position:left center\}/,
    "the mobile crop must keep the headline on the empty linen, away from the presents");
});

test("social artwork and home-screen icon use the approved oxblood and ivory identity", async () => {
  for (const [name, width, height, budget] of [
    ["og-image.png", 1200, 630, 300000],
    ["apple-touch-icon.png", 180, 180, 20000],
  ]) {
    const bytes = await readFile(new URL(name, site));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, width, name);
    assert.equal(metadata.height, height, name);
    assert.ok(bytes.length < budget, name);
    const pixel = await sharp(bytes).extract({ left: 20, top: 20, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel], [251, 247, 240], name);
  }
  for (const name of ["favicon.svg", "brand-icon.svg", "og-image.svg"]) {
    const svg = await read(name);
    assert.match(svg, /#6d1028/);
    assert.doesNotMatch(svg, /#1b3b2b/);
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)|<image|<script/i);
  }
});
