import { cleanText } from "../text.js";
import { validateOffer } from "../offer-validation.js";

const ITEM_ID = /^v1\|(\d{9,15})\|(\d{1,15})$/;
const tokens = new Map();
const API_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";

export class EbayProviderError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "EbayProviderError";
    this.code = code;
    this.status = status;
  }
}

export function isEbayProductUrl(value, productId, campaignId) {
  const identity = ITEM_ID.exec(productId);
  if (!identity || typeof value !== "string" || !/^\d+$/.test(campaignId || "")) return false;
  try {
    const url = new URL(value);
    const listing = url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/);
    return url.protocol === "https:"
      && ["www.ebay.co.uk", "www.ebay.com"].includes(url.hostname)
      && !url.username && !url.password && !url.port
      && listing?.[1] === identity[1]
      && (identity[2] === "0" || url.searchParams.get("var") === identity[2])
      && url.searchParams.get("campid") === campaignId
      && url.searchParams.get("mkevt") === "1"
      && url.searchParams.get("mkcid") === "1";
  } catch {
    return false;
  }
}

export function ebayPolicy(campaignId) {
  return {
    id: "ebay",
    merchant: "eBay UK",
    productIdPattern: ITEM_ID,
    imageHosts: ["i.ebayimg.com"],
    imageRetention: "link-only-24h",
    imageRights: "eBay API and Partner Network terms; operator-reported approval for attributed, non-clickable examples beside equal merchant links",
    maxOfferAgeMs: 3600_000,
    disclosure: "We may earn a commission from qualifying eBay purchases.",
    display: { badge: "Matched eBay listing", cta: "View on eBay", adLabel: "Affiliate link" },
    isAffiliateUrl: (url, id) => isEbayProductUrl(url, id, campaignId),
  };
}

export function ebayConfigured(env) {
  return Boolean(env.EBAY_PRODUCT_DISCOVERY_ENABLED === "true"
    && env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET && /^\d+$/.test(env.EBAY_CAMPAIGN_ID || ""));
}

async function request(url, init, env, fetchImpl) {
  try {
    return await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(Math.max(1000, Math.min(15000, Number(env.PRODUCT_API_TIMEOUT_MS) || 8000))),
    });
  } catch (error) {
    throw new EbayProviderError(error?.name === "TimeoutError" ? "request_timeout" : "request_failed");
  }
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    throw new EbayProviderError("malformed_api_response", response.status);
  }
}

async function accessToken(env, fetchImpl, refresh = false) {
  const cached = tokens.get(env.EBAY_CLIENT_ID);
  if (!refresh && cached?.expiresAt > Date.now() + 30000) return cached.value;
  const response = await request(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }).toString(),
  }, env, fetchImpl);
  if (!response.ok) throw new EbayProviderError("token_rejected", response.status);
  const data = await json(response);
  if (typeof data?.access_token !== "string" || !data.access_token || !(Number(data.expires_in) > 0)) {
    throw new EbayProviderError("malformed_token_response");
  }
  tokens.set(env.EBAY_CLIENT_ID, {
    value: data.access_token,
    expiresAt: Date.now() + Math.min(Number(data.expires_in), 7200) * 1000,
  });
  return data.access_token;
}

export function normaliseEbayItem(item, env, now = Date.now()) {
  if (!item || item.conditionId !== "1000" || !item.buyingOptions?.includes("FIXED_PRICE")) return null;
  if (item.itemEndDate && !(Date.parse(item.itemEndDate) > now)) return null;
  const shipping = Array.isArray(item.shippingOptions)
    ? item.shippingOptions.find((option) => option.shippingCost?.currency === "GBP")
    : null;
  const amount = Number(item.price?.value);
  const delivery = Number(shipping?.shippingCost?.value);
  const price = item.price?.currency === "GBP" && amount > 0 && Number.isFinite(amount)
    && shipping && Number.isFinite(delivery) && delivery >= 0
    ? { amount: Math.round((amount + delivery) * 100) / 100, currency: "GBP" }
    : null;
  const policy = ebayPolicy(env.EBAY_CAMPAIGN_ID);
  return validateOffer({
    provider: "ebay",
    productId: item.itemId,
    title: cleanText(item.title, 240),
    imageUrl: item.image?.imageUrl,
    additionalImages: item.additionalImages?.map((image) => image.imageUrl),
    price,
    productUrl: item.itemAffiliateWebUrl,
    affiliateUrl: item.itemAffiliateWebUrl,
    availability: "IN_STOCK",
    condition: "NEW",
    retrievedAt: new Date(now).toISOString(),
    expiresAt: new Date(Math.min(now + 3600_000, item.itemEndDate ? Date.parse(item.itemEndDate) : Infinity)).toISOString(),
  }, policy, { now });
}

export function createEbayProvider(env, fetchImpl) {
  const policy = ebayPolicy(env.EBAY_CAMPAIGN_ID);
  return {
    name: "ebay",
    policy,
    cacheScope: `${env.EBAY_CLIENT_ID || ""}:${env.EBAY_CAMPAIGN_ID || ""}`,
    isAvailable: () => env.PRODUCT_DISCOVERY_ENABLED === "true" && ebayConfigured(env),
    validateProduct: (product) => validateOffer(product, policy),
    async searchProducts(query) {
      const url = new URL(API_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "10");
      url.searchParams.set("filter", "conditions:{NEW},buyingOptions:{FIXED_PRICE},deliveryCountry:GB,itemLocationCountry:GB");
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        const token = await accessToken(env, fetchImpl, attempt > 0);
        response = await request(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
            "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${env.EBAY_CAMPAIGN_ID}`,
          },
        }, env, fetchImpl);
        if (response.status !== 401 || attempt > 0) break;
      }
      if (!response.ok) throw new EbayProviderError("search_rejected", response.status);
      const data = await json(response);
      if (!data || typeof data !== "object") throw new EbayProviderError("malformed_search_response");
      if (data.errors !== undefined && (!Array.isArray(data.errors) || data.errors.length)) {
        throw new EbayProviderError("api_response_error", response.status);
      }
      if (data.total === 0 && data.itemSummaries === undefined) return [];
      if (!Array.isArray(data.itemSummaries)) throw new EbayProviderError("malformed_search_response");
      return data.itemSummaries.map((item) => normaliseEbayItem(item, env)).filter(Boolean);
    },
  };
}
