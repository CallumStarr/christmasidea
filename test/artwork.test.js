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
    const cutout = await sharp(await readFile(new URL(`../assets/editorial/${name}-cutout.webp`, import.meta.url))).metadata();
    assert.equal(cutout.width, 1400, name);
    assert.equal(cutout.height, 980, name);
    assert.equal(cutout.hasAlpha, true, name);
    for (const [width, budget] of [[400, 35000], [800, 100000], [1200, 180000]]) {
      const bytes = await readFile(new URL(`images/${name}-${width}.webp`, site));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "webp", name);
      assert.equal(metadata.width, width, name);
      assert.equal(metadata.height, width * 0.7, name);
      assert.equal(metadata.hasAlpha, true, name);
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
  assert.match(html, /<body class="christmas-canvas">/);
  assert.match(html, /href="\/images\/finder-canvas-1000.webp" media="\(max-width:1000px\)" fetchpriority="high"/);
  assert.match(html, /href="\/images\/finder-canvas-2048.webp" media="\(min-width:1001px\)" fetchpriority="high"/);
  assert.doesNotMatch(html, /<img class="hero-photo"/);
  assert.match(html, /A little thought\.<br>A lovely gift\./);
  const css = await read("theme.css");
  assert.match(css, /@media\(max-width:760px\)\{\s*\.christmas-canvas\{background-position:center top\}/,
    "mobile must retain the centred, inward-framed composition");
});

test("the guide directory has its own approved responsive banner without changing article imagery", async () => {
  const html = await read("gifts/index.html");
  assert.match(html, /class="guide-page directory-page"/);
  assert.match(html, /href="\/images\/guides-canvas-1000.webp" media="\(max-width:1000px\)" fetchpriority="high"/);
  assert.match(html, /href="\/images\/guides-canvas-2048.webp" media="\(min-width:1001px\)" fetchpriority="high"/);
  assert.doesNotMatch(html, /<img class="directory-banner-photo"/);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /13 guides to browse/);
  for (const name of (await readdir(new URL("gifts/", site))).filter((name) => name !== "index.html")) {
    assert.doesNotMatch(await read(`gifts/${name}`), /directory-banner-photo/, name);
  }
  const css = await read("theme.css");
  assert.match(css, /background-repeat:no-repeat,repeat/,
    "the scene appears only at the top; only the object-free linen repeats below");
  assert.doesNotMatch((await read("guide.css")) + (await read("home.css")), /mask-image/);
});

test("integrated canvases have budgeted variants and continuous object-free linen tails", async () => {
  for (const name of ["finder-canvas", "guides-canvas"]) {
    for (const [width, budget] of [[1000, 180000], [2048, 460000]]) {
      const bytes = await readFile(new URL(`images/${name}-${width}.webp`, site));
      const meta = await sharp(bytes).metadata();
      assert.equal(meta.width, width);
      assert.equal(meta.height, width * 1.5);
      assert.ok(bytes.length < budget, `${name} ${width}: ${bytes.length}`);
    }
    const tailBytes = await readFile(new URL(`images/${name}-linen.webp`, site));
    assert.ok(tailBytes.length < 60000);
    const end = await sharp(await readFile(new URL(`images/${name}-2048.webp`, site)))
      .extract({ left: 0, top: 3071, width: 2048, height: 1 }).removeAlpha().raw().toBuffer();
    const tail = await sharp(tailBytes).extract({ left: 0, top: 191, width: 2048, height: 1 })
      .removeAlpha().raw().toBuffer();
    const error = end.reduce((sum, value, i) => sum + Math.abs(value - tail[i]), 0) / end.length;
    assert.ok(error < 6, `${name} continuation join differs by ${error}`);
  }
});

test("canvas scenes and linen retain native detail without stretching or enlargement", async () => {
  const css = await read("theme.css");
  assert.match(css, /background-size:clamp\(960px,100%,2048px\) auto/,
    "wide viewports must not magnify the photograph beyond its native width");
  for (const [file, name] of [["index.html", "finder"], ["gifts/index.html", "guides"]]) {
    assert.ok(css.includes(`image-set(url(/images/${name}-canvas-1000.webp) 1x,url(/images/${name}-canvas-2048.webp) 2x)`));
    assert.ok((await read(file)).includes(`imagesrcset="/images/${name}-canvas-1000.webp 1x, /images/${name}-canvas-2048.webp 2x"`),
      `${file}: retina preload must match the CSS density selection`);
  }
  for (const name of ["finder-canvas", "guides-canvas"]) {
    const masterBytes = await readFile(new URL(`../assets/editorial/${name}.webp`, import.meta.url));
    const master = await sharp(masterBytes).metadata();
    assert.equal(master.width, 1536);
    const rendered = await readFile(new URL(`images/${name}-2048.webp`, site));
    const scene = { left: 0, top: 0, width: master.width, height: 900 };
    const actual = await sharp(rendered).extract({ ...scene, left: 512 }).removeAlpha().raw().toBuffer();
    const expected = await sharp(masterBytes).extract(scene).removeAlpha().raw().toBuffer();
    const sceneError = actual.reduce((sum, value, i) => sum + Math.abs(value - expected[i]), 0) / actual.length;
    assert.ok(sceneError < 4, `${name}: scene no longer matches native source (${sceneError})`);
    const tailBytes = await readFile(new URL(`images/${name}-linen.webp`, site));
    const tail = await sharp(tailBytes).metadata();
    assert.equal(tail.width, master.width + 512);
    assert.equal(tail.height, 192);
    const nativeStrip = await sharp(masterBytes)
      .extract({ left: 256, top: master.height - 96, width: 1024, height: 96 }).removeAlpha().png().toBuffer();
    const stats = await sharp(nativeStrip).stats();
    const sourceStrip = await sharp(nativeStrip)
      .linear([0.35, 0.35, 0.35], stats.channels.map(({ mean }) => mean * 0.65)).raw().toBuffer();
    const outputStrip = await sharp(tailBytes)
      .extract({ left: 0, top: 0, width: 1024, height: 96 }).removeAlpha().raw().toBuffer();
    const stripError = sourceStrip.reduce((sum, value, i) => sum + Math.abs(value - outputStrip[i]), 0) / sourceStrip.length;
    assert.ok(stripError < 4, `${name}: linen was rescaled or smeared (${stripError})`);
  }
});

test("category cutouts reveal the page around crisp complete objects without runtime masks", async () => {
  const css = await read("theme.css");
  const rule = css.match(/\.editorial-photo\{([^}]+)\}/)?.[1];
  assert.ok(rule);
  assert.match(rule, /object-fit:contain/);
  assert.doesNotMatch(css, /mask-image|editorial-edge/);
  assert.doesNotMatch(rule, /(?:^|;)filter:|opacity:|transform:|border-radius:/);
  for (const name of scenes) {
    for (const width of [400, 800, 1200]) {
      const { data, info } = await sharp(await readFile(new URL(`images/${name}-${width}.webp`, site)))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alpha = (x, y) => data[(y * info.width + x) * info.channels + 3];
      let transparent = 0;
      let opaque = 0;
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const value = alpha(x, y);
          if (value === 0) transparent++;
          if (value > 250) opaque++;
          if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
            assert.equal(value, 0, `${name} ${width}: silhouettes and shadows must not touch the frame`);
          }
        }
      }
      const pixels = info.width * info.height;
      assert.ok(transparent / pixels > 0.25, `${name}: substantial real negative space, not a softened rectangle`);
      assert.ok(opaque / pixels > 0.1, `${name}: subjects must remain opaque`);
    }
  }
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
