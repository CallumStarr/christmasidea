import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  WISHLISTS_KEY, WishlistStorageError, readWishlists, writeWishlists, activeWishlist, addWishlist,
} from "../site/wishlists.js";
import { savedIdea, savedKey, readLocalGiftList } from "../site/monetization-data.js";
import { blackFridayDate, calendarReminder } from "../site/calendar-reminder.js";

const gift = (title = "Coffee grinder") => ({ title, query: title.toLowerCase(), why: "", category: "Kitchen", recipientTag: "dad" });
const collection = () => ({
  version: 1, activeId: "default",
  lists: [
    { id: "default", name: "Dad", items: [gift()] },
    { id: "second", name: "Family", items: [gift("Coffee dripper")] },
  ],
});
function storage(values = {}, failKey) {
  const data = new Map(Object.entries(values)), writes = [];
  return {
    data, writes,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (key === failKey) throw new Error("Synthetic quota failure");
      writes.push(key); data.set(key, value);
    },
  };
}
const quietConsole = { warn() {} };

test("all 20 wishlists of 50 gifts persist and a 51st gift never overwrites valid storage", () => {
  const local = storage();
  let state = readWishlists(local);
  for (let index = 1; index < 20; index++) state = addWishlist(state, `List ${index}`, `list-${index}`);
  for (const list of state.lists) list.items = Array.from({ length: 50 }, (_, index) => gift(`Gift ${index}`));
  assert.deepEqual(writeWishlists(local, state), { persistent: true, compatibilityUpdated: true });
  assert.equal(readWishlists(local).lists.reduce((count, list) => count + list.items.length, 0), 1000);
  const original = local.getItem(WISHLISTS_KEY);
  activeWishlist(state).items.push(gift("Overflow"));
  assert.throws(() => writeWishlists(local, state), /50/);
  assert.equal(local.getItem(WISHLISTS_KEY), original);
});

test("corrupt gifts are recoverable in memory but their exact original bytes cannot be overwritten", () => {
  const state = collection(); state.lists[1].items.push(null);
  const raw = JSON.stringify(state, null, 2);
  const local = storage({ [WISHLISTS_KEY]: raw, "ci-shortlist": "original compatibility bytes" });
  let recovered;
  assert.throws(() => readWishlists(local), (error) => {
    assert.ok(error instanceof WishlistStorageError);
    assert.match(error.message, /Original saved data is preserved/);
    recovered = error.recovered;
    assert.equal(recovered.lists.length, 2);
    assert.equal(recovered.lists[1].items[0].title, "Coffee dripper");
    return true;
  });
  activeWishlist(recovered).items.push(gift("New gift"));
  assert.throws(() => writeWishlists(local, recovered), WishlistStorageError);
  assert.equal(local.getItem(WISHLISTS_KEY), raw);
  assert.equal(local.getItem("ci-shortlist"), "original compatibility bytes");
  assert.deepEqual(local.writes, []);
});

test("invalid metadata and malformed JSON remain untouched without inventing identifiers or versions", () => {
  const fixtures = [
    "{broken", JSON.stringify({ ...collection(), version: 2 }),
    JSON.stringify({ ...collection(), activeId: "missing" }),
    JSON.stringify({ ...collection(), lists: [collection().lists[0], collection().lists[0]] }),
  ];
  for (const raw of fixtures) {
    const local = storage({ [WISHLISTS_KEY]: raw });
    assert.throws(() => readWishlists(local), (error) => {
      assert.ok(error instanceof WishlistStorageError);
      assert.equal(error.recovered, undefined);
      return true;
    });
    assert.throws(() => writeWishlists(local, collection()), WishlistStorageError);
    assert.equal(local.getItem(WISHLISTS_KEY), raw);
    assert.deepEqual(local.writes, []);
  }
});

test("legacy corruption is disclosed and retained rather than silently migrated", () => {
  const raw = JSON.stringify([gift(), null]), local = storage({ "ci-shortlist": raw });
  let recovered;
  assert.throws(() => readWishlists(local), (error) => {
    recovered = error.recovered;
    assert.equal(activeWishlist(recovered).items.length, 1);
    return error instanceof WishlistStorageError;
  });
  assert.throws(() => writeWishlists(local, recovered), WishlistStorageError);
  assert.equal(local.getItem(WISHLISTS_KEY), null);
  assert.equal(local.getItem("ci-shortlist"), raw);
});

test("primary failure leaves original data intact while mirror failure reports successful primary persistence", () => {
  const original = JSON.stringify(collection());
  const primary = storage({ [WISHLISTS_KEY]: original }, WISHLISTS_KEY);
  const next = collection(); next.lists[0].items.push(gift("New gift"));
  assert.throws(() => writeWishlists(primary, next), /quota/);
  assert.equal(primary.getItem(WISHLISTS_KEY), original);
  const mirror = storage({ [WISHLISTS_KEY]: original, "ci-shortlist": "previous mirror" }, "ci-shortlist");
  assert.deepEqual(writeWishlists(mirror, next), { persistent: true, compatibilityUpdated: false });
  assert.equal(activeWishlist(readWishlists(mirror)).items.length, 2);
  assert.equal(mirror.getItem("ci-shortlist"), "previous mirror");
});

async function finderStore(localStorage) {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const source = html.slice(html.indexOf("let shortlistPersistent ="), html.indexOf("/* ---------- links ---------- */"));
  const elements = new Map(), notices = [];
  const context = vm.createContext({
    localStorage, WishlistStorageError, readWishlists, writeWishlists, activeWishlist,
    console: quietConsole, showFeedback: (notice) => notices.push(notice),
    $: (selector) => {
      if (!elements.has(selector)) elements.set(selector, {});
      return elements.get(selector);
    },
  });
  vm.runInContext(source, context);
  return { context, elements, notices, run: (code) => vm.runInContext(code, context) };
}

test("actual finder store exposes recovered gifts and never replaces corrupt originals on save", async () => {
  const state = collection(); state.lists[1].items.push(null);
  const raw = JSON.stringify(state), local = storage({ [WISHLISTS_KEY]: raw });
  const ui = await finderStore(local);
  assert.equal(ui.run("shortlist.length"), 1);
  assert.equal(ui.run("wishlists.lists.length"), 2);
  assert.equal(ui.run("shortlistPersistent"), false);
  assert.match(ui.elements.get("#monetization-status").textContent, /Original saved data is preserved/);
  ui.context.next = [gift("New gift")];
  assert.equal(ui.run("store.set(next)"), false);
  assert.match(ui.notices.at(-1), /Original saved data is preserved/);
  assert.equal(local.getItem(WISHLISTS_KEY), raw);
});

test("actual finder store reports compatibility failures without claiming gifts are ephemeral", async () => {
  const local = storage({}, "ci-shortlist"), ui = await finderStore(local);
  ui.context.next = [gift()];
  assert.equal(ui.run("store.set(next)"), true);
  assert.equal(ui.run("shortlistPersistent"), true);
  assert.match(ui.run("shortlistStorageNotice"), /Saved on this device.*compatibility copy/);
  assert.doesNotMatch(ui.run("shortlistStorageNotice"), /visit only|storage is unavailable/);
});

async function guideStore(localStorage) {
  const source = await readFile(new URL("../site/monetization-shell.js", import.meta.url), "utf8");
  const link = { dataset: { query: "coffee grinder", category: "Kitchen", recipient: "dad" } };
  const article = {
    querySelector: (selector) => selector === ".merchant-links a" ? link
      : { textContent: selector === "h3" ? "Coffee grinder" : "For their coffee." },
    append(button, status) { this.button = button; this.status = status; button.nextElementSibling = status; },
  };
  const context = vm.createContext({
    localStorage, WishlistStorageError, WISHLISTS_KEY, readWishlists, writeWishlists, activeWishlist, savedIdea, savedKey, readLocalGiftList,
    console: quietConsole, window: { addEventListener() {} },
    document: {
      querySelector: () => null,
      querySelectorAll: (selector) => selector === ".idea" ? [article] : article.button ? [article.button] : [],
      addEventListener() {},
      createElement: () => ({ dataset: {}, setAttribute() {}, addEventListener(_name, callback) { this.click = callback; } }),
    },
  });
  vm.runInContext(source.replace(/^import .+;\r?\n/gm, ""), context);
  return article;
}

test("guide saves preserve corrupt originals and disclose read-only recovery", async () => {
  const state = collection(); state.lists[1].items.push(null);
  const raw = JSON.stringify(state), local = storage({ [WISHLISTS_KEY]: raw });
  const article = await guideStore(local);
  assert.equal(article.button.textContent, "Saved idea");
  assert.match(article.status.textContent, /Original saved data is preserved/);
  article.button.click();
  assert.match(article.status.textContent, /visit only.*Original saved data is preserved/);
  assert.equal(local.getItem(WISHLISTS_KEY), raw);
});

test("guide saves disclose a failed compatibility copy while confirming primary persistence", async () => {
  const local = storage({}, "ci-shortlist"), article = await guideStore(local);
  article.button.click();
  assert.match(article.status.textContent, /updated on this device only.*compatibility copy/);
  assert.equal(activeWishlist(readWishlists(local)).items.length, 1);
});

async function sharedFixture() {
  const source = await readFile(new URL("../site/monetization-ui.js", import.meta.url), "utf8");
  const methods = source.slice(source.indexOf("invalidateSharedList()"), source.lastIndexOf("\n  };"));
  let release, reject, enter;
  const decoded = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  const entered = new Promise((resolve) => { enter = resolve; });
  const elements = new Map(), rendered = [], notices = [];
  const location = { href: "https://example.invalid/#list=synthetic", hash: "#list=synthetic" };
  const context = vm.createContext({
    shared: null, offers: new Map(), selectedAddon: null, initialisation: 0, inventoryReady: Promise.resolve(),
    config: {}, scope: {}, context: {}, location, URL, URLSearchParams,
    history: { replaceState(_a, _b, url) { location.href = url.href; location.hash = url.hash; } },
    $: (selector) => {
      if (!elements.has(selector)) elements.set(selector, {});
      return elements.get(selector);
    },
    getInput: () => ({}), queryContext: () => ({ recipientTag: "other" }), updateShelf() {},
    finderPreset: () => null, decodeWishlist: () => { enter(); return decoded; }, resolve: (item) => item,
    renderShared: (items) => rendered.push(items), notify: (message) => notices.push(message),
    console: quietConsole, getShortlist: () => [],
  });
  vm.runInContext(`globalThis.ui = {${methods}};`, context);
  return { ui: context.ui, context, entered, release, reject, rendered, notices, elements, location };
}

test("a pending shared decode cannot replace newer rendered finder results", async () => {
  const fixture = await sharedFixture(), pending = fixture.ui.initialise();
  await fixture.entered;
  fixture.ui.decorateIdeas([gift("Fresh result")], { includeInventory: false });
  fixture.release([gift("Old shared gift")]);
  await pending;
  assert.deepEqual(fixture.rendered, []);
  assert.equal(fixture.location.hash, "");
  assert.equal(fixture.elements.get("#shared-list-notice").hidden, true);
});

test("starting a finder invalidates pending shared decoding before any result renders", async () => {
  for (const fails of [false, true]) {
    const fixture = await sharedFixture(), pending = fixture.ui.initialise();
    await fixture.entered;
    fixture.ui.invalidateSharedList();
    if (fails) fixture.reject(new Error("Obsolete decode failure"));
    else fixture.release([gift("Old shared gift")]);
    await pending;
    assert.deepEqual(fixture.rendered, []);
    assert.deepEqual(fixture.notices, []);
  }
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const start = html.slice(html.indexOf("async function run("), html.indexOf("const go =", html.indexOf("async function run(")));
  assert.match(start, /if \(!append\) monetization\.invalidateSharedList\(\)/);
});

test("current shared decode still renders and reports persistence notices when saved", async () => {
  const fixture = await sharedFixture(), pending = fixture.ui.initialise();
  await fixture.entered;
  fixture.release([gift()]);
  await pending;
  assert.equal(fixture.rendered.length, 1);
  fixture.context.savedKey = savedKey;
  fixture.context.setShortlist = () => ({ persistent: true, notice: "Compatibility copy could not be updated." });
  fixture.elements.get("#save-shared-list").onclick();
  assert.match(fixture.notices.at(-1), /saved on this device only.*Compatibility copy/);
});

test("Black Friday follows the fourth Thursday, including five-Friday Novembers and rollover", () => {
  for (let year = 2000; year <= 2100; year++) {
    const expected = new Date(Date.UTC(year, 10, 22));
    while (expected.getUTCDay() !== 4) expected.setUTCDate(expected.getUTCDate() + 1);
    expected.setUTCDate(expected.getUTCDate() + 1);
    assert.equal(blackFridayDate(new Date(year, 10, 1, 12)).toISOString(), expected.toISOString(), String(year));
  }
  assert.equal(blackFridayDate(new Date(2030, 10, 25, 12)).toISOString().slice(0, 10), "2030-11-29");
  assert.equal(blackFridayDate(new Date(2030, 10, 29, 12)).toISOString().slice(0, 10), "2030-11-29");
  assert.equal(blackFridayDate(new Date(2030, 10, 30, 12)).toISOString().slice(0, 10), "2031-11-28");
});

test("ICS identifiers reject injected content lines and preserve valid folded Unicode text", () => {
  const options = { now: new Date("2026-11-01T12:00:00Z") };
  for (const uid of ["", " ", null, 123, "x\rATTENDEE:bad", "x\nATTENDEE:bad", "x\r\nATTENDEE:bad", "x\0bad", "x\tbad"]) {
    assert.throws(() => calendarReminder({ ...options, uid }), /identifier/);
  }
  const uid = "礼".repeat(60) + ";comma,slash\\";
  const contents = calendarReminder({ ...options, uid });
  for (const line of contents.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(contents.replaceAll("\r\n ", "").includes(`UID:${"礼".repeat(60)}\\;comma\\,slash\\\\@christmasidea.co.uk\r\n`));
  assert.equal((contents.match(/BEGIN:VEVENT/g) || []).length, 1);
});
