// Recipient suitability: does this verified product fit the person and their budget?
// Product identity (is it the thing we searched for?) lives in product-matcher.js. Nothing here reads
// the recipient's interests, so adjacent discoveries are never penalised for lacking an interest keyword.

const CHILD_TITLE = /\b(?:baby|infant|toddler|children|child|kids?|teen|junior)\b/i;
const CHILD_BANDS = ["baby", "toddler", "child", "tween", "teen"];

export function evaluateSuitability(spec = {}, product = {}) {
  const reasons = [];
  const title = String(product.title || "");
  const knownAge = String(spec.recipientAgeBand || "unknown");
  const cap = Number(spec.maxPriceGbp);
  const budgetMax = Number(spec.budgetMaxGbp);
  const price = product.price && product.price.currency === "GBP" ? Number(product.price.amount) : null;

  if (knownAge === "adult" && CHILD_TITLE.test(title)) reasons.push("recipient_age_mismatch");
  else if (CHILD_BANDS.includes(knownAge) && /\badult\b/i.test(title)) reasons.push("recipient_age_mismatch");

  if (Number.isFinite(budgetMax) && budgetMax > 0 && price === null) reasons.push("price_unverified_with_budget");
  else if (Number.isFinite(cap) && cap > 0 && price !== null && price > cap) reasons.push("over_budget");

  return { suitable: reasons.length === 0, reasons };
}
