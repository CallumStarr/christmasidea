import { validDestination } from "./affiliateRouter.js";
import { constraintPhrases, parseTextAge } from "./recipient-language.js";

export const RELATIONS = ["partner", "mum", "dad", "sibling", "friend", "child", "teen", "grandparent", "colleague", "secret-santa", "other"];
export const CATEGORIES = ["Tech", "Home", "Kitchen", "Books", "Games & toys", "Hobbies & crafts", "Outdoors & sport", "Beauty & wellbeing", "Fashion & accessories", "Music & film", "Stationery", "Food & treats", "Experiences", "Subscriptions"];
export const RECIPIENT_LABELS = {
  partner: "Partner", mum: "Mum", dad: "Dad", sibling: "Sibling", friend: "Friend",
  child: "Child", teen: "Teenager", grandparent: "Grandparent", colleague: "Colleague",
  "secret-santa": "Secret Santa", other: "Someone else",
};
const TEXT = /[\u0000-\u001f\u007f]/g;
const clean = (value, max) => typeof value === "string" ? value.replace(TEXT, " ").trim().slice(0, max) : "";
const TAGS = {
  gardening: /\bgarden|gardening|plants?\b/i,
  books: /\bbooks?|reading|readers?\b/i,
  coffee: /\bcoffee|espresso|barista\b/i,
  tech: /\btech|technology|gadgets?|gaming\b/i,
  personalised: /\bpersonali[sz]ed\b/i,
  food: /\bfood|cooking|baking\b/i,
  music: /\bmusic|concerts?\b/i,
  tea: /\btea\b/i,
  cooking: /\bcooking|baking|chef\b/i,
  crafts: /\bcrafts?|knitting|sewing|crochet\b/i,
  sport: /\bsports?|fitness|running|cycling\b/i,
  travel: /\btravel|holidays?|camping|walking\b/i,
};

export function queryContext(input = {}, ideas = []) {
  const text = [input.description, input.interests, input.about].filter((x) => typeof x === "string").join(" ");
  let recipientTag = RELATIONS.includes(input.relation) ? input.relation : "other";
  if (recipientTag === "other") {
    for (const tag of ["mum", "dad", "partner", "grandparent"]) {
      if (new RegExp(`\\b${tag}\\b`, "i").test(text)) { recipientTag = tag; break; }
    }
  }
  const tags = Object.entries(TAGS).filter(([, regex]) => regex.test(text)).map(([tag]) => tag);
  tags.push(recipientTag);
  const budgetMax = Number.isFinite(input.budgetMaxGbp) ? input.budgetMaxGbp
    : ideas.find((idea) => Number.isFinite(idea.productSpec?.budgetMaxGbp))?.productSpec.budgetMaxGbp ?? null;
  const age = parseTextAge(text);
  const constraints = constraintPhrases(text);
  return {
    recipientTag, tags, budgetMax,
    minor: ["baby", "toddler", "child", "tween", "teen"].includes(input.age) || ["child", "teen"].includes(recipientTag)
      || /\b(?:baby|toddler|child|teenager)\b/i.test(text)
      || (age !== null && age < 18)
      || ideas.some((idea) => ["baby", "toddler", "child", "tween", "teen"].includes(idea.productSpec?.recipientAgeBand)),
    constrained: constraints.avoid.length > 0 || constraints.owned.length > 0
      || /\b(?:avoid|allerg\w*|no\b|not\b|already|owns?|owned|has most|has every|don't|doesn't|do not)\b/i.test(text),
  };
}

export function savedIdea(value, recipientTag = "other") {
  if (!value || typeof value !== "object") throw new TypeError("Invalid saved gift");
  const title = clean(value.title, 80), query = clean(value.query, 120);
  if (!title || !query || /https?:|www\./i.test(title + query)) throw new TypeError("Invalid gift title or search");
  return {
    title, query, why: clean(value.why, 300),
    category: CATEGORIES.includes(value.category) ? value.category : "Home",
    recipientTag: RELATIONS.includes(value.recipientTag) ? value.recipientTag : RELATIONS.includes(recipientTag) ? recipientTag : "other",
    ...(value.productSpec?.personalisationRequired === true ? { productSpec: { personalisationRequired: true } } : {}),
    ...(clean(value.inventoryId, 80) ? { inventoryId: clean(value.inventoryId, 80) } : {}),
  };
}

export function savedKey(item) {
  return `${item.recipientTag || "other"}|${item.title}`;
}

export function normaliseSavedList(list) {
  if (!Array.isArray(list) || list.length > 50) throw new TypeError("Gift lists must contain at most 50 items");
  const seen = new Set();
  return list.map((item) => savedIdea(item)).filter((item) => {
    const key = savedKey(item);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function readLocalGiftList(list) {
  if (!Array.isArray(list)) throw new TypeError("Invalid browser-local gift list");
  const valid = [];
  for (const entry of list.slice(0, 50)) {
    try { valid.push(savedIdea(entry)); }
    catch (error) {
      if (!(error instanceof TypeError)) throw error;
      console.warn("An invalid browser-local gift was ignored.");
    }
  }
  return normaliseSavedList(valid);
}

function sponsoredValid(item) {
  return item?.active === true && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 80
    && typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 80
    && typeof item.description === "string" && item.description.trim().length > 0 && item.description.length <= 300
    && typeof item.sponsorName === "string" && item.sponsorName.trim().length > 0 && Array.isArray(item.targetTags)
    && item.targetTags.every((tag) => typeof tag === "string") && typeof item.imageUrl === "string"
    && validDestination(item.destinationUrl, item.merchantId)
    && item.priceRange?.currency === "GBP"
    && Number.isFinite(item.priceRange.min) && Number.isFinite(item.priceRange.max)
    && item.priceRange.min >= 0 && item.priceRange.max >= item.priceRange.min
    && Number.isFinite(item.minBudget) && Number.isFinite(item.maxBudget)
    && item.maxBudget >= item.minBudget && Number.isFinite(item.priorityWeight);
}

export function sponsoredIdea(item) {
  const imageUrl = /^\/images\/[a-z0-9_-]+\.(?:webp|png|jpg|jpeg)$/i.test(item.imageUrl || "") ? item.imageUrl : "";
  if (item.imageUrl && !imageUrl) console.warn("Sponsored creative rejected: use a reviewed self-hosted image.");
  return {
    title: item.title, why: item.description, query: item.title, category: CATEGORIES.includes(item.category) ? item.category : "Home",
    inventoryId: item.id, merchantId: item.merchantId, destinationUrl: item.destinationUrl,
    sponsored: true, sponsorName: item.sponsorName, demo: item.demo === true,
    priceRange: item.priceRange,
    imageUrl,
    productSpec: { personalisationRequired: /\bpersonali[sz]ed\b/i.test(item.title) },
  };
}

export function matchingSponsor(inventory, context, config = {}) {
  if (context.minor || context.constrained) return null;
  const eligible = inventory.filter((item) => sponsoredValid(item)
    && (item.demo !== true || config.ENABLE_SPONSORED_DEMOS === true)
    && (context.budgetMax === null || (context.budgetMax >= item.minBudget
      && context.budgetMax <= item.maxBudget && item.priceRange.max <= context.budgetMax)));
  const matches = eligible.map((item) => ({
    item, score: item.targetTags.filter((tag) => context.tags.includes(tag)).length,
  })).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.item.priorityWeight - a.item.priorityWeight || a.item.id.localeCompare(b.item.id));
  const fallback = eligible.filter((item) => item.targetTags.includes("general"))
    .sort((a, b) => b.priorityWeight - a.priorityWeight || a.id.localeCompare(b.id))[0];
  const selected = matches[0]?.item || fallback;
  return selected ? sponsoredIdea(selected) : null;
}

export function verifiedGiftValid(item, now = Date.now()) {
  if (!item || !["experience", "subscription"].includes(item.giftType) || item.active !== true
      || typeof item.id !== "string" || !item.id || item.id.length > 80
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > 80
      || typeof item.description !== "string" || !item.description.trim() || item.description.length > 300
      || !Array.isArray(item.targetTags) || !item.targetTags.every((tag) => typeof tag === "string")
      || !validDestination(item.destinationUrl, item.merchantId)
      || !validDestination(item.termsUrl, item.merchantId)
      || item.price?.currency !== "GBP" || !Number.isFinite(item.price.amount) || item.price.amount <= 0
      || item.available !== true || item.locationScope !== "uk-wide") return false;
  const checked = Date.parse(item.availabilityCheckedAt), expires = Date.parse(item.expiresAt);
  if (!Number.isFinite(checked) || !Number.isFinite(expires) || checked > now || expires <= now
      || now - checked >= 86400000 || expires > checked + 86400000) return false;
  if (item.giftType === "experience") {
    return typeof item.voucherTerms === "string" && item.voucherTerms.length > 0
      && typeof item.locationNote === "string" && item.locationNote.length > 0;
  }
  return Number.isFinite(item.recurringPriceGbp) && item.recurringPriceGbp > 0
    && Number.isFinite(item.minimumTotalGbp) && item.minimumTotalGbp >= item.price.amount
    && typeof item.minimumTerm === "string" && item.minimumTerm.length > 0
    && ["month", "year"].includes(item.billingInterval)
    && typeof item.cancellationTerms === "string" && item.cancellationTerms.length > 0
    && validDestination(item.cancellationUrl, item.merchantId);
}

export function verifiedIdea(item) {
  return {
    title: item.title, query: item.title, why: item.description,
    category: item.giftType === "experience" ? "Experiences" : "Subscriptions",
    inventoryId: item.id, merchantId: item.merchantId, destinationUrl: item.destinationUrl,
    verifiedGift: item,
  };
}

export function verifiedGiftDisclosure(gift) {
  return gift.giftType === "experience"
    ? `Verified voucher price: £${gift.price.amount}. ${gift.locationNote} ${gift.voucherTerms}`
    : `Initial charge: £${gift.price.amount}; recurring charge: £${gift.recurringPriceGbp} per ${gift.billingInterval}. Minimum total commitment: £${gift.minimumTotalGbp}. ${gift.minimumTerm} ${gift.cancellationTerms}`;
}

export function matchingVerifiedGifts(inventory, context, input, config = {}, preferences = {}, now = Date.now()) {
  const adult = ["20s", "30s-40s", "50s-60s", "70-plus"].includes(input.age);
  if (!adult || context.constrained || context.minor || config.ENABLE_VERIFIED_GIFTS !== true) return [];
  return ["experience", "subscription"].flatMap((type) => {
    if (preferences[type] !== true) return [];
    const item = inventory.find((gift) => gift.giftType === type && verifiedGiftValid(gift, now)
      && gift.targetTags.some((tag) => context.tags.includes(tag))
      && (context.budgetMax === null || Math.max(gift.price.amount, gift.recurringPriceGbp || 0, gift.minimumTotalGbp || 0) <= context.budgetMax));
    return item ? [verifiedIdea(item)] : [];
  });
}

export function resolveSavedIdea(item, sponsors, verified, config, now = Date.now()) {
  if (!item.inventoryId) return item;
  const sponsor = sponsors.find((gift) => gift.id === item.inventoryId && sponsoredValid(gift)
    && (gift.demo !== true || config.ENABLE_SPONSORED_DEMOS === true));
  if (sponsor) return { ...sponsoredIdea(sponsor), recipientTag: item.recipientTag };
  const gift = verified.find((gift) => gift.id === item.inventoryId && verifiedGiftValid(gift, now));
  if (gift && config.ENABLE_VERIFIED_GIFTS === true) return { ...verifiedIdea(gift), recipientTag: item.recipientTag };
  return { ...item, unavailableInventory: true };
}

const ADDONS = [
  { match: /\b(?:pour.over|coffee dripper)\b/i, title: "Paper filters for their dripper", query: "coffee dripper paper filters", note: "Check the dripper's exact size and filter shape; filters are not universal." },
  { match: /\b(?:reading light|book sleeve|reading journal)\b/i, title: "Flat bookmark", query: "flat bookmark", note: "A thin bookmark can fit a paper book without bulky charms. Skip this if they read digitally." },
  { match: /\b(?:plant pot|seed storage)\b/i, title: "Plant labels", query: "weatherproof plant labels", note: "Choose labels they need, and avoid duplicating any included with the main gift." },
  { match: /\b(?:notebook|journal)\b/i, title: "Writing pen", query: "writing pen", note: "Check whether a pen is already included, and choose a refill type they can replace." },
];

export function giftAddon(idea, budgetMax, product = null, now = Date.now()) {
  if (idea.inventoryId) return null;
  const addon = ADDONS.find((entry) => entry.match.test(`${idea.title} ${idea.query}`));
  if (!addon) return null;
  const verifiedPrice = product?.price?.currency === "GBP" && Number.isFinite(product.price.amount)
    && Date.parse(product.expiresAt) > now && Date.parse(product.retrievedAt) <= now;
  const remaining = verifiedPrice && Number.isFinite(budgetMax) ? budgetMax - product.price.amount : null;
  if (remaining !== null && remaining <= 0) return null;
  return { ...addon, category: idea.category, remaining };
}
