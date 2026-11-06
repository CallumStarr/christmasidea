import { fetchProductBatches } from "./api.js";
import { validProduct, validProductImage } from "./merchant-links.js";

export function loadProductImage(url, signal) {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (loaded) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      if (!loaded) image.src = "";
      resolve(loaded);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(false), 5000);
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else image.src = url;
  });
}

export async function selectPhotographedIdeas(ideas, replacements = [], {
  config = {}, signal, enabled = true,
  fetchBatches = fetchProductBatches, loadImage = loadProductImage,
} = {}) {
  const selected = [];
  const used = new Set();
  const titles = new Set();
  let unavailable = !enabled, limited = false, imageFailed = false;
  const complete = (notice) => {
    for (const idea of ideas.slice(0, 8)) {
      if (selected.length >= 8) break;
      if (titles.has(idea.title.toLowerCase())) continue;
      titles.add(idea.title.toLowerCase());
      selected.push({ idea, offers: [] });
    }
    return { selected, degraded: unavailable || limited, notice };
  };
  if (!enabled) return complete("Product photos are unavailable. Ideas are shown without photos.");
  const inspect = async (candidates) => {
    if (!candidates.length) return;
    const found = new Array(candidates.length);
    await fetchBatches(candidates, (result, offset) => {
      unavailable ||= result.unavailable === true;
      limited ||= result.limited === true;
      for (let index = 0; index < Math.max(result.products.length, result.offers?.length || 0); index++) {
        const offers = result.offers?.[index] || (result.products[index] ? [result.products[index]] : []);
        found[offset + index] = offers;
      }
    }, { enabled, signal });
    signal?.throwIfAborted();
    for (const [index, idea] of candidates.entries()) {
      if (selected.length >= 8) break;
      if (titles.has(idea.title.toLowerCase())) continue;
      const offers = [];
      for (const product of found[index] || []) {
        const identity = `${product.provider}:${product.productId}`;
        if (product.provider === "ebay" || used.has(identity) || !validProduct(product, config)
            || !validProductImage(product.imageUrl, product.provider, config)) continue;
        const loaded = await loadImage(product.imageUrl, signal);
        signal?.throwIfAborted();
        if (!loaded) {
          imageFailed = true;
          continue;
        }
        if (validProduct(product, config)) offers.push(product);
      }
      if (!offers.length) continue;
      for (const product of offers) used.add(`${product.provider}:${product.productId}`);
      titles.add(idea.title.toLowerCase());
      selected.push({ idea, offers });
    }
  };
  await inspect(ideas.slice(0, 8));
  if (selected.length < 8 && !unavailable && !limited) {
    await inspect(replacements.slice(0, 4).filter((idea) => !titles.has(idea.title.toLowerCase())));
  }
  const notice = unavailable ? "Product photos couldn't be checked. Some ideas are shown without photos."
    : limited ? "Photo lookups reached their limit. Some ideas are shown without photos."
    : imageFailed ? "Some photos couldn't load. Those ideas are shown without photos."
    : selected.length < Math.min(8, ideas.length) ? "Some ideas are shown without photos. Use the shop searches to explore them." : "";
  return complete(notice);
}
