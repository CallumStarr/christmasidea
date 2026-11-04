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
    assert.match(html, /Editorial imagery is AI-created/, file);
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

test("social artwork and home-screen icon retain their approved dimensions and current palette", async () => {
  for (const [name, width, height, budget] of [
    ["og-image.png", 1200, 630, 150000],
    ["apple-touch-icon.png", 180, 180, 20000],
  ]) {
    const bytes = await readFile(new URL(name, site));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, width, name);
    assert.equal(metadata.height, height, name);
    assert.ok(bytes.length < budget, name);
    const pixel = await sharp(bytes).extract({ left: 20, top: 20, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel], name === "og-image.png" ? [251, 249, 245] : [27, 59, 43], name);
  }
  for (const name of ["favicon.svg", "brand-icon.svg", "og-image.svg"]) {
    const svg = await read(name);
    assert.match(svg, /#1b3b2b/);
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)|<image|<script/i);
  }
});
