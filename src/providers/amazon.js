import { cleanText } from "../text.js";
import { isAllowedImageUrl, validateOffer } from "../offer-validation.js";
import { fetchWithoutRedirect } from "../upstream-fetch.js";

const AMAZON_IMAGE_HOSTS = ["m.media-amazon.com", "images-eu.ssl-images-amazon.com"];
const PRODUCT_ID = /^[A-Z0-9]{10}$/;

export function isAmazonProductUrl(value, asin, partnerTag) {
  if (typeof value !== "string" || !PRODUCT_ID.test(String(asin || "")) || !partnerTag) return false;
  try {
    const url = new URL(value);
    const pathId = url.pathname.match(/^\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
    return url.protocol === "https:"
      && ["www.amazon.co.uk", "amazon.co.uk"].includes(url.hostname)
      && !url.username
      && !url.password
      && !url.port
      && pathId?.toUpperCase() === asin.toUpperCase()
      && url.searchParams.get("tag") === partnerTag;
  } catch {
    return false;
  }
}

// Amazon Creators API terms: images are linked (never stored) and offers expire after one hour.
export function amazonPolicy(partnerTag) {
  return {
    id: "amazon",
    merchant: "Amazon UK",
    productIdPattern: PRODUCT_ID,
    normaliseId: (id) => id.toUpperCase(),
    legacyIdField: "asin",
    imageHosts: AMAZON_IMAGE_HOSTS,
    imageRetention: "link-only-24h",
    imageRights: "Amazon Creators API terms: hot-link only, never store",
    maxOfferAgeMs: 3600_000,
    disclosure: "As an Amazon Associate I earn from qualifying purchases.",
    display: { badge: "Verified Amazon product", cta: "View on Amazon", adLabel: "Affiliate link" },
    isAffiliateUrl: (url, id) => isAmazonProductUrl(url, id, partnerTag),
  };
}

export function isApprovedAmazonImageUrl(value) {
  return isAllowedImageUrl(value, { imageHosts: AMAZON_IMAGE_HOSTS });
}

export function validateProduct(product, { partnerTag, now = Date.now() } = {}) {
  return validateOffer(product, amazonPolicy(partnerTag), { now });
}

const API_URL = "https://creatorsapi.amazon";
const TOKEN_URL = "https://api.amazon.co.uk/auth/o2/token";
const MARKETPLACE = "www.amazon.co.uk";
const TOKEN_LIFETIME_MS = 3600_000;
const tokens = new Map();

export class AmazonProviderError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "AmazonProviderError";
    this.code = code;
    this.status = status;
  }
}

function configured(env) {
  return Boolean(env.PRODUCT_DISCOVERY_ENABLED === "true"
    && env.AMAZON_PRODUCT_DISCOVERY_ENABLED !== "false"
    && env.AMAZON_CREATORS_CLIENT_ID
    && env.AMAZON_CREATORS_CLIENT_SECRET
    && env.AMAZON_PARTNER_TAG);
}

async function getAccessToken(env, fetchImpl, forceRefresh = false) {
  const clientId = env.AMAZON_CREATORS_CLIENT_ID;
  const cached = tokens.get(clientId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 30_000) return cached.value;

  let response;
  try {
    response = await fetchWithoutRedirect(fetchImpl, TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: env.AMAZON_CREATORS_CLIENT_SECRET,
        scope: "creatorsapi::default",
      }),
      signal: AbortSignal.timeout(Number(env.PRODUCT_API_TIMEOUT_MS) || 8000),
    });
  } catch (error) {
    throw new AmazonProviderError(error?.name === "TimeoutError" ? "token_timeout" : "token_network_error");
  }
  if (!response.ok) throw new AmazonProviderError("token_rejected", response.status);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AmazonProviderError("malformed_token_response", response.status);
  }
  if (typeof data?.access_token !== "string" || !data.access_token
    || typeof data.token_type !== "string" || data.token_type.toLowerCase() !== "bearer") {
    throw new AmazonProviderError("malformed_token_response", response.status);
  }
  const expiresIn = Number(data.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new AmazonProviderError("malformed_token_response", response.status);
  }
  tokens.set(clientId, { value: data.access_token, expiresAt: Date.now() + Math.min(expiresIn, 3600) * 1000 });
  return data.access_token;
}

async function apiRequest(operation, body, env, fetchImpl) {
  if (!configured(env)) throw new AmazonProviderError("provider_unavailable");
  let token = await getAccessToken(env, fetchImpl);
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetchWithoutRedirect(fetchImpl, `${API_URL}/catalog/v1/${operation}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-marketplace": MARKETPLACE,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Number(env.PRODUCT_API_TIMEOUT_MS) || 8000),
      });
    } catch (error) {
      throw new AmazonProviderError(error?.name === "TimeoutError" ? "api_timeout" : "api_network_error");
    }
    if (response.status === 401 && attempt === 0) {
      tokens.delete(env.AMAZON_CREATORS_CLIENT_ID);
      token = await getAccessToken(env, fetchImpl, true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (!response.ok) {
      throw new AmazonProviderError(response.status === 429 ? "rate_limited" : "api_rejected", response.status);
    }
    break;
  }
  try {
    const data = await response.json();
    if (data?.errors !== undefined && (!Array.isArray(data.errors) || data.errors.length)) {
      throw new AmazonProviderError("api_response_error", response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof AmazonProviderError) throw error;
    throw new AmazonProviderError("malformed_api_response", response.status);
  }
}

function displayValue(value) {
  return cleanText(value?.displayValue, 240);
}

export function normaliseAmazonItem(item, env, now = Date.now()) {
  if (!item || typeof item !== "object") return null;
  const asin = cleanText(item.asin, 10).toUpperCase();
  const title = displayValue(item.itemInfo?.title) || cleanText(item.title, 240);
  const productUrl = typeof item.detailPageURL === "string" ? item.detailPageURL : "";
  const brand = displayValue(item.itemInfo?.byLineInfo?.brand);
  const features = Array.isArray(item.itemInfo?.features?.displayValues)
    ? item.itemInfo.features.displayValues.map((value) => cleanText(value, 300)).filter(Boolean).slice(0, 10)
    : [];
  const image = item.images?.primary?.large?.url || item.images?.primary?.medium?.url || "";
  const variants = Array.isArray(item.images?.variants)
    ? item.images.variants.map((variant) => variant?.large?.url || variant?.medium?.url).filter(isApprovedAmazonImageUrl)
    : [];
  const listing = Array.isArray(item.offersV2?.listings)
    ? item.offersV2.listings.find((offer) => offer?.isBuyBoxWinner) || item.offersV2.listings[0]
    : null;
  const amount = Number(listing?.price?.money?.amount);
  const price = listing?.price?.money?.currency === "GBP" && Number.isFinite(amount) && amount > 0
    ? { amount, currency: "GBP" }
    : null;

  if (!asin || !title || !isAmazonProductUrl(productUrl, asin, env.AMAZON_PARTNER_TAG)) return null;
  return validateProduct({
    provider: "amazon",
    productId: asin,
    asin,
    title,
    ...(brand ? { brand } : {}),
    ...(features.length ? { description: features.join(" ") } : {}),
    imageUrl: isApprovedAmazonImageUrl(image) ? image : null,
    additionalImages: variants,
    price,
    condition: cleanText(listing?.condition?.value, 40).toUpperCase() || "UNKNOWN",
    currency: price?.currency,
    productUrl,
    affiliateUrl: productUrl,
    availability: listing?.availability?.type || "UNKNOWN",
    retrievedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3600_000).toISOString(),
  }, { partnerTag: env.AMAZON_PARTNER_TAG, now });
}

function searchItems(data) {
  const items = data?.searchResult?.items;
  if (Array.isArray(items)) return items;
  const details = data?.itemsResult?.items;
  if (Array.isArray(details)) return details;
  throw new AmazonProviderError("malformed_search_response");
}

export function createAmazonProvider(env, fetchImpl) {
  return {
    name: "amazon",
    policy: amazonPolicy(env.AMAZON_PARTNER_TAG),
    cacheScope: env.AMAZON_PARTNER_TAG,
    isAvailable: () => configured(env),
    validateProduct: (product) => validateProduct(product, { partnerTag: env.AMAZON_PARTNER_TAG }),
    async searchProducts(query) {
      const data = await apiRequest("searchItems", {
        keywords: query,
        searchIndex: "All",
        itemCount: 10,
        availability: "Available",
        condition: "New",
        marketplace: MARKETPLACE,
        partnerTag: env.AMAZON_PARTNER_TAG,
        resources: [
          "images.primary.large",
          "images.primary.medium",
          "images.variants.large",
          "itemInfo.title",
          "itemInfo.byLineInfo",
          "itemInfo.features",
          "offersV2.listings.condition",
          "offersV2.listings.price",
          "offersV2.listings.availability",
        ],
      }, env, fetchImpl);
      return searchItems(data).map((item) => normaliseAmazonItem(item, env)).filter(Boolean);
    },
    async getProduct(productId) {
      if (!/^[A-Z0-9]{10}$/i.test(String(productId || ""))) return null;
      const data = await apiRequest("getItems", {
        itemIds: [String(productId).toUpperCase()],
        itemIdType: "ASIN",
        marketplace: MARKETPLACE,
        partnerTag: env.AMAZON_PARTNER_TAG,
        resources: [
          "images.primary.large",
          "images.primary.medium",
          "images.variants.large",
          "itemInfo.title",
          "itemInfo.byLineInfo",
          "itemInfo.features",
          "offersV2.listings.condition",
          "offersV2.listings.price",
          "offersV2.listings.availability",
        ],
      }, env, fetchImpl);
      const items = data?.itemsResult?.items;
      if (!Array.isArray(items)) throw new AmazonProviderError("malformed_detail_response");
      return normaliseAmazonItem(items.find((item) => item?.asin === String(productId).toUpperCase()), env);
    },
  };
}

export { TOKEN_LIFETIME_MS };
