import { amazonPolicy, createAmazonProvider } from "./amazon.js";

// Only Amazon exists today; a new provider is added here and nowhere else in the product pipeline.
const PROVIDERS = {
  amazon: {
    create: createAmazonProvider,
    policy: (env) => amazonPolicy(env.AMAZON_PARTNER_TAG),
    configured: (env) => Boolean(env.AMAZON_CREATORS_CLIENT_ID && env.AMAZON_CREATORS_CLIENT_SECRET && env.AMAZON_PARTNER_TAG),
  },
};

export function providerIds() {
  return Object.keys(PROVIDERS);
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
