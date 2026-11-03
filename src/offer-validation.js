// Provider-neutral validation of a retailer offer. Everything programme-specific (what an affiliate
// URL looks like, which image hosts are licensed, how old an offer may be) comes from the provider's
// `policy`; nothing here knows about a particular retailer.

import { cleanText } from "./text.js";

const UNAVAILABLE = new Set(["OUT_OF_STOCK", "UNAVAILABLE"]);

/**
 * policy = {
 *   id, merchant,
 *   productIdPattern: RegExp,
 *   imageHosts: string[]              exact allow-list; feed-supplied hosts are never trusted
 *   imageRetention: "link-only-24h" | "licensed-cache" | "none",
 *   imageRights: string               where the right to show the image comes from
 *   maxOfferAgeMs: number,
 *   disclosure: string,
 *   display: { badge, cta, adLabel },
 *   isAffiliateUrl(url, productId): boolean,
 * }
 */

export function isAllowedImageUrl(value, policy) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && policy.imageHosts.includes(url.hostname)
      && !url.username
      && !url.password
      && !url.port;
  } catch {
    return false;
  }
}

/** Returns a normalised offer, or null when any identity, link, image, freshness or availability rule fails. */
export function validateOffer(product, policy, { now = Date.now() } = {}) {
  if (!product || product.provider !== policy.id) return null;
  const productId = (policy.normaliseId || ((id) => id))(cleanText(product.productId || product.asin, 40));
  const title = cleanText(product.title, 240);
  const productUrl = product.productUrl || product.affiliateUrl;
  const affiliateUrl = product.affiliateUrl || product.productUrl;
  if (!policy.productIdPattern.test(productId) || !title || !policy.isAffiliateUrl(productUrl, productId)) return null;
  if (affiliateUrl !== productUrl || !policy.isAffiliateUrl(affiliateUrl, productId)) return null;

  const retrievedAt = Date.parse(product.retrievedAt);
  if (!Number.isFinite(retrievedAt) || retrievedAt > now || now - retrievedAt > policy.maxOfferAgeMs) return null;
  const expiresAt = Math.min(Date.parse(product.expiresAt) || retrievedAt + policy.maxOfferAgeMs, retrievedAt + policy.maxOfferAgeMs);
  if (expiresAt <= now) return null;

  const price = product.price;
  const validPrice = price && price.currency === "GBP" && Number.isFinite(Number(price.amount)) && Number(price.amount) > 0
    ? { amount: Number(price.amount), currency: "GBP" }
    : null;
  const availability = typeof product.availability === "string" ? product.availability : "UNKNOWN";
  if (UNAVAILABLE.has(availability)) return null;
  const condition = typeof product.condition === "string" ? product.condition.toUpperCase() : "UNKNOWN";

  const imageUrl = isAllowedImageUrl(product.imageUrl, policy) ? product.imageUrl : null;
  const additionalImages = Array.isArray(product.additionalImages)
    ? [...new Set(product.additionalImages.filter((url) => isAllowedImageUrl(url, policy)))].slice(0, 5)
    : [];
  return {
    provider: policy.id,
    productId,
    ...(policy.legacyIdField ? { [policy.legacyIdField]: productId } : {}),
    title,
    ...(cleanText(product.brand, 80) ? { brand: cleanText(product.brand, 80) } : {}),
    ...(cleanText(product.description, 1200) ? { description: cleanText(product.description, 1200) } : {}),
    imageUrl,
    additionalImages,
    price: validPrice,
    ...(typeof product.currency === "string" && product.currency === "GBP" ? { currency: "GBP" } : {}),
    productUrl,
    affiliateUrl,
    availability,
    condition,
    retrievedAt: new Date(retrievedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    ...(Number.isFinite(product.matchScore) ? { matchScore: product.matchScore } : {}),
  };
}

/** What the browser needs to label an offer, taken from the provider's policy rather than hard-coded in the page. */
export function displayFor(policy) {
  return {
    merchant: policy.merchant,
    badge: policy.display.badge,
    cta: policy.display.cta,
    adLabel: policy.display.adLabel,
    imageRetention: policy.imageRetention,
  };
}
