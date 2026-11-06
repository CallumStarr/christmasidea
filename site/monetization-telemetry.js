import { CATEGORIES, RELATIONS } from "./monetization-data.js";

const EVENTS = new Set(["affiliate_click", "sponsored_click", "whatsapp_share", "native_share", "copy_list", "wishlist_share"]);
const NETWORKS = new Set(["amazon", "ebay", "awin", "cj", "skimlinks", "direct"]);

export function monetizationMetadata(eventType, metadata = {}) {
  if (!EVENTS.has(eventType)) throw new TypeError("Unknown monetization event");
  return {
    eventType,
    merchantNetwork: NETWORKS.has(metadata.merchantNetwork) ? metadata.merchantNetwork : "direct",
    giftCategory: CATEGORIES.includes(metadata.giftCategory) ? metadata.giftCategory : "Other",
    recipientTag: RELATIONS.includes(metadata.recipientTag) ? metadata.recipientTag : "other",
  };
}

export function trackMonetizationEvent(eventType, metadata = {}, config = {}, browser = globalThis) {
  const event = Object.freeze(monetizationMetadata(eventType, metadata));
  if (typeof browser.dispatchEvent === "function" && typeof browser.CustomEvent === "function") {
    browser.dispatchEvent(new browser.CustomEvent("monetization", { detail: event }));
  }
  if (config.ENABLE_EXTERNAL_TELEMETRY !== true) return event;
  const { eventType: name, ...props } = event;
  if (config.TELEMETRY_PROVIDER === "plausible" && typeof browser.plausible === "function") {
    browser.plausible(name, { props });
  } else if (config.TELEMETRY_PROVIDER === "umami" && typeof browser.umami?.track === "function") {
    browser.umami.track(name, props);
  } else {
    console.warn("Monetization telemetry is enabled but its approved adapter is unavailable.");
  }
  return event;
}
