// Recipient suitability: does this verified product fit the person and their budget?
// Product identity (is it the thing we searched for?) lives in product-matcher.js. Nothing here reads
// the recipient's interests, so adjacent discoveries are never penalised for lacking an interest keyword.

import { ALWAYS_BLOCKED, MINOR_BLOCKED, BABY_BLOCKED, SMALL_PARTS } from "./rules.js";

const CHILD_TITLE = /\b(?:baby|infant|toddler|children|child|kids?|teen|junior)\b/i;
const CHILD_BANDS = ["baby", "toddler", "child", "tween", "teen"];
const UNDER_THREE_WARNING = /\bchoking hazard\b|\bnot (?:suitable|recommended) for (?:children )?under (?:3|three|36 months)\b|\b(?:ages? |children )?3\s*\+/i;

export function evaluateSuitability(spec = {}, product = {}) {
  const reasons = [];
  const title = String(product.title || "");
  const knownAge = String(spec.recipientAgeBand || "unknown");
  const details = [title, product.description, ...(product.features || [])].filter(Boolean).join(" ");
  const rules = [...ALWAYS_BLOCKED];
  if (CHILD_BANDS.includes(knownAge)) rules.push(...MINOR_BLOCKED);
  if (knownAge === "baby") rules.push(...BABY_BLOCKED);
  if (["baby", "toddler"].includes(knownAge)) {
    rules.push(...SMALL_PARTS);
    if (UNDER_THREE_WARNING.test(details)) reasons.push("listing_age_warning");
  }
  for (const [reason, pattern] of rules) {
    if (pattern.test(details)) reasons.push(`restricted_listing:${reason}`);
  }
  const cap = Number(spec.maxPriceGbp);
  const budgetMax = Number(spec.budgetMaxGbp);
  const amount = product.price && product.price.currency === "GBP" ? Number(product.price.amount) : NaN;
  const price = Number.isFinite(amount) && amount > 0 ? amount : null;

  if (knownAge === "adult" && CHILD_TITLE.test(title)) reasons.push("recipient_age_mismatch");
  else if (CHILD_BANDS.includes(knownAge) && /\badult\b/i.test(title)) reasons.push("recipient_age_mismatch");

  const caps = [cap, budgetMax].filter((value) => Number.isFinite(value) && value > 0);
  const effectiveCap = caps.length ? Math.min(...caps) : null;
  if (effectiveCap !== null && price === null) reasons.push("price_unverified_with_budget");
  else if (effectiveCap !== null && price > effectiveCap) reasons.push("over_budget");

  return { suitable: reasons.length === 0, reasons };
}
