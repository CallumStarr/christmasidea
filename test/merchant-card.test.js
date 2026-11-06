import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { validProductImage } from "../site/merchant-links.js";

class Element {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.dataset = {};
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.classes = new Set();
    this.classList = {
      add: (value) => this.classes.add(value),
      remove: (value) => this.classes.delete(value),
    };
  }
  append(child) { this.children.push(child); child.parent = this; }
  prepend(child) { this.children.unshift(child); child.parent = this; }
  after(child) { this.parent.append(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  querySelector(selector) {
    return this.children.find((child) => child.className?.split(" ").includes(selector.slice(1))) || null;
  }
}

async function fixture() {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const source = html.match(/function setVerifiedProduct\(card, idea, product\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source);
  const media = new Element(), note = new Element(), disclosure = new Element(), heading = new Element();
  note.className = "image-note"; media.append(note); heading.textContent = "Coffee mug gift idea";
  const shops = Object.fromEntries(["amazon", "ebay"].map((id) => {
    const offer = new Element(), shop = new Element();
    shop.href = `https://search.example/${id}`; offer.append(shop);
    return [id, shop];
  }));
  const card = new Element();
  card.isConnected = true;
  card.querySelector = (selector) => ({
    ".media": media, ".aff": disclosure, "h3": heading,
    '.shop[data-provider="amazon"]': shops.amazon,
    '.shop[data-provider="ebay"]': shops.ebay,
  })[selector];
  const timers = [], notices = [];
  const apply = runInNewContext(`(${source})`, {
    document: { createElement: (tagName) => new Element(tagName) },
    Date, Intl, Number, Math,
    CFG: {},
    validProductImage,
    setTimeout: (callback) => timers.push(callback),
    showFeedback: (message) => notices.push(message),
    updateCardLayout: () => {},
    ebayUrl: () => "https://search.example/ebay",
    amazonUrl: () => "https://search.example/amazon",
  });
  return { apply, card, media, shops, note, heading, timers, notices };
}

const idea = { title: "Coffee mug gift idea", query: "coffee mug" };
const product = (provider, overrides = {}) => ({
  provider,
  title: `${provider} coffee mug listing`,
  affiliateUrl: `https://${provider}.example/listing`,
  imageUrl: provider === "ebay" ? "https://i.ebayimg.com/photo.jpg" : "https://m.media-amazon.com/photo.jpg",
  price: { amount: 14.5, currency: "GBP" },
  retrievedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  ...overrides,
});

test("photo-first cards are hidden if their current image fails or expires", async () => {
  for (const event of ["error", "expiry"]) {
    const ui = await fixture();
    ui.card.dataset.photoRequired = "true";
    ui.apply(ui.card, idea, product("ebay"));
    if (event === "error") ui.media.querySelector(".product-image").children[0].listeners.error();
    else ui.timers[0]();
    assert.equal(ui.card.hidden, true);
    assert.equal(ui.media.querySelector(".product-image"), null);
    assert.equal(ui.notices.length, 1);
  }
});
test("eBay example photo is not a merchant link and leaves both shopping choices available", async () => {
  const ui = await fixture(), ebay = product("ebay");
  ui.apply(ui.card, idea, ebay);
  const photo = ui.media.querySelector(".product-image");
  assert.equal(photo.tagName, "div");
  assert.equal(photo.href, undefined);
  assert.equal(photo.attributes.tabindex, undefined);
  assert.equal(photo.children[0].alt, "Example of Coffee mug gift idea: ebay coffee mug listing");
  assert.equal(ui.note.textContent, "Example photo: eBay. Amazon product may differ.");
  assert.equal(ui.media.querySelector(".product-badge").textContent, "Example product");
  assert.equal(ui.shops.ebay.href, ebay.affiliateUrl);
  assert.doesNotMatch(ui.shops.ebay.attributes["aria-label"], /affiliate/);
  assert.equal(ui.shops.amazon.href, "https://search.example/amazon");
  assert.equal(ui.heading.textContent, idea.title);
  assert.equal(ui.shops.ebay.parent.querySelector(".offer-detail").textContent, "Matched eBay listing: ebay coffee mug listing");
  assert.equal(ui.shops.ebay.parent.querySelector(".product-price").textContent, "eBay: £14.50 incl. listed delivery");
});

test("Amazon photos replace eBay examples without old expiry or error callbacks removing them", async () => {
  const ui = await fixture(), ebay = product("ebay"), amazon = product("amazon");
  ui.apply(ui.card, idea, ebay);
  const previous = ui.media.querySelector(".product-image");
  ui.apply(ui.card, idea, amazon);
  assert.equal(ui.shops.amazon.href, amazon.affiliateUrl);
  assert.equal(ui.shops.ebay.href, ebay.affiliateUrl);
  const photo = ui.media.querySelector(".product-image");
  assert.equal(photo.tagName, "a");
  assert.equal(photo.href, amazon.affiliateUrl);
  assert.equal(ui.note.textContent, "Photo from Amazon listing");
  assert.equal(ui.media.children.filter((child) => child.className === "product-image").length, 1);
  assert.equal(ui.shops.amazon.parent.querySelector(".offer-detail").textContent, "Matched Amazon listing: amazon coffee mug listing");
  ui.timers[0]();
  previous.children[0].listeners.error();
  assert.equal(ui.media.querySelector(".product-image"), photo);
  assert.equal(ui.card.classes.has("verified"), true);
  assert.equal(ui.notices.length, 0);
  assert.equal(ui.shops.ebay.href, "https://search.example/ebay");
  assert.equal(ui.shops.ebay.parent.querySelector(".product-price"), null);
  assert.equal(ui.shops.amazon.href, amazon.affiliateUrl);
  ui.timers[1]();
  assert.equal(ui.media.querySelector(".product-image"), null);
  assert.equal(ui.shops.amazon.href, "https://search.example/amazon");
});

test("image failures hide broken media and notify the visitor without losing either shopping link", async () => {
  const ui = await fixture(), ebay = product("ebay");
  ui.apply(ui.card, idea, ebay);
  ui.media.querySelector(".product-image").children[0].listeners.error();
  assert.equal(ui.card.classes.has("verified"), false);
  assert.equal(ui.media.querySelector(".product-image"), null);
  assert.equal(ui.shops.ebay.href, ebay.affiliateUrl);
  assert.equal(ui.shops.amazon.href, "https://search.example/amazon");
  assert.match(ui.notices[0], /photo couldn't load/);
});

test("unapproved image hosts never expose media even when the offer itself is valid", async () => {
  const ui = await fixture();
  ui.apply(ui.card, idea, product("ebay", { imageUrl: "https://evil.example/photo.jpg" }));
  assert.equal(ui.card.classes.has("verified"), false);
  assert.equal(ui.media.querySelector(".product-image"), null);
  assert.equal(ui.shops.ebay.textContent, "View on eBay");
});

test("eBay examples expire without leaving a stale image or price", async () => {
  const ui = await fixture();
  ui.apply(ui.card, idea, product("ebay"));
  ui.timers[0]();
  assert.equal(ui.media.querySelector(".product-image"), null);
  assert.equal(ui.card.classes.has("verified"), false);
  assert.equal(ui.shops.ebay.parent.querySelector(".product-price"), null);
  assert.equal(ui.shops.ebay.href, "https://search.example/ebay");
  assert.equal(ui.shops.amazon.href, "https://search.example/amazon");
});

test("eBay cannot replace an available Amazon image regardless of response order", async () => {
  const ui = await fixture(), amazon = product("amazon");
  ui.apply(ui.card, idea, amazon);
  ui.apply(ui.card, idea, product("ebay"));
  assert.equal(ui.media.querySelector(".product-image").href, amazon.affiliateUrl);
  assert.equal(ui.note.textContent, "Photo from Amazon listing");
  assert.equal(ui.media.children.filter((child) => child.className === "product-image").length, 1);
});
