// Registry of every source the engine draws on or has evaluated. Status is deliberately conservative: only sources
// that run in production today are "live". Nothing here enables a source; it documents what each one is allowed to do.

import { configuredProviderId } from "../providers/index.js";

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
    id: "awin-rakuten-feeds",
    kind: "product",
    status: "evaluated",
    provides: ["multi-retailer product feeds with GTINs"],
    trust: "authorised affiliate feeds",
    cost: "approval per advertiser; feed ingestion pipeline",
    note: "Needs advertiser approval and a feed store before it can be used.",
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
  const productLive = env.PRODUCT_DISCOVERY_ENABLED === "true" && configuredProviderId(env) === "amazon";
  return SOURCES.map((s) => ({
    id: s.id,
    kind: s.kind,
    status: s.status,
    active: s.status === "live" || (s.id === "amazon-creators-api" && productLive),
  }));
}
