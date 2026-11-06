import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { readWishlists } from "../site/wishlists.js";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(`site/${name}`, root), "utf8");

test("every page shares the brand shell and exposes a route back to the shortlist", async () => {
  const files = [
    "index.html", "about.html", "privacy.html", "404.html",
    ...(await readdir(new URL("site/gifts/", root))).filter((name) => name.endsWith(".html")).map((name) => `gifts/${name}`),
  ];
  for (const name of files) {
    const html = await read(name);
    assert.equal((html.match(/<header class="masthead">/g) || []).length, 1, name);
    assert.equal((html.match(/<footer class="site-footer">/g) || []).length, 1, name);
    assert.match(html, /class="brand-mark"/, name);
    assert.match(html, /Good gifts start with a person/, name);
    assert.match(html, /src="\/site-shell\.js"/, name);
    assert.doesNotMatch(html, /season-strip|A little help with your gift list/, name);
    const nav = html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0];
    assert.match(nav || "", /class="countdown" id="countdown" hidden/, name);
    assert.doesNotMatch(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || "", /<footer/, `${name}: footer must be outside main`);
    if (name !== "index.html") assert.match(html, /href="\/\?shortlist=1"/, name);
  }
});

test("all 104 guide ideas include specific buying advice and descriptive affiliate actions", async () => {
  const guides = (await readdir(new URL("site/gifts/", root))).filter((name) => name !== "index.html");
  assert.equal(guides.length, 13);
  const artwork = new Set();
  for (const name of guides) {
    const html = await read(`gifts/${name}`);
    const ideas = [...html.matchAll(/<article class="idea">([\s\S]*?)<\/article>/g)];
    assert.equal(ideas.length, 8, name);
    for (const [, idea] of ideas) {
      const note = idea.match(/<p class="buying-note"><strong>What to look for<\/strong>([^<]+)<\/p>/)?.[1];
      assert.ok(note && note.length > 80, `${name}: missing substantive buying note`);
      assert.match(idea, /aria-label="Search Amazon UK for [^"]+affiliate link, opens in a new tab/);
    }
    const image = html.match(/class="guide-illustration[^"]*"[\s\S]*?src="\/images\/([a-z]+)-800\.webp"/)?.[1];
    assert.ok(image, name);
    await readFile(new URL(`site/images/${image}-800.webp`, root));
    artwork.add(image);
    assert.match(html, /href="#gift-ideas"/);
    assert.match(html, /href="#choosing"/);
  }
  assert.equal(artwork.size, 10, "each category needs its own editorial image");
});

test("guide searches match single gift concepts and budget wording does not promise checked offers", async () => {
  const checks = [
    ["gifts-for-4-year-olds.html", "Balance bike", "kids balance bike 4 year old"],
    ["gifts-for-space-lovers.html", "Rocket display model kit", "rocket display model kit"],
    ["gifts-for-tea-and-coffee-lovers.html", "Coffee storage canister", "coffee storage canister airtight"],
    ["gifts-for-mum.html", "Personalised photo book", "personalised photo book"],
    ["gifts-for-dad.html", "Whisky tasting glasses", "whisky tasting glasses"],
    ["gifts-for-book-lovers.html", "Book-support cushion", "book support cushion"],
    ["gifts-for-book-lovers.html", "Reading throw", "washable throw blanket"],
  ];
  for (const [file, title, query] of checks) {
    const html = await read(`gifts/${file}`);
    const article = [...html.matchAll(/<article class="idea">([\s\S]*?)<\/article>/g)]
      .find(([, body]) => body.includes(`<h3>${title}</h3>`))?.[1];
    assert.ok(article, `${file}: ${title}`);
    const href = article.match(/href="(https:\/\/www\.amazon\.co\.uk\/s\?[^"]+)"/)?.[1].replaceAll("&amp;", "&");
    assert.equal(new URL(href).searchParams.get("k"), query, title);
  }
  const secretSanta = await read("gifts/secret-santa-gifts-under-10.html");
  assert.match(secretSanta, /not checked offers at today's prices/);
  assert.match(secretSanta, /including delivery/);
  assert.match(secretSanta, /choose a different idea/);
  assert.match(await read("gifts/index.html"), /not verified offers/);
  assert.doesNotMatch(await read("index.html"), /ideas that stay within the agreed limit/);
});

test("editing preserves the concrete advice needed to choose gifts", async () => {
  const checks = [
    ["gifts-for-4-year-olds.html", "Balance bike", [/parents/, /minimum seat height/, /protective equipment/]],
    ["gifts-for-new-babies.html", "Baby keepsake box", [/internal dimensions/, /out of the baby's reach/, /not a toy/]],
    ["gifts-for-space-lovers.html", "Beginner telescope", [/stable mount/, /Never point a telescope at the sun/]],
    ["gifts-for-space-lovers.html", "Planisphere", [/UK latitudes/, /dim light/]],
    ["gifts-for-gardeners.html", "Bird feeder", [/cleaning/i, /wildlife guidance/]],
    ["gifts-for-history-lovers.html", "Biography of a historical figure", [/original publication date/, /reissue/]],
    ["gifts-for-tea-and-coffee-lovers.html", "Handheld milk frother", [/does not heat/, /batteries/]],
    ["gifts-for-mum.html", "Personalised photo book", [/crop, caption and spelling/, /proof/, /returns/]],
    ["gifts-for-dad.html", "Two-player board game", [/exactly two people/, /rules/]],
    ["secret-santa-gifts-under-10.html", "Reusable coffee cup", [/unsuitable loose in a bag/, /£10 delivered/]],
    ["gifts-for-book-lovers.html", "Padded book sleeve", [/internal dimensions/, /thickness/]],
  ];
  for (const [file, title, advice] of checks) {
    const articles = [...(await read(`gifts/${file}`)).matchAll(/<article class="idea">([\s\S]*?)<\/article>/g)];
    const article = articles.find(([, body]) => body.includes(`<h3>${title}</h3>`))?.[1];
    assert.ok(article, `${file}: ${title}`);
    const note = article.match(/<p class="buying-note"><strong>What to look for<\/strong>([^<]+)<\/p>/)?.[1];
    assert.ok(note, title);
    for (const detail of advice) assert.match(note, detail, `${title}: retain useful buying advice`);
  }
});

test("guide builds are repeatable and preserve authored CSS and legal content", async () => {
  const names = ["theme.css", "home.css", "guide.css", "about.html", "privacy.html", "gifts/index.html", "gifts/gifts-for-gardeners.html"];
  const before = await Promise.all(names.map(read));
  execFileSync(process.execPath, ["scripts/build-site-pages.mjs"], { cwd: root, stdio: "pipe" });
  const after = await Promise.all(names.map(read));
  assert.deepEqual(after, before);
});

test("example descriptions restore quick mode, update the field and focus the caret", async () => {
  const html = await read("index.html");
  const source = html.slice(
    html.indexOf('document.querySelectorAll(".prompt-chip")'),
    html.indexOf("/* ---------- shortlist storage"),
  );
  const elements = new Map([
    ["#quick-fields", { hidden: true }],
    ["#guided-fields", { hidden: false }],
    [".seasonal-hero", { hidden: false }],
    ["#description", {
      value: "",
      dispatchEvent(event) { this.event = event.type; },
      focus() { this.focused = true; },
      setSelectionRange(start, end) { this.selection = [start, end]; },
    }],
  ]);
  const radio = { checked: false };
  let click;
  const example = {
    dataset: { description: "For a keen gardener, around £40." },
    addEventListener(_name, listener) { click = listener; },
  };
  runInNewContext(source, {
    $: (selector) => elements.get(selector),
    Event,
    document: {
      body: { classList: { toggle() {} } },
      querySelector: () => radio,
      querySelectorAll: (selector) => selector === ".prompt-chip" ? [example] : [],
    },
  });
  elements.get("#quick-fields").hidden = true;
  elements.get("#guided-fields").hidden = false;
  click();
  const field = elements.get("#description");
  assert.equal(radio.checked, true);
  assert.equal(elements.get("#quick-fields").hidden, false);
  assert.equal(elements.get("#guided-fields").hidden, true);
  assert.equal(field.value, example.dataset.description);
  assert.equal(field.event, "input");
  assert.equal(field.focused, true);
  assert.deepEqual(field.selection, [field.value.length, field.value.length]);
});

test("secondary-page shortlist links open at startup and preserve unrelated URL state", async () => {
  const html = await read("index.html");
  const start = html.lastIndexOf("renderBar();");
  const source = html.slice(start, html.indexOf("\n})();", start));
  for (const search of ["?shortlist=1&campaign=gift#form", "?shortlist=0", ""]) {
    let opened = 0;
    let rewritten;
    runInNewContext(source, {
      URL,
      location: { href: `https://christmasidea.co.uk/${search}` },
      history: { replaceState(_state, _unused, url) { rewritten = url.href; } },
      renderBar() {},
      $: () => ({ click() { opened++; } }),
    });
    assert.equal(opened, search.startsWith("?shortlist=1") ? 1 : 0);
    assert.equal(rewritten, opened ? "https://christmasidea.co.uk/?campaign=gift#form" : undefined);
  }
});

function shell({ now, saved = "[]" }) {
  const elements = new Map(["#countdown", "#nav-count", "a#nav-shortlist"].map((id) => [id, {
    hidden: true, attrs: {}, children: [],
    setAttribute(name, value) { this.attrs[name] = value; },
    replaceChildren(...children) { this.children = children; },
  }]));
  const warnings = [];
  return read("site-shell.js").then((source) => {
    runInNewContext(source.replace(/^import .+;\r?\n/gm, ""), {
      readWishlists,
      Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } },
      document: {
        querySelector: (selector) => elements.get(selector),
        createElement: () => ({}),
      },
      localStorage: { getItem: (key) => key === "ci-shortlist" ? saved : null },
      console: { warn: (...args) => warnings.push(args) },
    });
    return { elements, warnings };
  });
}

test("the shared countdown handles Christmas Day and the following year without DST drift", async () => {
  for (const [now, text] of [
    ["2026-11-04T12:00:00Z", "51 days until Christmas"],
    ["2026-12-24T12:00:00Z", "1 day until Christmas"],
    ["2026-12-25T12:00:00Z", "It's Christmas Day!"],
    ["2026-12-26T12:00:00Z", "364 days until Christmas"],
  ]) {
    const { elements } = await shell({ now });
    assert.equal(elements.get("#countdown").children[0].textContent, text);
  }
});

test("secondary-page shortlist counts use the same validated storage shape as the finder", async () => {
  const { elements } = await shell({
    now: "2026-11-04",
    saved: JSON.stringify([{ title: "Notebook", query: "garden notebook" }, null, { title: "Invalid" }]),
  });
  assert.equal(elements.get("#nav-count").textContent, 1);
  assert.match(elements.get("a#nav-shortlist").attrs["aria-label"], /^Wishlists, 1 saved idea.*Original saved data is preserved/);
  const invalid = await shell({ now: "2026-11-04", saved: "invalid" });
  assert.equal(invalid.warnings.length, 1);
  assert.equal(invalid.elements.get("#nav-count").hidden, true);
  assert.equal(invalid.elements.get("a#nav-shortlist").attrs["aria-label"], "Wishlists");
});
