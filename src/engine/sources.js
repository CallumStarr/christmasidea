// Registry of every source the engine draws on or has evaluated. Status is deliberately conservative: only sources
// that run in production today are "live". Nothing here enables a source; it documents what each one is allowed to do.

import { configuredProviderIds } from "../providers/index.js";
import { awinConfigured } from "../providers/awin.js";
import { PRODUCT_EVIDENCE_POLICY } from "./product-evidence-policy.js";

export const SOURCE_STATUS = ["live", "conditional", "designed", "evaluated", "rejected"];

export const SOURCES = [
  {
    id: "claude",
    kind: "generation",
    status: "live",
    provides: ["recipient profile", "discovery directions", "candidate ideas"],
    trust: "untrusted: every idea passes the validator; facts must quote the shopper's words",
    cost: "one Haiku call per uncached search",
  },
  {
    id: "interest-graph",
    kind: "knowledge",
    status: "live",
    provides: ["interest to motivation edges", "adjacent gift concepts", "traits"],
    trust: "curated in repository, versioned, unit tested",
    cost: "none (deterministic, in-process)",
  },
  {
    id: "catalogue",
    kind: "knowledge",
    status: "live",
    provides: ["hand-written fallback ideas with age, budget and exclusion rules"],
    trust: "curated in repository",
    cost: "none",
  },
  {
    id: "amazon-creators-api",
    kind: "product",
    status: "conditional",
    provides: ["real listings", "GBP price", "availability", "images (link only)", "affiliate URL tied to the same ASIN"],
    trust: "authorised API; offers expire after one hour and are revalidated",
    cost: "free; rate limited per account",
    requires: ["PRODUCT_DISCOVERY_ENABLED=true", "AMAZON_CREATORS_CLIENT_ID", "AMAZON_CREATORS_CLIENT_SECRET", "AMAZON_PARTNER_TAG"],
  },
  {
    id: "ebay-browse-api",
    kind: "product",
    status: "conditional",
    provides: ["new UK listings", "GBP prices including listed delivery", "listing images", "campaign-bound affiliate links when configured"],
    trust: "eBay Browse API; listing, condition, delivery, campaign and image host are validated",
    cost: "eBay Browse API calls under per-visitor and account limits",
    requires: ["PRODUCT_DISCOVERY_ENABLED=true", "EBAY_PRODUCT_DISCOVERY_ENABLED=true", "eBay production credentials"],
  },
  {
    id: "awin-product-feeds",
    kind: "product",
    status: "conditional",
    provides: ["matched retailer products", "GBP prices", "Awin-tracked product links", "feed images from approved hosts"],
    trust: "approved advertiser feeds, strict advertiser/link/image allowlists, and a 24-hour freshness limit",
    cost: "D1 full-text lookup; feed imports are operator-triggered",
    requires: ["AWIN_PRODUCT_DISCOVERY_ENABLED=true", "AWIN_CATALOG D1 binding", "approved advertiser feed imports"],
  },
  {
    id: "reviewed-product-evidence",
    kind: "knowledge",
    status: "conditional",
    provides: ["identity-matched independent assessments", "product review aggregates", "reviewed safety exclusions"],
    trust: "reviewed provenance, permission, comparison scope and expiry; missing evidence is unassessed, not poor quality",
    cost: "in-process ranking; external evidence acquisition and licensing are separate",
    requires: ["reviewed permitted-use evidence in product-evidence-policy.js"],
    note: "The shipped evidence registry is empty. No independent product-quality or recall-coverage claim is made.",
  },
  {
    id: "feedback-counters",
    kind: "learning",
    status: "live",
    provides: ["anonymous daily counts of clicks, saves and dismissals per strategy and source"],
    trust: "first-party, aggregate only; no IP, text or identifiers stored",
    cost: "Durable Object storage within free tier",
  },
  {
    id: "contextual-bandit",
    kind: "learning",
    status: "designed",
    provides: ["strategy mix tuned from outcomes (LinUCB)"],
    trust: "needs volume and purchase-quality signals before it may change rankings",
    cost: "none until enabled",
  },
  {
    id: "workers-ai-embeddings",
    kind: "retrieval",
    status: "evaluated",
    provides: ["dense semantic retrieval over concepts and products"],
    trust: "n/a",
    cost: "free allocation then per-neuron; adds latency and a binding",
    note: "Deferred: the curated graph is small enough for lexical plus alias retrieval; revisit with a product index.",
  },
  {
    id: "trend-signals",
    kind: "trend",
    status: "rejected",
    provides: ["bestseller movement"],
    trust: "no authorised timestamped source is connected",
    cost: "n/a",
    note: "The engine never claims something is trending; model training knowledge is not a trend source.",
  },
];

/** Registry entries with their runtime status for this environment. Never exposes secret values. */
export function sourceStatus(env = {}) {
  const configured = configuredProviderIds(env);
  const productLive = env.PRODUCT_DISCOVERY_ENABLED === "true" && configured.includes("amazon");
  return SOURCES.map((s) => ({
    id: s.id,
    kind: s.kind,
    status: s.status,
    active: s.status === "live"
      || (s.id === "amazon-creators-api" && productLive)
      || (s.id === "ebay-browse-api" && env.PRODUCT_DISCOVERY_ENABLED === "true" && configured.includes("ebay"))
      || (s.id === "awin-product-feeds" && awinConfigured(env))
      || (s.id === "reviewed-product-evidence" && (PRODUCT_EVIDENCE_POLICY.exclusions.length > 0
        || PRODUCT_EVIDENCE_POLICY.assessments.some((record) => Date.parse(record.expiresAt) > Date.now()))),
  }));
}
