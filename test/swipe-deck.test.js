import test from "node:test";
import assert from "node:assert/strict";
import { createSwipeDeck, swipeDirection, shouldPrefetch } from "../site/swipe-deck.js";
import { WISHLISTS_KEY, readWishlists, writeWishlists, activeWishlist, addWishlist, wishlistName } from "../site/wishlists.js";
import { retailerLinks } from "../site/affiliateRouter.js";

function storage(values = {}) {
  const data = new Map(Object.entries(values));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const gift = { title: "Coffee grinder", query: "coffee grinder", why: "", category: "Kitchen", recipientTag: "dad" };

test("horizontal swipes need deliberate distance and reject vertical scrolling", () => {
  assert.equal(swipeDirection(69, 0, 320), null);
  assert.equal(swipeDirection(71, 0, 320), "right");
  assert.equal(swipeDirection(-71, 0, 320), "left");
  assert.equal(swipeDirection(100, 90, 320), null);
  assert.equal(swipeDirection(150, 200, 320), null);
  assert.equal(swipeDirection(105, 10, 480), null);
  assert.equal(swipeDirection(110, 10, 480), "right");
});

test("preload starts after the fifth of eight cards, never while busy, paused or in a hidden tab", () => {
  assert.equal(shouldPrefetch(4), false);
  assert.equal(shouldPrefetch(3), true);
  assert.equal(shouldPrefetch(0), true);
  for (const options of [{ busy: true }, { paused: true }, { visible: false }]) {
    assert.equal(shouldPrefetch(3, options), false);
  }
});

test("old shortlist migrates intact and named lists survive reload independently", () => {
  const local = storage({ "ci-shortlist": JSON.stringify([gift]) });
  let state = readWishlists(local);
  assert.equal(activeWishlist(state).items[0].title, gift.title);
  state = addWishlist(state, "Sarah's gifts", "sarah");
  activeWishlist(state).items = [{ ...gift, recipientTag: "friend" }];
  writeWishlists(local, state);
  const restored = readWishlists(local);
  assert.equal(restored.lists.length, 2);
  assert.equal(restored.lists[0].items[0].recipientTag, "dad");
  assert.equal(activeWishlist(restored).name, "Sarah's gifts");
  assert.equal(activeWishlist(restored).items[0].recipientTag, "friend");
  assert.deepEqual(JSON.parse(local.getItem("ci-shortlist")), activeWishlist(restored).items);
  restored.activeId = "default";
  writeWishlists(local, restored);
  assert.equal(activeWishlist(readWishlists(local)).items[0].recipientTag, "dad");
});

test("wishlist names, capacities and stored shapes are validated explicitly", () => {
  const state = readWishlists(storage());
  assert.throws(() => wishlistName(" "), /name/);
  assert.throws(() => wishlistName("a".repeat(61)), /name/);
  assert.throws(() => wishlistName("name\nanother"), /name/);
  assert.throws(() => addWishlist(state, "MY GIFT SHORTLIST", "duplicate"), /already exists/);
  assert.throws(() => addWishlist(state, "New", "default"), /identifier/);
  assert.throws(() => readWishlists(storage({ [WISHLISTS_KEY]: "{}" })), /Invalid/);
  assert.throws(() => readWishlists(storage({ [WISHLISTS_KEY]: JSON.stringify({ ...state, activeId: "missing" }) })), /missing/);
  let full = state;
  for (let index = 1; index < 20; index++) full = addWishlist(full, `List ${index}`, `list-${index}`);
  assert.throws(() => addWishlist(full, "One too many", "overflow"), /20/);
  assert.throws(() => writeWishlists({ getItem() { return null; }, setItem() { throw new Error("Quota exceeded"); } }, state), /Quota/);
});

test("shopping card includes approved searchable partners without inventing stock or tracking for pending programmes", () => {
  const config = { MERCHANT_PROGRAMMES: {
    noths: [{ network: "awin", approved: true, merchantId: "123", affiliateId: "456" }],
    etsy: [{ network: "awin", approved: false, merchantId: "111", affiliateId: "222" }],
    greentulip: [{ network: "awin", approved: true, merchantId: "333", affiliateId: "456" }],
  } };
  const links = retailerLinks(gift, config);
  assert.deepEqual(links.slice(0, 2).map((link) => link.merchantId), ["amazon", "ebay"]);
  const partner = links.find((link) => link.merchantId === "noths");
  assert.equal(partner.affiliate, true);
  assert.equal(partner.search, true);
  assert.ok(new URL(partner.href).searchParams.get("ued").includes("coffee"));
  assert.ok(!links.some((link) => ["etsy", "greentulip"].includes(link.merchantId)));
});

class DeckElement {
  constructor(tagName = "div", className = "") {
    this.tagName = tagName; this.className = className; this.children = []; this.dataset = {};
    this.attributes = {}; this.events = {}; this.hidden = false; this.isConnected = true;
    this.classList = {
      contains: (name) => this.className.split(" ").includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(" "), ...names])].filter(Boolean).join(" "); },
      remove: (...names) => { this.className = this.className.split(" ").filter((name) => !names.includes(name)).join(" "); },
      toggle: (name, value) => value ? this.classList.add(name) : this.classList.remove(name),
    };
    const properties = new Map();
    this.style = { setProperty: (key, value) => properties.set(key, value), removeProperty: (key) => properties.delete(key) };
  }
  append(...elements) {
    for (const element of elements) {
      if (element.parent) element.parent.children = element.parent.children.filter((child) => child !== element);
      element.parent = this; this.children.push(element);
    }
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  click() { if (!this.disabled) this.events.click?.({ target: this }); }
  focus() { document.activeElement = this; }
  contains(element) { return element === this || this.children.some((child) => child.contains(element)); }
  showModal() { this.open = true; }
  close() { this.open = false; this.events.close?.(); }
  getBoundingClientRect() { return { width: 360, left: 0, right: 360, top: 0, bottom: 500 }; }
  setPointerCapture(id) { this.pointer = id; }
  hasPointerCapture(id) { return this.pointer === id; }
  releasePointerCapture() { this.pointer = null; }
  matches(selector) {
    if (selector.endsWith(":not([hidden])")) return !this.hidden && this.matches(selector.replace(":not([hidden])", ""));
    if (selector.endsWith("[hidden]")) return this.hidden && this.matches(selector.replace("[hidden]", ""));
    const data = selector.match(/^\[data-swipe="(\w+)"\]$/);
    if (data) return this.dataset.swipe === data[1];
    return selector.startsWith(".") ? this.classList.contains(selector.slice(1)) : this.tagName === selector;
  }
  closest(selector) {
    return selector.split(",").some((part) => this.matches(part)) ? this : this.parent?.closest(selector) || null;
  }
  querySelectorAll(selector) {
    const parts = selector.split(" ");
    const matches = (element) => element.matches(parts.at(-1))
      && (parts.length === 1 || element.parent?.closest(parts[0]));
    return this.children.flatMap((child) => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function deckFixture(t) {
  const previous = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  globalThis.document = { activeElement: null, createElement: (tag) => new DeckElement(tag) };
  globalThis.matchMedia = () => ({ matches: true });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const cards = new DeckElement("ul"), toolbar = new DeckElement(), progress = new DeckElement("p");
  for (const action of ["left", "save", "right"]) {
    const button = new DeckElement("button"); button.dataset.swipe = action; toolbar.append(button);
  }
  const advances = [], likes = [], saves = [];
  let deck;
  const entries = ["Coffee grinder", "Ceramic dripper"].map((name) => {
    const card = new DeckElement("li", "card"), media = new DeckElement("div", "media");
    const note = new DeckElement("span", "image-note"); note.textContent = "Example photo: eBay.";
    media.append(note);
    const body = new DeckElement("div", "card-body"), title = new DeckElement("h3"); title.textContent = name;
    const why = new DeckElement("p", "why"), row = new DeckElement("div", "row");
    why.textContent = "For their morning coffee.";
    const shop = new DeckElement("a", "shop"), save = new DeckElement("button", "save");
    const dismiss = new DeckElement("button", "dismiss");
    dismiss.addEventListener("click", () => deck.advance(card));
    save.addEventListener("click", () => saves.push(name));
    row.append(shop, save); body.append(title, why, row, dismiss); card.append(media, body); cards.append(card);
    return { card, body, title, why, shop, save };
  });
  deck = createSwipeDeck({ cards, toolbar, progress, onAdvance: (count) => advances.push(count), onLike: (card) => likes.push(card) });
  deck.enable(true, true);
  return { cards, toolbar, progress, deck, entries, advances, likes, saves };
}

test("immersive cards expose only a name and details control; dialogs retain the original interactive nodes", (t) => {
  const ui = deckFixture(t), [first, second] = ui.entries;
  assert.deepEqual(first.body.children.map((element) => element.tagName), ["h3", "button"]);
  const dialog = first.card.querySelector(".gift-detail");
  assert.equal(first.why.parent.className, "gift-detail-content");
  assert.equal(dialog.querySelector(".shop"), first.shop, "links are moved, not cloned without their handlers");
  assert.equal(second.card.inert, true);
  first.card.querySelector(".card-info").click();
  assert.equal(dialog.open, true);
  assert.equal(ui.likes.length, 0, "opening information is not a like");
  assert.equal(dialog.querySelector(".detail-photo-note").textContent, "Example photo: eBay.");
  first.save.click();
  assert.deepEqual(ui.saves, ["Coffee grinder"], "the original wishlist handler survives the layout change");
  dialog.querySelector(".detail-close").click();
  assert.equal(dialog.open, false);
  ui.toolbar.querySelector('[data-swipe="right"]').click();
  assert.equal(dialog.open, true);
  assert.deepEqual(ui.likes, [first.card]);
  dialog.querySelector(".deck-next").click();
  assert.equal(first.card.hidden, true);
  assert.equal(second.card.inert, false);
  assert.deepEqual(ui.advances, [1]);
  assert.match(ui.progress.textContent, /1 explored/);
});

test("cancelled and vertical gestures do not dismiss cards; a deliberate horizontal swipe does", (t) => {
  const ui = deckFixture(t), first = ui.entries[0].card;
  const start = () => ui.cards.events.pointerdown({ target: first, pointerId: 1, button: 0, isPrimary: true, clientX: 180, clientY: 100 });
  start();
  ui.cards.events.pointermove({ pointerId: 1, clientX: 65, clientY: 102 });
  ui.cards.events.pointercancel({ pointerId: 1 });
  assert.equal(first.hidden, false);
  start();
  ui.cards.events.pointermove({ pointerId: 1, clientX: 170, clientY: 260 });
  ui.cards.events.pointerup({ pointerId: 1 });
  assert.equal(first.hidden, false);
  start();
  ui.cards.events.pointermove({ pointerId: 1, clientX: 65, clientY: 102 });
  ui.cards.events.pointerup({ pointerId: 1 });
  assert.equal(first.hidden, true);
  assert.deepEqual(ui.advances, [1]);
});

test("tapping a card opens details without liking or advancing it", (t) => {
  const ui = deckFixture(t), first = ui.entries[0].card;
  ui.cards.events.pointerdown({ target: first, pointerId: 1, button: 0, isPrimary: true, clientX: 180, clientY: 100 });
  ui.cards.events.pointermove({ pointerId: 1, clientX: 183, clientY: 102 });
  ui.cards.events.pointerup({ pointerId: 1 });
  assert.equal(first.querySelector(".gift-detail").open, true);
  assert.equal(first.hidden, false);
  assert.deepEqual(ui.likes, []);
  assert.deepEqual(ui.advances, []);
});

test("advancing preserves action-button focus and moves focus to the stack when it is empty", (t) => {
  const ui = deckFixture(t), save = ui.toolbar.querySelector('[data-swipe="save"]');
  save.focus();
  ui.deck.advance(ui.entries[0].card, "save");
  assert.equal(document.activeElement, save);
  ui.deck.advance(ui.entries[1].card);
  assert.equal(document.activeElement, ui.cards);
});

test("a photo removed while its details are open closes that dialog and exposes the next card", (t) => {
  const ui = deckFixture(t), [first, second] = ui.entries;
  first.card.querySelector(".card-info").click();
  first.card.hidden = true;
  ui.deck.refresh();
  assert.equal(first.card.querySelector(".gift-detail").open, false);
  assert.equal(second.card.inert, false);
  assert.equal(first.card.attributes["aria-hidden"], "true");
});

test("a gesture is cancelled when its captured card disappears before release", (t) => {
  const ui = deckFixture(t), [first, second] = ui.entries;
  for (const dx of [-115, 115, 0]) {
    first.card.hidden = false;
    ui.deck.refresh();
    ui.cards.events.pointerdown({ target: first.card, pointerId: 1, button: 0, isPrimary: true, clientX: 180, clientY: 100 });
    ui.cards.events.pointermove({ pointerId: 1, clientX: 180 + dx, clientY: 100 });
    first.card.hidden = true;
    ui.deck.refresh();
    ui.cards.events.pointerup({ pointerId: 1 });
    assert.equal(second.card.hidden, false);
    assert.ok(!second.card.querySelector(".gift-detail").open);
    assert.equal(ui.cards.hasPointerCapture(1), false);
    assert.equal(first.card.classList.contains("dragging"), false);
  }
  assert.deepEqual(ui.advances, []);
  assert.deepEqual(ui.likes, []);
});

test("a cancelled gesture cannot resume when its original card becomes top again", (t) => {
  const ui = deckFixture(t), first = ui.entries[0].card;
  ui.cards.events.pointerdown({ target: first, pointerId: 1, button: 0, isPrimary: true, clientX: 180, clientY: 100 });
  ui.cards.events.pointermove({ pointerId: 1, clientX: 65, clientY: 100 });
  first.hidden = true;
  ui.deck.refresh();
  first.hidden = false;
  ui.deck.refresh();
  ui.cards.events.pointerup({ pointerId: 1 });
  assert.equal(first.hidden, false);
  assert.deepEqual(ui.advances, []);
});
