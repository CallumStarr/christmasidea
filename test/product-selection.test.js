import test from "node:test";
import assert from "node:assert/strict";
import { selectPhotographedIdeas } from "../site/product-selection.js";

const idea = (title) => ({ title, query: title, concept: title, productSpec: {} });
const offer = (number, patch = {}) => {
  const now = Date.now();
  return ({
  provider: "ebay", productId: `v1|1234567890${number}|0`, title: "Coffee mug",
  imageUrl: `https://i.ebayimg.com/image-${number}.jpg`,
  productUrl: `https://www.ebay.co.uk/itm/1234567890${number}`,
  affiliateUrl: `https://www.ebay.co.uk/itm/1234567890${number}`,
  retrievedAt: new Date(now).toISOString(), expiresAt: new Date(now + 3600000).toISOString(),
  availability: "IN_STOCK", condition: "NEW", ...patch,
  });
};
const fetcher = (lookup, requests = []) => async (ideas, callback) => {
  requests.push(ideas.map((idea) => idea.title));
  for (let offset = 0; offset < ideas.length; offset += 2) {
    callback({ products: ideas.slice(offset, offset + 2).map((idea) => lookup[idea.title] || null) }, offset);
  }
};

test("photo-first selection replaces missing matches and broken photos using validated backup ideas", async () => {
  const requests = [];
  const result = await selectPhotographedIdeas(
    ["Keep", "No match", "Broken", "No photo"].map(idea),
    ["Backup one", "Backup two"].map(idea),
    {
      fetchBatches: fetcher({
        Keep: offer(11), Broken: offer(12), "No photo": offer(13, { imageUrl: null }),
        "Backup one": offer(14), "Backup two": offer(15),
      }, requests),
      loadImage: async (url) => !url.includes("12.jpg"),
    },
  );
  assert.deepEqual(result.selected.map((entry) => entry.idea.title), ["Keep", "Backup one", "Backup two"]);
  assert.equal(requests.length, 2);
  assert.match(result.notice, /couldn't load/);
  assert.ok(result.selected.every((entry) => entry.offers.every((product) => product.imageUrl)));
});

test("selection removes duplicate listings and refuses unapproved photos or expired offers", async () => {
  const result = await selectPhotographedIdeas(["First", "Duplicate", "Bad host", "Expired"].map(idea), [], {
    fetchBatches: fetcher({
      First: offer(11), Duplicate: offer(11),
      "Bad host": offer(12, { imageUrl: "https://unapproved.example/image.jpg" }),
      Expired: offer(13, { expiresAt: new Date(Date.now() - 1000).toISOString() }),
    }),
    loadImage: async () => true,
  });
  assert.deepEqual(result.selected.map((entry) => entry.idea.title), ["First"]);
  assert.match(result.notice, /fewer ideas/);
});

test("eight photographed matches do not perform replacement lookups", async () => {
  const ideas = Array.from({ length: 8 }, (_, index) => idea(`Idea ${index}`));
  const requests = [];
  const result = await selectPhotographedIdeas(ideas, [idea("Unneeded")], {
    fetchBatches: fetcher(Object.fromEntries(ideas.map((idea, index) => [idea.title, offer(index + 11)])), requests),
    loadImage: async () => true,
  });
  assert.equal(result.selected.length, 8);
  assert.equal(requests.length, 1);
  assert.equal(result.notice, "");
});

test("replacement lookup is bounded to four candidates and the displayed list stays capped at eight", async () => {
  const ideas = Array.from({ length: 7 }, (_, index) => idea(`Idea ${index}`));
  const replacements = Array.from({ length: 8 }, (_, index) => idea(`Backup ${index}`));
  const requests = [];
  const lookup = Object.fromEntries([...ideas, ...replacements].map((idea, index) => [idea.title, offer(index + 11)]));
  const result = await selectPhotographedIdeas(ideas, replacements, {
    fetchBatches: fetcher(lookup, requests), loadImage: async () => true,
  });
  assert.equal(result.selected.length, 8);
  assert.equal(requests[1].length, 4);
});

test("capacity errors show fewer results without attempting more searches or restoring photo-less ideas", async () => {
  let requests = 0;
  const result = await selectPhotographedIdeas([idea("First"), idea("Missing")], [idea("Backup")], {
    fetchBatches: async (_ideas, callback) => {
      requests++;
      callback({ products: [offer(11), null], limited: true }, 0);
    },
    loadImage: async () => true,
  });
  assert.equal(requests, 1);
  assert.equal(result.selected.length, 1);
  assert.match(result.notice, /limit/);
  const disabled = await selectPhotographedIdeas([idea("First")], [], {
    enabled: false, fetchBatches: () => assert.fail("disabled discovery must not search"),
  });
  assert.equal(disabled.selected.length, 0);
  assert.match(disabled.notice, /unavailable/);
});

test("cancellation during product or image retrieval cannot commit a partial list", async () => {
  for (const stage of ["search", "image"]) {
    const controller = new AbortController();
    await assert.rejects(selectPhotographedIdeas([idea("First")], [], {
      signal: controller.signal,
      fetchBatches: async (_ideas, callback) => {
        callback({ products: [offer(11)] }, 0);
        if (stage === "search") controller.abort();
      },
      loadImage: async () => { controller.abort(); return false; },
    }), { name: "AbortError" });
  }
});
