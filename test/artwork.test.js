import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";

const site = new URL("../site/", import.meta.url);
const read = (file) => readFile(new URL(file, site), "utf8");
const scenes = {
  garden: ["watering-can", "trowel", "seeds", "snips"],
  books: ["book", "glasses", "lamp", "mug"],
  space: ["telescope", "stars"],
  play: ["train", "blocks", "pencils"],
  baby: ["bear"],
  history: ["museum", "map"],
  coffee: ["press", "teapot", "mug"],
  mum: ["gift", "journal", "candle", "mug"],
  dad: ["headphones", "flask", "binoculars"],
  gesture: ["gift", "pot", "mug"],
};

test("each guide scene has recognisable category objects and a descriptive title", async () => {
  const svg = await read("gift-objects.svg");
  assert.ok(Buffer.byteLength(svg) < 30000);
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "SVG IDs must be unique");
  for (const [, reference] of svg.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.includes(reference), `Unresolved artwork reference: ${reference}`);
  }
  for (const [id, objects] of Object.entries(scenes)) {
    const symbol = svg.match(new RegExp(`<symbol id="${id}"[^>]*>([\\s\\S]*?)</symbol>`))?.[1];
    assert.ok(symbol, id);
    assert.match(symbol, /<title>[^<]{30,}<\/title>/);
    for (const object of objects) assert.ok(symbol.includes(`href="#${object}"`), `${id}: ${object}`);
  }
  assert.doesNotMatch(svg, /<script|<image|<foreignObject|<filter|<linearGradient/i);
});

test("all ten scenes render with generous clear edges and visible detail at thumbnail size", async () => {
  const sprite = await read("gift-objects.svg");
  for (const id of Object.keys(scenes)) {
    const svg = sprite
      .replace(/<svg\b[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="112" viewBox="0 0 400 280" fill="none">')
      .replace("</svg>", `<use href="#${id}" width="400" height="280"/></svg>`);
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let visible = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha < 16) continue;
        visible++;
        assert.ok(x >= 3 && x < info.width - 3 && y >= 3 && y < info.height - 3, `${id}: clipped at ${x}, ${y}`);
      }
    }
    assert.ok(visible > info.width * info.height * 0.12, `${id}: missing or too small`);
  }
});

test("guide heroes describe their illustrations without repeating decorative directory artwork", async () => {
  const names = (await readdir(new URL("gifts/", site))).filter((name) => name !== "index.html");
  for (const name of names) {
    const html = await read(`gifts/${name}`);
    const hero = html.match(/<div class="guide-illustration[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    assert.ok(hero, name);
    assert.match(hero, /role="img" aria-label="Illustration of [^"]{35,}"/, name);
    assert.match(html, /class="directory-art[^"]*" aria-hidden="true"/, name);
  }
});

test("social artwork and home-screen icon use the current palette and expected raster dimensions", async () => {
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
  const files = [
    "index.html", "about.html", "privacy.html", "404.html",
    ...(await readdir(new URL("gifts/", site))).map((name) => `gifts/${name}`),
  ];
  for (const name of files) {
    const html = await read(name);
    assert.match(html, /rel="icon" href="\/favicon\.svg"/, name);
    assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png"/, name);
    if (html.includes('property="og:image"')) {
      assert.match(html, /property="og:image:alt"/, name);
      assert.match(html, /property="og:image:width" content="1200"/, name);
      assert.match(html, /property="og:image:height" content="630"/, name);
    }
  }
});
