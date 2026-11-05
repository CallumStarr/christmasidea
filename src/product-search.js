import { scoreProductMatch, productMatchThresholds } from "./product-matcher.js";
import { normaliseProductIdea } from "./product-validation.js";
import { createProviders, configuredProviderId } from "./providers/index.js";
import { AmazonProviderError } from "./providers/amazon.js";
import { EbayProviderError } from "./providers/ebay.js";
import { assignUniqueProducts } from "./engine/product-identity.js";

const CACHE_TTL = 3600;
const MAX_IDEAS = 8;
const SEARCHES_PER_IDEA = 2;
const SEARCH_CONCURRENCY = 2;
const QUERY_ALLOWED = /[^\p{L}\p{N} '&-]/gu;

export function productDiscoveryAvailable(env = {}, provider = null) {
  const isAvailable = provider
    ? typeof provider.isAvailable === "function"
      && typeof provider.searchProducts === "function"
      && typeof provider.validateProduct === "function"
      && provider.isAvailable() === true
    : Boolean(configuredProviderId(env));
  return env.PRODUCT_DISCOVERY_ENABLED === "true" && isAvailable;
}

function normaliseQuery(query) {
  return String(query || "").toLowerCase().replace(QUERY_ALLOWED, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function queryVariants(idea, provider) {
  const first = normaliseQuery(idea.query);
  const second = normaliseQuery(provider.name === "ebay"
    ? [idea.concept || idea.title, ...idea.productSpec.requiredFeatures, ...idea.productSpec.requiredVariants,
      ...(idea.productSpec.personalisationRequired ? ["personalised"] : [])].join(" ")
    : idea.title);
  return [...new Set([first, second].filter((query) => query.length >= 2))].slice(0, SEARCHES_PER_IDEA);
}

function cacheKey(query, provider) {
  return new Request(`https://cache.gift-helper.internal/product/v1/${provider.name}/${encodeURIComponent(provider.cacheScope || "")}/${encodeURIComponent(query)}`);
}

function createLimiter(max) {
  let active = 0;
  const waiting = [];
  return async (task) => {
    if (active >= max) await new Promise((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

async function readProductCache(key, deps, provider) {
  if (!deps.cache || provider.policy?.persistResults === false) return undefined;
  try {
    const response = await deps.cache.match(key);
    if (!response) return undefined;
    const data = await response.json();
    if (!Array.isArray(data.products)) return undefined;
    const products = data.products.map((item) => provider.validateProduct(item)).filter(Boolean);
    if (products.length !== data.products.length) return undefined;
    return products;
  } catch {
    console.warn("Product cache read failed");
    return undefined;
  }
}

function cacheProductResults(key, products, deps, provider) {
  if (!deps.cache || provider.policy?.persistResults === false) return;
  const put = deps.cache.put(key, new Response(JSON.stringify({ products }), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` },
  })).catch(() => console.warn("Product cache write failed"));
  if (deps.waitUntil) deps.waitUntil(put);
}

function logProviderError(provider, error) {
  const known = error instanceof AmazonProviderError || error instanceof EbayProviderError;
  const code = known ? error.code : "unexpected_provider_error";
  const status = known ? error.status : 0;
  console.warn(`${provider.name} product search failed`, code, status);
}

export async function searchProductsForIdeas(values, env, deps, ipHash) {
  const providers = deps.productProvider ? [deps.productProvider] : createProviders(env, deps.fetch);
  if (providers.length <= 1) return searchProvider(values, env, deps, ipHash, providers[0]);
  const found = await Promise.all(providers.map((provider) => searchProvider(values, env, deps, ipHash, provider)));
  const offers = found[0].products.map((_, index) => found.map((result) => result.products[index]).filter(Boolean));
  return {
    enabled: found.some((result) => result.enabled),
    limited: found.some((result) => result.limited),
    unavailable: found.some((result) => result.unavailable),
    products: offers.map((items) => items[0] || null),
    offers,
  };
}

async function searchProvider(values, env, deps, ipHash, provider) {
  const source = Array.isArray(values) ? values.slice(0, MAX_IDEAS) : [];
  const ideas = source.map((value, index) => ({ index, value: normaliseProductIdea(value) })).filter((entry) => entry.value);
  const results = new Array(source.length).fill(null);
  if (!provider || !productDiscoveryAvailable(env, provider) || !ideas.length) {
    return { enabled: false, limited: false, products: results };
  }

  const variants = ideas.map(({ value }) => queryVariants(value, provider));
  const allQueries = [...new Set(variants.flat())];
  const queryResults = new Map();
  for (const query of allQueries) {
    const cached = await readProductCache(cacheKey(query, provider), deps, provider);
    if (cached !== undefined) queryResults.set(query, cached);
  }

  let limited = false;
  let unavailable = false;
  const limit = createLimiter(SEARCH_CONCURRENCY);
  const fetchQueries = async (queries) => {
    const missing = [...new Set(queries)].filter((query) => !queryResults.has(query));
    const allowance = missing.length && deps.productBudget
      ? Math.max(0, Math.min(missing.length, Number(await deps.productBudget.take(ipHash, missing.length)) || 0))
      : 0;
    const allowed = new Set(missing.slice(0, allowance));
    limited ||= missing.length > allowed.size;
    await Promise.all(missing.map(async (query) => {
      if (!allowed.has(query)) {
        queryResults.set(query, []);
        return;
      }
      try {
        const found = await limit(() => provider.searchProducts(query, {
          reserveRetry: async () => {
            const allowed = Number(await deps.productBudget.take(ipHash, 1)) >= 1;
            limited ||= !allowed;
            return allowed;
          },
        }));
        if (!Array.isArray(found)) throw new TypeError("Provider returned a malformed product list");
        const products = found.map((item) => provider.validateProduct(item)).filter(Boolean);
        queryResults.set(query, products);
        cacheProductResults(cacheKey(query, provider), products, deps, provider);
      } catch (error) {
        logProviderError(provider, error);
        unavailable = true;
        queryResults.set(query, []);
      }
    }));
  };

  const thresholds = productMatchThresholds(env);
  const bestMatch = (idea, query) => {
    let best = null;
    for (const candidate of queryResults.get(query) || []) {
      const match = scoreProductMatch(idea, candidate, thresholds);
      if (match.accepted && (!best || match.matchScore > best.matchScore)) {
        best = { ...candidate, matchScore: match.matchScore };
      }
    }
    return best;
  };
  await fetchQueries(variants.map(([primary]) => primary).filter(Boolean));
  const primaryMatches = ideas.map(({ value }, index) => bestMatch(value, variants[index][0]));
  const alternativeQueries = variants.flatMap((queries, index) => primaryMatches[index] ? [] : queries.slice(1));
  await fetchQueries(alternativeQueries);
  const matched = ideas.map(({ value }, index) => {
    const best = primaryMatches[index] || variants[index].slice(1)
      .map((query) => bestMatch(value, query))
      .filter(Boolean)
      .sort((a, b) => b.matchScore - a.matchScore)[0];
    return best ? provider.validateProduct(best) : null;
  });
  const unique = assignUniqueProducts(matched);
  unique.products.forEach((product, index) => { results[ideas[index].index] = product; });
  return { enabled: true, limited, products: results, ...(unavailable ? { unavailable: true } : {}), ...(unique.duplicates ? { duplicates_removed: unique.duplicates } : {}) };
}

export async function getCachedProduct(provider, productId, env, deps) {
  if (!provider?.getProduct || typeof productId !== "string") return null;
  const key = new Request(`https://cache.gift-helper.internal/product-detail/v1/${provider.name}/${encodeURIComponent(productId)}`);
  const cached = await readProductCache(key, deps, provider);
  if (cached !== undefined) return cached[0] || null;
  try {
    const found = await provider.getProduct(productId);
    const product = found ? provider.validateProduct(found) : null;
    if (product) cacheProductResults(key, [product], deps, provider);
    return product;
  } catch (error) {
    logProviderError(provider, error);
    return null;
  }
}
