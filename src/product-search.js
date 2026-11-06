import { productMatchThresholds } from "./product-matcher.js";
import { normaliseProductIdea } from "./product-validation.js";
import { createProviders, configuredProviderId } from "./providers/index.js";
import { AmazonProviderError } from "./providers/amazon.js";
import { EbayProviderError } from "./providers/ebay.js";
import { AwinProviderError } from "./providers/awin.js";
import { compileProductEvidence, assessProductEvidence } from "./engine/product-evidence.js";
import { rankProductCandidates, allocateProductCandidates } from "./product-ranking.js";

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
  const second = normaliseQuery(provider.name === "ebay" || provider.name === "awin"
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
  const known = error instanceof AmazonProviderError || error instanceof EbayProviderError || error instanceof AwinProviderError;
  const code = known ? error.code : "unexpected_provider_error";
  const status = known ? error.status : 0;
  console.warn(`${provider.name} product search failed`, code, status);
}

export async function searchProductsForIdeas(values, env, deps, ipHash) {
  const providers = deps.productProvider ? [deps.productProvider] : createProviders(env, deps.fetch);
  const evidence = compileProductEvidence(deps.productEvidencePolicy);
  const found = await Promise.all((providers.length ? providers : [null])
    .map((provider) => searchProvider(values, env, deps, ipHash, provider, evidence)));
  const source = Array.isArray(values) ? values.slice(0, MAX_IDEAS) : [];
  const pools = source.map((value, index) => {
    const idea = normaliseProductIdea(value);
    return idea ? rankProductCandidates(idea, found.flatMap((result) => result.pools[index] || []),
      { evidence, thresholds: productMatchThresholds(env) }) : [];
  });
  const assigned = allocateProductCandidates(pools);
  return {
    enabled: found.some((result) => result.enabled),
    limited: found.some((result) => result.limited),
    ...(providers.length > 1 || found.some((result) => result.unavailable)
      ? { unavailable: found.some((result) => result.unavailable) } : {}),
    products: assigned.products,
    ...(providers.length > 1 ? { offers: assigned.offers } : {}),
    ...(assigned.duplicates ? { duplicates_removed: assigned.duplicates } : {}),
  };
}

async function searchProvider(values, env, deps, ipHash, provider, evidence) {
  const source = Array.isArray(values) ? values.slice(0, MAX_IDEAS) : [];
  const ideas = source.map((value, index) => ({ index, value: normaliseProductIdea(value) })).filter((entry) => entry.value);
  const pools = Array.from({ length: source.length }, () => []);
  if (!provider || !productDiscoveryAvailable(env, provider) || !ideas.length) {
    return { enabled: false, limited: false, pools };
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
  const bestMatch = (idea, query) => rankProductCandidates(idea, queryResults.get(query) || [],
    { evidence, thresholds })[0];
  await fetchQueries(variants.map(([primary]) => primary).filter(Boolean));
  const primaryMatches = ideas.map(({ value }, index) => bestMatch(value, variants[index][0]));
  const alternativeQueries = variants.flatMap((queries, index) => primaryMatches[index]?.imageUrl ? [] : queries.slice(1));
  await fetchQueries(alternativeQueries);
  ideas.forEach(({ value, index }, ideaIndex) => {
    pools[index] = rankProductCandidates(value,
      variants[ideaIndex].flatMap((query) => queryResults.get(query) || []), { evidence, thresholds });
  });
  return { enabled: true, limited, pools, ...(unavailable ? { unavailable: true } : {}) };
}

export async function getCachedProduct(provider, productId, env, deps) {
  if (!provider?.getProduct || typeof productId !== "string") return null;
  const evidence = compileProductEvidence(deps.productEvidencePolicy);
  const permitted = (product) => product && !assessProductEvidence({}, product, evidence).blocked ? product : null;
  const key = new Request(`https://cache.gift-helper.internal/product-detail/v1/${provider.name}/${encodeURIComponent(productId)}`);
  const cached = await readProductCache(key, deps, provider);
  if (cached !== undefined) return permitted(cached[0]);
  try {
    const found = await provider.getProduct(productId);
    const product = permitted(found ? provider.validateProduct(found) : null);
    if (product) cacheProductResults(key, [product], deps, provider);
    return product;
  } catch (error) {
    logProviderError(provider, error);
    return null;
  }
}
