import { contentStems, words } from "./text.js";
import { evaluateSuitability } from "./product-suitability.js";

const COLOURS = new Set([
  "black", "blue", "brown", "burgundy", "cream", "gold", "green", "grey", "orange",
  "pink", "purple", "red", "silver", "white", "yellow", "navy", "teal", "tan", "maroon",
]);
const PERSONALISATION = /\b(?:personali[sz]ed|engraved|monogrammed|customi[sz]ed|made to order)\b/i;
const CUSTOM_PERSONALISATION = /\b(?:personali[sz](?:ed|ation)|custom(?:i[sz]ed)?|your (?:name|text|message)|add (?:a |your )?name|monogrammed)\b/i;
const MATERIAL_GROUPS = [
  ["cotton", "polyester", "linen"],
  ["wooden", "wood", "bamboo", "plastic", "glass", "marble"],
];
const UNSUITABLE_LISTING = /\b(?:porn|pornographic|fuck|fucking|shit|cunt|tits)\b|\bt\*ts\b/i;
const ADD_ON = /\b(?:accessor(?:y|ies)|replacement|spare|compatible|case|cover|sheath|blade|blades|holder|attachment|protector|sharpener|sharpening|cleaner|cleaning|brush|bag|organizer|storage|maintenance)\b/i;

function terms(value) {
  const containers = words(value).filter((word) => /^(?:kits?|sets?)$/.test(word))
    .map((word) => word.replace(/s$/, ""));
  return [...contentStems(String(value || "")
    .replace(/\b(?:cookbooks?|cookery books?)\b/gi, "cookbook")
    .replace(/\b(?:whetstones?|sharpening stones?)\b/gi, "sharpening stone")
    .replace(/\b(?:cutting|chopping) boards?\b/gi, "chopping board")
    .replace(/\b(?:culinary|food) history\b/gi, "food history")), ...containers];
}

function conflictingMaterial(idea, title) {
  const requested = `${idea.title} ${idea.query}`.toLowerCase();
  const listed = title.toLowerCase();
  const contains = (text, material) => new RegExp(`\\b${material}\\b`, "i").test(text);
  return MATERIAL_GROUPS.some((group) => {
    const expected = group.filter((material) => contains(requested, material));
    if (!expected.length) return false;
    const wood = expected.some((material) => ["wooden", "wood", "bamboo"].includes(material));
    return group.some((material) => contains(listed, material) && !expected.includes(material)
      && !(wood && ["wooden", "wood", "bamboo"].includes(material)));
  });
}
function includesPhrase(text, phrase) {
  const expected = terms(phrase);
  if (!expected.length) return false;
  const available = new Set(terms(text));
  return expected.every((term) => available.has(term));
}

function normaliseColour(value) {
  return String(value || "").trim().toLowerCase();
}

function hasConflictingTitleColour(title, preferred) {
  return words(title)
    .filter((term) => COLOURS.has(term))
    .map(normaliseColour)
    .some((colour) => colour !== preferred);
}

function scoreComponents(idea, product) {
  const spec = idea.productSpec || {};
  const title = String(product.title || "");
  const details = [title, product.brand, product.description, ...(product.features || [])].filter(Boolean).join(" ");
  const productType = idea.concept || idea.title;
  const typeTerms = terms(productType);
  const titleTerms = new Set(terms(title));
  const availableTerms = new Set(terms(details));
  const typeHits = typeTerms.filter((term) => titleTerms.has(term)).length;
  const typeScore = typeTerms.length ? typeHits / typeTerms.length : 0;
  const queryTerms = terms(idea.query);
  const queryHits = queryTerms.filter((term) => availableTerms.has(term)).length;
  const queryScore = queryTerms.length ? queryHits / queryTerms.length : 0;

  const preferred = Array.isArray(spec.preferredFeatures) ? spec.preferredFeatures : [];
  const preferredMatches = preferred.filter((feature) => includesPhrase(details, feature)).length;
  const preferredScore = preferred.length ? preferredMatches / preferred.length : null;
  const colour = normaliseColour(spec.preferredColour);
  const colourMatches = colour
    ? includesPhrase(details, colour) && !hasConflictingTitleColour(title, colour)
    : null;
  const cap = Number(spec.maxPriceGbp);
  const budgetMax = Number(spec.budgetMaxGbp);
  const price = product.price && product.price.currency === "GBP" ? Number(product.price.amount) : null;
  const budgetScore = Number.isFinite(cap) && cap > 0 && price !== null ? (price <= cap ? 1 : 0) : null;

  const weighted = [
    [typeScore, 0.45],
    [queryScore, 0.25],
    ...(preferredScore === null ? [] : [[preferredScore, 0.15]]),
    ...(colourMatches === null ? [] : [[colourMatches ? 1 : 0, 0.05]]),
    ...(budgetScore === null ? [] : [[budgetScore, 0.10]]),
  ];
  const totalWeight = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  const score = totalWeight ? weighted.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight : 0;
  return { score, typeScore, queryScore, details, price, cap, budgetMax };
}

export function productMatchThresholds(env = {}) {
  const parse = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1 ? number : fallback;
  };
  const high = parse(env.PRODUCT_MATCH_HIGH_THRESHOLD, 0.78);
  const medium = Math.min(high, parse(env.PRODUCT_MATCH_MEDIUM_THRESHOLD, 0.55));
  return { high, medium };
}

export function scoreProductMatch(idea, product, thresholds = productMatchThresholds()) {
  const spec = idea.productSpec || {};
  const { score, typeScore, queryScore, details } = scoreComponents(idea, product);
  const productType = idea.concept || idea.title;
  const availability = String(product.availability || "").toUpperCase();
  const title = String(product.title || "");
  const reasons = [];
  const requiredFeatures = Array.isArray(spec.requiredFeatures) ? spec.requiredFeatures : [];
  const requiredVariants = Array.isArray(spec.requiredVariants) ? spec.requiredVariants : [];
  if (typeScore < 1 || (ADD_ON.test(title) && !ADD_ON.test(productType))) reasons.push("wrong_product_type");
  if (String(product.condition || "").toUpperCase() !== "NEW") reasons.push("condition_unverified_or_not_new");
  if (!["IN_STOCK", "IN_STOCK_SCARCE"].includes(availability)) reasons.push("availability_unverified_or_not_in_stock");
  if (spec.brandPreference && !includesPhrase(`${product.brand || ""} ${product.title || ""}`, spec.brandPreference)) {
    reasons.push("brand_mismatch");
  }
  if (requiredFeatures.some((feature) => !includesPhrase(details, feature))) reasons.push("required_feature_missing");
  if (requiredVariants.some((variant) => !includesPhrase(title, variant))) reasons.push("variant_mismatch");
  if (spec.preferredColour) {
    if (!includesPhrase(details, normaliseColour(spec.preferredColour))
      || hasConflictingTitleColour(String(product.title || ""), normaliseColour(spec.preferredColour))) {
      reasons.push("colour_mismatch");
    }
  }
  if (spec.personalisationRequired && !PERSONALISATION.test(details)) reasons.push("personalisation_missing");
  if (/\bpersonali[sz]ed\b/i.test(`${idea.title} ${idea.query}`)
      && !CUSTOM_PERSONALISATION.test(details)) reasons.push("custom_personalisation_unverified");
  if (conflictingMaterial(idea, title)) reasons.push("material_mismatch");
  if (UNSUITABLE_LISTING.test(title) && !UNSUITABLE_LISTING.test(`${idea.title} ${idea.query}`)) {
    reasons.push("unsuitable_listing_content");
  }
  reasons.push(...evaluateSuitability(spec, product).reasons);
  if (queryScore < 0.5) reasons.push("low_query_relevance");

  const confidence = score >= thresholds.high ? "high" : score >= thresholds.medium ? "medium" : "low";
  return {
    matchScore: Math.round(score * 1000) / 1000,
    confidence,
    accepted: reasons.length === 0 && confidence === "high",
    reasons,
  };
}
