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
  if (!enabled) return { selected, notice: "Product photos are unavailable. Please try again later." };
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
        if (used.has(identity) || !validProduct(product, config)
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
  const notice = unavailable ? "Product photos couldn't be checked. Try again shortly."
    : limited ? "Photo lookups reached their limit. Only ideas with checked photos are shown."
    : imageFailed ? "Some photos couldn't load. Only ideas with working photos are shown."
    : !selected.length ? "No suitable ideas with working product photos were found. Try another interest or budget."
    : selected.length < 8 ? "Showing fewer ideas because we couldn't find suitable product photos for the others." : "";
  return { selected, notice };
}
