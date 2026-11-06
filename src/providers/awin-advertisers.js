// Advertiser IDs supplied by the publisher: the default allowlist for manual imports and validation.
// Scheduled syncs instead import every advertiser Awin's authenticated feed list marks active/joined
// (see docs/awin-product-catalogue.md), and served products are validated against the active generation.
// Setting AWIN_ALLOWED_ADVERTISERS (a GitHub Actions variable for scheduled runs) restricts which feeds are imported.
export const AWIN_ADVERTISER_IDS = [
  "488", "48471", "1268", "121560", "20856", "129", "35023", "12011", "736", "23764",
  "26458", "10862", "44681", "20978", "114352", "72583", "81459", "125272", "24874", "118721",
  "108812", "110044", "125308", "125422", "125830", "120796", "42921", "128663", "75562", "118009",
  "18177", "48301", "28487", "99965", "3321", "7741", "1374", "15370", "79930", "23525",
  "116145", "45747", "1902", "18657", "25725", "118531", "66284", "21819", "116771",
  "67348", "24432", "44871", "68962", "1736", "27447", "25580", "2957", "114232", "970",
  "62675", "115256", "122814", "12521", "21905", "61927", "20449", "3122", "18159",
  "103213", "99701", "75176", "56981", "1546", "30883", "128405", "38436", "98839", "7038",
  "7765", "899", "79328", "15614", "62307", "30989", "19862",
  "2500", "18484", "3651", "48159",
];

export const AWIN_ADVERTISER_NAME_ALIASES = [
  "engravers guild",
  "wentworth wooden jigsaw company",
  "social stories club",
  "sweet hamper company",
  "detective society",
  "tinkerer steam box",
  "lovelox lockets",
  "papier",
  "interflora",
];

export function isAwinAdvertiserName(value) {
  const normalise = (candidate) => String(candidate || "").toLowerCase()
    .replace(/[^a-z0-9]/g, "").replace(/^the/, "");
  const name = normalise(value);
  return AWIN_ADVERTISER_NAME_ALIASES.some((alias) => {
    const normalised = normalise(alias);
    return name === normalised || name.startsWith(`${normalised}uk`);
  });
}

export function allowedAwinAdvertisers(env = {}) {
  const configured = typeof env.AWIN_ALLOWED_ADVERTISERS === "string"
    ? env.AWIN_ALLOWED_ADVERTISERS.split(",").map((id) => id.trim()).filter(Boolean)
    : AWIN_ADVERTISER_IDS;
  return [...new Set(configured.filter((id) => /^\d{1,8}$/.test(id)))].slice(0, 90);
}
