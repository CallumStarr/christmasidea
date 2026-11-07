import { cleanText } from "../text.js";
import { validateOffer } from "../offer-validation.js";
import { fetchWithoutRedirect } from "../upstream-fetch.js";

const ITEM_ID = /^v1\|(\d{9,15})\|(\d{1,15})$/;
const tokens = new Map();
const API_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";

// A configured campaign is only used once the operator has explicitly recorded EPN approval; otherwise
// offers fall back to ordinary (untracked) listing URLs that the public site also accepts.
export function ebayCampaignId(env = {}) {
  if (String(env.EBAY_AFFILIATE_TRACKING_APPROVED || "").trim() !== "true") return "";
  return String(env.EBAY_CAMPAIGN_ID || env.EBAY_CAMPAIGNID || "").trim();
}

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
  if (!identity || typeof value !== "string" || (campaignId && !/^\d+$/.test(campaignId))) return false;
  try {
    const url = new URL(value);
    const listing = url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/);
    return url.protocol === "https:"
      && ["www.ebay.co.uk", "www.ebay.com"].includes(url.hostname)
      && !url.username && !url.password && !url.port
      && listing?.[1] === identity[1]
      && (identity[2] === "0" || url.searchParams.get("var") === identity[2])
      && (campaignId
        ? url.searchParams.get("campid") === campaignId
          && url.searchParams.get("mkevt") === "1" && url.searchParams.get("mkcid") === "1"
        : !["campid", "mkevt", "mkcid"].some((key) => url.searchParams.has(key)));
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
    persistResults: false,
    imageRights: "eBay API and Partner Network terms; operator-reported approval for attributed, non-clickable examples beside equal merchant links",
    maxOfferAgeMs: 3600_000,
    disclosure: "As an eBay Partner Network Affiliate, I earn from qualifying purchases.",
    display: { badge: "Matched eBay listing", cta: "View on eBay", adLabel: "Affiliate link" },
    isAffiliateUrl: (url, id) => isEbayProductUrl(url, id, campaignId),
  };
}

export function ebayConfigured(env) {
  const campaignId = ebayCampaignId(env);
  return Boolean(env.EBAY_PRODUCT_DISCOVERY_ENABLED === "true"
    && env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET
    && (!campaignId || /^\d+$/.test(campaignId)));
}

async function request(url, init, env, fetchImpl) {
  try {
    return await fetchWithoutRedirect(fetchImpl, url, {
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
  const clientId = env.EBAY_CLIENT_ID.trim();
  const clientSecret = env.EBAY_CLIENT_SECRET.trim();
  const cached = tokens.get(clientId);
  if (!refresh && cached?.expiresAt > Date.now() + 30000) return cached.value;
  const response = await request(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }).toString(),
  }, env, fetchImpl);
  if (!response.ok) {
    const data = await json(response);
    const category = ["invalid_client", "invalid_grant", "invalid_request", "invalid_scope", "unauthorized_client"]
      .includes(data?.error) ? data.error : "rejected";
    throw new EbayProviderError(`token_${category}`, response.status);
  }
  const data = await json(response);
  if (typeof data?.access_token !== "string" || !data.access_token || !(Number(data.expires_in) > 0)) {
    throw new EbayProviderError("malformed_token_response");
  }
  tokens.set(clientId, {
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
  const campaignId = ebayCampaignId(env);
  const policy = ebayPolicy(campaignId);
  const images = [item.image, ...(Array.isArray(item.thumbnailImages) ? item.thumbnailImages : [])]
    .filter((image) => image?.imageUrl)
    .sort((a, b) => (Number(b.width) || 0) * (Number(b.height) || 0)
      - (Number(a.width) || 0) * (Number(a.height) || 0));
  return validateOffer({
    provider: "ebay",
    productId: item.itemId,
    title: cleanText(item.title, 240),
    description: cleanText(item.shortDescription, 1200),
    imageUrl: images[0]?.imageUrl,
    additionalImages: item.additionalImages?.map((image) => image.imageUrl),
    price,
    priceIncludesDelivery: price !== null,
    productUrl: campaignId ? item.itemAffiliateWebUrl : item.itemWebUrl,
    affiliateUrl: campaignId ? item.itemAffiliateWebUrl : item.itemWebUrl,
    availability: "IN_STOCK",
    condition: "NEW",
    retrievedAt: new Date(now).toISOString(),
    expiresAt: new Date(Math.min(now + 3600_000, item.itemEndDate ? Date.parse(item.itemEndDate) : Infinity)).toISOString(),
  }, policy, { now });
}

export function createEbayProvider(env, fetchImpl) {
  const campaignId = ebayCampaignId(env);
  const policy = ebayPolicy(campaignId);
  return {
    name: "ebay",
    policy,
    cacheScope: `${env.EBAY_CLIENT_ID || ""}:${campaignId}`,
    isAvailable: () => env.PRODUCT_DISCOVERY_ENABLED === "true" && ebayConfigured(env),
    validateProduct: (product) => validateOffer(product, policy),
    async searchProducts(query, { reserveRetry } = {}) {
      const url = new URL(API_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "30");
      url.searchParams.set("fieldgroups", "EXTENDED");
      url.searchParams.set("filter", "conditions:{NEW},buyingOptions:{FIXED_PRICE},deliveryCountry:GB,itemLocationCountry:GB");
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0 && reserveRetry && !await reserveRetry()) {
          throw new EbayProviderError("rate_limited", 429);
        }
        const token = await accessToken(env, fetchImpl, attempt > 0);
        response = await request(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
            ...(campaignId ? { "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${campaignId}` } : {}),
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
