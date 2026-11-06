import { cleanText, words } from "../text.js";
import { validateOffer } from "../offer-validation.js";
import { allowedAwinAdvertisers } from "./awin-advertisers.js";

const PRODUCT_ID = /^(\d{1,8}):([A-Za-z0-9._-]{1,80})$/;
const MAX_FEED_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 40;
const MAX_SEARCH_TERMS = 8;

export class AwinProviderError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "AwinProviderError";
    this.code = code;
    this.status = status;
  }
}

function configuredImageHosts(env) {
  return [...new Set(String(env.AWIN_IMAGE_HOSTS || "").split(",").map((host) => host.trim().toLowerCase())
    .filter((host) => /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(host)))];
}

export function awinPolicy(env = {}, advertiserIds = allowedAwinAdvertisers(env)) {
  const publisherId = String(env.AWIN_PUBLISHER_ID || "").trim();
  const allowed = new Set(advertiserIds);
  return {
    id: "awin",
    merchant: "Awin retailer",
    productIdPattern: PRODUCT_ID,
    imageHosts: configuredImageHosts(env),
    imageRetention: "link-only-24h",
    imageRights: "Publisher product feed; image hosts must be explicitly approved",
    maxOfferAgeMs: MAX_FEED_AGE_MS,
    persistResults: false,
    disclosure: "We may earn a commission from qualifying purchases through Awin.",
    display: { badge: "Matched retailer product", cta: "View product", adLabel: "Affiliate link" },
    isAffiliateUrl: (url, productId) => isAwinProductUrl(url, productId, publisherId, allowed),
  };
}

export function isAwinProductUrl(value, productId, publisherId, allowed = new Set(), merchantProductUrl = "") {
  const identity = PRODUCT_ID.exec(String(productId || ""));
  if (!identity || !publisherId || !/^\d{1,8}$/.test(publisherId) || !allowed.has(identity[1])) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.awin1.com"
        || !["/cread.php", "/pclick.php"].includes(url.pathname)
        || url.username || url.password || url.port) return false;
    const advertiserId = url.searchParams.get("awinmid") || url.searchParams.get("m");
    const affiliateId = url.searchParams.get("awinaffid") || url.searchParams.get("a");
    if (advertiserId !== identity[1] || affiliateId !== publisherId) return false;
    if (url.pathname === "/pclick.php" && url.searchParams.has("p")) {
      if (url.searchParams.get("p") !== identity[2]) return false;
      const destinationValue = url.searchParams.get("ued");
      if (!destinationValue) return true;
      const destination = new URL(destinationValue);
      if (destination.protocol !== "https:" || destination.username || destination.password || destination.port) return false;
      if (!merchantProductUrl) return true;
      return destination.href === new URL(merchantProductUrl).href;
    }
    const destination = new URL(url.searchParams.get("ued") || "");
    if (destination.protocol !== "https:" || destination.username || destination.password || destination.port) return false;
    return !merchantProductUrl || destination.href === new URL(merchantProductUrl).href;
  } catch {
    return false;
  }
}

export function validateAwinProduct(product, env = {}, now = Date.now(), advertiserIds = allowedAwinAdvertisers(env)) {
  if (!product || product.provider !== "awin") return null;
  if (product.availability !== "IN_STOCK" || product.condition !== "NEW") return null;
  const policy = awinPolicy(env, advertiserIds);
  const productId = cleanText(product.productId, 100);
  const identity = PRODUCT_ID.exec(productId);
  if (!identity || !advertiserIds.includes(identity[1])) return null;
  const affiliateUrl = typeof product.affiliateUrl === "string" ? product.affiliateUrl : "";
  const merchantProductUrl = typeof product.merchantProductUrl === "string" ? product.merchantProductUrl : "";
  const amount = Number(product.price?.amount);
  if (product.price?.currency !== "GBP" || !Number.isFinite(amount) || amount <= 0) return null;
  if (!isAwinProductUrl(affiliateUrl, productId, String(env.AWIN_PUBLISHER_ID || "").trim(),
    new Set(advertiserIds), merchantProductUrl)) return null;
  try {
    const merchantUrl = new URL(merchantProductUrl);
    if (merchantUrl.protocol !== "https:" || merchantUrl.username || merchantUrl.password || merchantUrl.port) return null;
    const destinationValue = new URL(affiliateUrl).searchParams.get("ued");
    if (destinationValue && new URL(destinationValue).href !== merchantUrl.href) return null;
  } catch {
    return null;
  }

  const deliveryAmount = Number(product.deliveryCost?.amount);
  const deliveryKnown = product.deliveryIncluded === true && product.deliveryCost?.currency === "GBP"
    && Number.isFinite(deliveryAmount) && deliveryAmount >= 0;
  const normalised = validateOffer({
    ...product,
    productId,
    provider: "awin",
    productUrl: affiliateUrl,
    affiliateUrl,
    price: {
      amount: Math.round((amount + (deliveryKnown && product.priceIncludesDelivery !== true ? deliveryAmount : 0)) * 100) / 100,
      currency: "GBP",
    },
    priceIncludesDelivery: deliveryKnown,
    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl : null,
    availability: product.availability === "IN_STOCK" ? "IN_STOCK" : "UNKNOWN",
    condition: "NEW",
    retrievedAt: product.retrievedAt,
    expiresAt: product.expiresAt,
  }, policy, { now });
  if (!normalised) return null;

  const merchantName = cleanText(product.merchantName, 80);
  const gtin = cleanText(product.gtin, 14);
  return {
    ...normalised,
    merchantProductUrl,
    ...(merchantName ? { merchantName } : {}),
    ...(gtin && /^(?:\d{8}|\d{12,14})$/.test(gtin) ? { gtin } : {}),
    ...(deliveryKnown ? {
      deliveryCost: { amount: deliveryAmount, currency: "GBP" },
      deliveryIncluded: true,
    } : {}),
  };
}

function ftsExpression(query) {
  const terms = [...new Set(words(query).filter((term) => term.length > 1))].slice(0, MAX_SEARCH_TERMS);
  return terms.length ? terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ") : "";
}

async function catalogueState(db) {
  const row = await db.prepare(
    "SELECT active_generation, published_at FROM awin_catalogue_state WHERE id = 1"
  ).first();
  if (!row || typeof row.active_generation !== "string" || !row.active_generation) return null;
  const publishedAt = Date.parse(row.published_at);
  if (!Number.isFinite(publishedAt) || publishedAt > Date.now() || Date.now() - publishedAt > MAX_FEED_AGE_MS) return null;
  return { generation: row.active_generation, publishedAt };
}

export function awinConfigured(env = {}) {
  return env.PRODUCT_DISCOVERY_ENABLED === "true"
    && env.AWIN_PRODUCT_DISCOVERY_ENABLED === "true"
    && typeof env.AWIN_CATALOG?.prepare === "function"
    && /^\d{1,8}$/.test(String(env.AWIN_PUBLISHER_ID || "").trim())
    && allowedAwinAdvertisers(env).length > 0;
}

export function createAwinProvider(env = {}) {
  const policy = awinPolicy(env);
  const allowed = allowedAwinAdvertisers(env);
  const catalogueAdvertisers = new Set(allowed);
  return {
    name: "awin",
    policy,
    cacheScope: `${env.AWIN_PUBLISHER_ID || ""}:${allowed.join(",")}`,
    isAvailable: () => awinConfigured(env),
    validateProduct: (product) => validateAwinProduct(product, env, Date.now(), [...catalogueAdvertisers]),
    async searchProducts(query) {
      const expression = ftsExpression(query);
      if (!expression) return [];
      const state = await catalogueState(env.AWIN_CATALOG);
      if (!state) return [];
      const statement = env.AWIN_CATALOG.prepare(`
        SELECT p.product_id AS productId, p.advertiser_id AS advertiserId,
          p.title, p.description, p.brand, p.merchant_name AS merchantName,
          p.category, p.price_gbp AS price, p.delivery_cost_gbp AS deliveryCost,
          p.delivery_known AS deliveryKnown, p.image_url AS imageUrl,
          p.merchant_url AS merchantProductUrl, p.affiliate_url AS affiliateUrl,
          p.gtin, p.generation, p.in_stock AS inStock
        FROM awin_products_fts
        JOIN awin_products p
          ON p.product_id = awin_products_fts.product_id
          AND p.generation = awin_products_fts.generation
        WHERE awin_products_fts MATCH ?
          AND p.generation = ?
          AND p.in_stock = 1
          AND p.currency = 'GBP'
        ORDER BY bm25(awin_products_fts), p.product_id
        LIMIT ${MAX_RESULTS}
      `).bind(expression, state.generation);
      const result = await statement.all();
      const { publishedAt } = state;
      return (Array.isArray(result?.results) ? result.results : []).map((row) => {
        const advertiserId = String(row.advertiserId || "");
        if (!/^\d{1,8}$/.test(advertiserId)) return null;
        catalogueAdvertisers.add(advertiserId);
        const deliveryKnown = Number(row.deliveryKnown) === 1;
        const product = {
          provider: "awin",
          productId: row.productId,
          title: row.title,
          description: row.description,
          brand: row.brand,
          merchantName: row.merchantName,
          imageUrl: row.imageUrl,
          merchantProductUrl: row.merchantProductUrl,
          affiliateUrl: row.affiliateUrl,
          price: { amount: Number(row.price), currency: "GBP" },
          ...(deliveryKnown ? {
            deliveryCost: { amount: Number(row.deliveryCost), currency: "GBP" },
            deliveryIncluded: true,
          } : {}),
          gtin: row.gtin,
          availability: Number(row.inStock) === 1 ? "IN_STOCK" : "UNKNOWN",
          condition: "NEW",
          retrievedAt: new Date(publishedAt).toISOString(),
          expiresAt: new Date(publishedAt + MAX_FEED_AGE_MS).toISOString(),
        };
        return validateAwinProduct(product, env, Date.now(), [...catalogueAdvertisers]);
      }).filter(Boolean);
    },
  };
}
