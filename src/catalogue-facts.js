import { cleanText } from "./text.js";
import { normaliseGtin } from "./engine/product-identity.js";

const PLACEHOLDER = /^(?:0+(?:\.0+)?|n\/?a|none|null|unknown|not (?:available|applicable)|-|undefined)$/i;
const FIELDS = { model: 120, mpn: 100, dimensions: 200, warranty: 300 };

export function catalogueClaim(value, max) {
  if (typeof value !== "string") return "";
  const text = cleanText(value, max);
  return PLACEHOLDER.test(text) ? "" : text;
}

export function feedIdentity(values) {
  const supplied = values.filter((value) => typeof value === "string" && value.trim());
  const valid = [...new Set(supplied.map((value) => normaliseGtin(value)).filter(Boolean))];
  return {
    gtin: valid.length === 1 ? valid[0] : "",
    status: valid.length > 1 ? "conflicting" : valid.length ? "valid" : supplied.length ? "invalid" : "missing",
  };
}

export function packagingSignature(title) {
  const text = String(title || "").toLowerCase();
  const count = text.match(/\b(?:box|pack|case|carton)\s+of\s+(\d{1,4})\b/)
    || text.match(/\b(\d{1,4})\s*[- ]?(?:pack|pcs|pieces)\b/)
    || text.match(/\b(\d{1,4})\s*[x\u00d7]\s*\d+(?:\.\d+)?\s*(?:g|kg|ml|l)\b/);
  const size = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  const unit = size ? (size[2] === "kg" || size[2] === "g" ? "g" : "ml") : null;
  const amount = size ? Number(size[1]) * (["kg", "l"].includes(size[2]) ? 1000 : 1) : null;
  return JSON.stringify({ count: count ? Number(count[1]) : null, amount, unit });
}

export function normaliseCatalogueClaims(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [field, max] of Object.entries(FIELDS)) {
    const text = catalogueClaim(value[field], max);
    if (text) result[field] = text;
  }
  return result;
}

export function catalogueFacts(claims, sourceUrl, observedAt, expiresAt) {
  const values = normaliseCatalogueClaims(claims);
  if (!Object.keys(values).length) return null;
  const observed = Date.parse(observedAt), expires = Date.parse(expiresAt);
  if (!Number.isFinite(observed) || !Number.isFinite(expires) || expires <= observed) {
    throw new TypeError("Invalid catalogue fact dates");
  }
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new TypeError("Invalid catalogue fact source");
  }
  return {
    version: "catalogue-facts-v1", source: "advertiser-feed", trust: "retailer-asserted",
    sourceUrl: url.href, observedAt: new Date(observed).toISOString(),
    expiresAt: new Date(expires).toISOString(), claims: values,
  };
}
