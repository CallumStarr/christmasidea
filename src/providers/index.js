import { amazonPolicy, createAmazonProvider } from "./amazon.js";
import { ebayPolicy, createEbayProvider, ebayConfigured, ebayCampaignId } from "./ebay.js";
import { awinPolicy, createAwinProvider, awinConfigured } from "./awin.js";

const PROVIDERS = {
  awin: {
    create: createAwinProvider,
    policy: (env) => awinPolicy(env),
    configured: awinConfigured,
  },
  amazon: {
    create: createAmazonProvider,
    policy: (env) => amazonPolicy(env.AMAZON_PARTNER_TAG),
    configured: (env) => env.AMAZON_PRODUCT_DISCOVERY_ENABLED !== "false"
      && Boolean(env.AMAZON_CREATORS_CLIENT_ID && env.AMAZON_CREATORS_CLIENT_SECRET && env.AMAZON_PARTNER_TAG),
  },
  ebay: {
    create: createEbayProvider,
    policy: (env) => ebayPolicy(ebayCampaignId(env)),
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

export function configuredProviderIds(env = {}) {
  return providerIds().filter((id) => PROVIDERS[id].configured(env));
}

export function configuredProviderId(env = {}) {
  return configuredProviderIds(env)[0] || null;
}

export function createProvider(env, fetchImpl) {
  const id = configuredProviderId(env) || providerIds()[0];
  return PROVIDERS[id].create(env, fetchImpl);
}

/** Every image host any registered provider may serve; the Content-Security-Policy must match this list. */
export function allImageHosts() {
  return [...new Set(providerIds().flatMap((id) => PROVIDERS[id].policy({}).imageHosts))].sort();
}
