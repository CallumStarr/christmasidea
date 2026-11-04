import { amazonPolicy, createAmazonProvider } from "./amazon.js";
import { ebayPolicy, createEbayProvider, ebayConfigured } from "./ebay.js";

const PROVIDERS = {
  amazon: {
    create: createAmazonProvider,
    policy: (env) => amazonPolicy(env.AMAZON_PARTNER_TAG),
    configured: (env) => env.AMAZON_PRODUCT_DISCOVERY_ENABLED !== "false"
      && Boolean(env.AMAZON_CREATORS_CLIENT_ID && env.AMAZON_CREATORS_CLIENT_SECRET && env.AMAZON_PARTNER_TAG),
  },
  ebay: {
    create: createEbayProvider,
    policy: (env) => ebayPolicy(env.EBAY_CAMPAIGN_ID),
    configured: ebayConfigured,
  },
};

export function providerIds() {
  return Object.keys(PROVIDERS);
}

export function createProviders(env, fetchImpl) {
  return providerIds().filter((id) => PROVIDERS[id].configured(env))
    .map((id) => PROVIDERS[id].create(env, fetchImpl));
}

export function configuredProviderId(env = {}) {
  return providerIds().find((id) => PROVIDERS[id].configured(env)) || null;
}

export function createProvider(env, fetchImpl) {
  const id = configuredProviderId(env) || providerIds()[0];
  return PROVIDERS[id].create(env, fetchImpl);
}

/** Every image host any registered provider may serve; the Content-Security-Policy must match this list. */
export function allImageHosts() {
  return [...new Set(providerIds().flatMap((id) => PROVIDERS[id].policy({}).imageHosts))].sort();
}
