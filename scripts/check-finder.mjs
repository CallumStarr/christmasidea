import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { FINDER_MONITOR_CASES } from "../src/finder-monitor-cases.js";
import { selectPhotographedIdeas } from "../site/product-selection.js";

export async function checkFinder({ origin, token, fetchImpl = fetch }) {
  const base = new URL(origin);
  assert.equal(base.protocol, "https:", "Monitor requires HTTPS.");
  assert.ok(typeof token === "string" && token.length >= 32, "FINDER_MONITOR_TOKEN is required.");
  const post = async (path, body, monitor = false) => {
    const response = await fetchImpl(new URL(path, base), {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(90_000),
      headers: { Origin: base.origin, "Content-Type": "application/json", ...(monitor ? { "X-Finder-Monitor": token } : {}) },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.ok(response.ok || (data.fallback === true && [429, 502, 503].includes(response.status)), `${path} failed (${response.status}).`);
    return data;
  };
  const ready = await fetchImpl(new URL("/api/ready", base), { redirect: "error", signal: AbortSignal.timeout(15_000) });
  assert.equal(ready.status, 200, "Readiness check failed.");
  const home = await fetchImpl(base, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  assert.equal(home.status, 200, "Homepage uptime check failed.");
  for (const [index, input] of FINDER_MONITOR_CASES.entries()) {
    const data = await post("/api/ideas", input, true);
    // Runs early in the UTC day, so a fallback means AI generation is broken, not that the daily cap is spent.
    assert.notEqual(data.fallback, true, `Case ${index + 1} fell back to the catalogue; AI ideas are unavailable.`);
    assert.ok(Array.isArray(data.ideas) && data.ideas.length === 8, `Case ${index + 1} must return eight ideas.`);
    assert.ok(data.ideas.every((idea) => idea.title && idea.query && idea.feedbackToken), "Ideas require titles, queries and receipts.");
    const selected = await selectPhotographedIdeas(data.ideas, data.replacement_ideas || [], {
      enabled: data.product_discovery_enabled === true,
      fetchBatches: async (ideas, callback) => {
        for (let offset = 0; offset < ideas.length; offset += 2) {
          const products = await post("/api/products", { ideas: ideas.slice(offset, offset + 2) });
          assert.ok(Array.isArray(products.products), "Product response must contain products.");
          callback(products, offset);
        }
      },
      loadImage: async (url) => {
        const image = await fetchImpl(url, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(10_000) });
        return image.ok && (image.headers.get("Content-Type") || "").startsWith("image/");
      },
    });
    assert.equal(selected.selected.length, 8, `Case ${index + 1} lost ideas during photo selection.`);
    assert.ok(selected.selected.every(({ idea, offers }) => idea.title && Array.isArray(offers)), "Invalid selected-card shape.");
    console.log(`Finder case ${index + 1}: eight usable ideas (${data.source || "AI"}).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkFinder({ origin: process.env.FINDER_ORIGIN || "https://christmasidea.co.uk", token: process.env.FINDER_MONITOR_TOKEN });
  } catch (error) {
    console.error(`Finder monitor failed: ${error instanceof assert.AssertionError ? error.message : "request or response failure"}`);
    process.exitCode = 1;
  }
}
