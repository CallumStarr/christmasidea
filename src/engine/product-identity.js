// Product identity: one real-world product should appear once, and the product shown must be the listing the
// affiliate link points at. Identifiers are checked structurally (GTIN check digit, ASIN shape) before they are trusted.

const ASIN = /^(?:B0[0-9A-Z]{8}|[0-9]{9}[0-9X])$/;

/** True for a GTIN-8/12/13/14 (EAN/UPC) with a valid GS1 mod-10 check digit. */
export function isValidGtin(value) {
  const s = String(value ?? "").trim();
  if (!/^(?:\d{8}|\d{12,14})$/.test(s)) return false;
  const digits = [...s].map(Number);
  const check = digits.pop();
  // Weights alternate 3,1,3,... starting from the digit next to the check digit.
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** GTIN-12/13 and padded GTIN-14 forms of the same item compare equal once normalised to 14 digits. */
export function normaliseGtin(value) {
  const s = String(value ?? "").trim();
  return isValidGtin(s) ? s.padStart(14, "0") : null;
}

/** Amazon standard identifiers: B0-prefixed ASINs, or ISBN-10 shaped ASINs for books. */
export function isValidAsin(value) {
  return ASIN.test(String(value ?? "").trim().toUpperCase());
}

/**
 * A stable identity key. A valid GTIN identifies the product across retailers; otherwise the provider's own
 * listing id does; with neither, the product has no trustworthy identity and gets null.
 */
export function canonicalKey(product) {
  if (!product || typeof product !== "object") return null;
  const gtin = normaliseGtin(product.gtin ?? product.ean ?? product.upc);
  if (gtin) return `gtin:${gtin}`;
  const provider = String(product.provider || "").toLowerCase();
  const id = String(product.productId ?? product.asin ?? "").trim().toUpperCase();
  if (provider === "amazon" || (!provider && product.asin)) return isValidAsin(id) ? `amazon:${id}` : null;
  if (provider === "ebay") return /^V1\|\d{9,15}\|\d{1,15}$/.test(id) ? `ebay:${id}` : null;
  return provider && /^[A-Z0-9._-]{3,64}$/.test(id) ? `${provider}:${id}` : null;
}

/**
 * Assigns each product to at most one idea. When the same listing matched several ideas, the idea with the
 * strongest match keeps it and the others get null, so a shopper never sees one product presented as two gifts.
 * @param products array aligned with ideas; entries are product objects (optionally with matchScore) or null
 * @returns { products, duplicates } with the same alignment
 */
export function assignUniqueProducts(products) {
  const out = products.slice();
  const owner = new Map();
  let duplicates = 0;
  out.forEach((product, index) => {
    const key = canonicalKey(product);
    if (!key) return;
    const prev = owner.get(key);
    if (prev === undefined) {
      owner.set(key, index);
      return;
    }
    duplicates++;
    const score = (i) => Number(out[i]?.matchScore) || 0;
    if (score(index) > score(prev)) {
      out[prev] = null;
      owner.set(key, index);
    } else {
      out[index] = null;
    }
  });
  return { products: out, duplicates };
}
