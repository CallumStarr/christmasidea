import { cleanText } from "./text.js";


function cleanList(value, count = 4) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, count).map((item) => cleanText(item, 80)).filter(Boolean);
}

export function normaliseProductIdea(value) {
  if (!value || typeof value !== "object") return null;
  const title = cleanText(value.title, 80);
  const query = cleanText(value.query, 120).replace(/[^\p{L}\p{N} '&-]/gu, " ");
  const concept = cleanText(value.concept, 80);
  if (!title || !query || query.trim().length < 2) return null;

  const spec = value.productSpec && typeof value.productSpec === "object" ? value.productSpec : {};
  const maxPrice = Number(spec.maxPriceGbp);
  const budgetMax = Number(spec.budgetMaxGbp);
  return {
    title,
    query: query.replace(/\s+/g, " ").trim(),
    concept,
    productSpec: {
      requiredFeatures: cleanList(spec.requiredFeatures),
      requiredVariants: cleanList(spec.requiredVariants),
      preferredFeatures: cleanList(spec.preferredFeatures),
      preferredColour: cleanText(spec.preferredColour, 40),
      brandPreference: cleanText(spec.brandPreference, 60),
      personalisationRequired: spec.personalisationRequired === true,
      recipientAgeBand: ["baby", "toddler", "child", "tween", "teen", "adult"].includes(spec.recipientAgeBand)
        ? spec.recipientAgeBand
        : "unknown",
      maxPriceGbp: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : null,
      budgetMaxGbp: Number.isFinite(budgetMax) && budgetMax > 0 ? budgetMax : null,
    },
  };
}

// Retained so existing callers keep working; the logic lives in the provider module.
export { isApprovedAmazonImageUrl, isAmazonProductUrl, validateProduct } from "./providers/amazon.js";
