// Shared vocabulary for the input form, prompt and validators.

export const RELATIONS = [
  "partner", "mum", "dad", "parent", "sibling", "friend", "child", "teen",
  "grandparent", "colleague", "secret-santa", "other",
];
export const AGES = ["baby", "toddler", "child", "tween", "teen", "20s", "30s-40s", "50s-60s", "70-plus", "unknown"];
export const BUDGETS = {
  "any": "no specific budget",
  "under-15": "under £15",
  "15-30": "£15 to £30",
  "30-50": "£30 to £50",
  "50-100": "£50 to £100",
  "100-plus": "£100 or more",
};
// Upper limit in pounds for each guided budget band (null = no ceiling).
export const BUDGET_CAPS = { "any": null, "under-15": 15, "15-30": 30, "30-50": 50, "50-100": 100, "100-plus": null };
export const OCCASIONS = ["christmas", "birthday", "secret-santa", "anniversary", "thank-you", "other"];
export const CATEGORIES = [
  "Tech", "Home", "Kitchen", "Books", "Games & toys", "Hobbies & crafts",
  "Outdoors & sport", "Beauty & wellbeing", "Fashion & accessories",
  "Music & film", "Stationery", "Food & treats",
];

// Why each idea exists. Used by the model to plan variety and by the ranker to balance the final eight.
export const ANGLES = [
  "practical-upgrade", "niche-hobby", "combines-interests", "problem-solver",
  "personalised", "creative-or-learning-kit", "everyday-quality", "versatile",
];

// v4 discovery strategies: how an idea relates to what the shopper said.
export const STRATEGIES = [
  "core-interest", "deeper-niche", "adjacent-driver", "cross-interest",
  "problem-solver", "make-or-do", "personalised", "everyday-upgrade", "versatile",
];
// Strategies that move away from the literal interest (the "gift they didn't know existed").
export const DISCOVERY_STRATEGIES = new Set(["adjacent-driver", "cross-interest"]);
export const AGE_BANDS = ["baby", "toddler", "child", "tween", "teen", "adult", "unknown"];
export const BUDGET_SCOPES = ["per_gift", "total", "unspecified"];

export const LABELS = {
  relation: {
    partner: "their partner", mum: "their mum", dad: "their dad", parent: "a parent",
    sibling: "a brother or sister", friend: "a friend", child: "a child", teen: "a teenager",
    grandparent: "a grandparent", colleague: "a colleague", "secret-santa": "a Secret Santa recipient",
    other: "someone",
  },
  age: {
    baby: "a baby (under 1)", toddler: "a toddler (1 to 3)", child: "a child (4 to 8)",
    tween: "a child aged 9 to 12", teen: "a teenager (13 to 17)", "20s": "in their 20s",
    "30s-40s": "in their 30s or 40s", "50s-60s": "in their 50s or 60s", "70-plus": "70 or older",
    unknown: "age not given",
  },
  occasion: {
    christmas: "Christmas", birthday: "a birthday", "secret-santa": "Secret Santa",
    anniversary: "an anniversary", "thank-you": "a thank-you", other: "a general gift",
  },
};
