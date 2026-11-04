// Gift types the engine can reason about. Only physical products are live: they are the only type
// we can currently search for at a retailer and link to without making claims we cannot check.
// The others are designed (fields, risks, required evidence) but disabled until a source exists.

export const GIFT_TYPES = {
  physical: {
    live: true,
    label: "Physical product",
    needs: ["search query", "price ceiling"],
  },
  personalised: {
    live: true,
    label: "Personalised physical product",
    needs: ["search query", "price ceiling", "lead-time caution"],
    note: "Personalised items can take longer to arrive. Check the delivery date on the listing.",
  },
  experience: {
    live: false,
    label: "Experience",
    needs: ["location", "date availability", "provider feed", "voucher terms"],
    blocker: "Needs a location-aware experiences provider feed; local availability cannot be inferred.",
  },
  subscription: {
    live: false,
    label: "Subscription",
    needs: ["recurring price", "cancellation terms", "provider feed"],
    blocker: "Recurring charges and cancellation terms must come from the provider, not the model.",
  },
  digital: {
    live: false,
    label: "Digital product",
    needs: ["platform compatibility", "region", "provider feed"],
    blocker: "Platform and region compatibility cannot be checked without a provider feed.",
  },
  charity: {
    live: false,
    label: "Charity gift",
    needs: ["registered charity number", "provider feed"],
    blocker: "Needs a verified charity partner and registered-charity checks.",
  },
};

export const LIVE_GIFT_TYPES = Object.keys(GIFT_TYPES).filter((k) => GIFT_TYPES[k].live);

/** Normalises a model-supplied gift type; unknown values become "physical", disabled ones are kept so they can be rejected. */
export function normaliseGiftType(value) {
  const v = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!v) return "physical";
  if (v === "personalised-physical" || v === "personalized") return "personalised";
  return GIFT_TYPES[v] ? v : "physical";
}

export function giftTypeEnabled(type) {
  return Boolean(GIFT_TYPES[type]?.live);
}
