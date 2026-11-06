export const MERCHANTS = {
  amazon: { name: "Amazon", host: "www.amazon.co.uk", network: "amazon" },
  ebay: { name: "eBay", host: "www.ebay.co.uk", network: "ebay" },
  etsy: { name: "Etsy", host: "www.etsy.com", search: "/uk/search", parameter: "q" },
  noths: { name: "Not On The High Street", host: "www.notonthehighstreet.com", search: "/search", parameter: "term" },
  buyagift: { name: "Buyagift", host: "www.buyagift.co.uk", search: "/search", parameter: "q" },
  virgin: { name: "Virgin Experience Days", host: "www.virginexperiencedays.co.uk", search: "/search", parameter: "q" },
  johnlewis: { name: "John Lewis", host: "www.johnlewis.com", search: "/search", parameter: "search-term" },
  ethicalsuperstore: { name: "Ethical Superstore", host: "www.ethicalsuperstore.com" },
  greentulip: { name: "Green Tulip", host: "www.greentulip.co.uk" },
  virginiahayward: { name: "Virginia Hayward Hampers", host: "www.virginiahayward.com" },
};

// Public IDs only. Applications are pending; approval must be verified before enabling.
export const AWIN_ACCOUNT = {
  affiliateId: "3146453",
  programmes: {
    noths: { merchantId: "18484", approved: false, cookieDays: 30 },
    ethicalsuperstore: { merchantId: "3651", approved: false, cookieDays: 30 },
    greentulip: { merchantId: "48159", approved: false, cookieDays: 30 },
    virginiahayward: { merchantId: "2500", approved: false, cookieDays: 30 },
  },
};

export const DEFAULT_MONETIZATION_CONFIG = {
  ENABLE_ADS: false,
  ENABLE_EXTERNAL_TELEMETRY: false,
  ENABLE_SPONSORED_DEMOS: false,
  ENABLE_VERIFIED_GIFTS: false,
  TELEMETRY_PROVIDER: "",
  SKIMLINKS_ID: "",
  MERCHANT_PROGRAMMES: {},
  AD_SCRIPT_URL: "",
  AD_ALLOWED_HOST: "",
};
