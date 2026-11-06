import { AWIN_ACCOUNT, MERCHANTS } from "../site/config/affiliates.config.js";

export function publicMonetizationConfig(env = process.env) {
  const config = {
    AWIN_AFFILIATE_ID: env.AWIN_AFFILIATE_ID ?? AWIN_ACCOUNT.affiliateId,
    AWIN_IMAGE_HOSTS: String(env.AWIN_IMAGE_HOSTS || "").split(",")
      .map((host) => host.trim().toLowerCase()).filter((host) => /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(host)),
    ENABLE_ADS: env.ENABLE_ADS === "true",
    ENABLE_EXTERNAL_TELEMETRY: env.ENABLE_EXTERNAL_TELEMETRY === "true",
    ENABLE_SPONSORED_DEMOS: env.ENABLE_SPONSORED_DEMOS === "true",
    ENABLE_VERIFIED_GIFTS: env.ENABLE_VERIFIED_GIFTS === "true",
    TELEMETRY_PROVIDER: env.TELEMETRY_PROVIDER || "",
    SKIMLINKS_ID: env.SKIMLINKS_ID || "",
    AD_SCRIPT_URL: env.AD_SCRIPT_URL || "",
    AD_ALLOWED_HOST: env.AD_ALLOWED_HOST || "",
    MERCHANT_PROGRAMMES: {},
  };
  if (env.AMAZON_PARTNER_TAG) config.AMAZON_TAG = env.AMAZON_PARTNER_TAG;
  if (env.EBAY_CAMPAIGN_ID || env.EBAY_CAMPAIGNID) {
    config.EBAY_CAMPAIGN_ID = env.EBAY_CAMPAIGN_ID || env.EBAY_CAMPAIGNID;
  }
  for (const id of Object.keys(MERCHANTS).filter((id) => !["amazon", "ebay"].includes(id))) {
    const prefix = id.toUpperCase();
    const awin = AWIN_ACCOUNT.programmes[id];
    config.MERCHANT_PROGRAMMES[id] = [
      {
        network: "awin",
        approved: env[`${prefix}_AWIN_APPROVED`] === undefined ? awin?.approved === true : env[`${prefix}_AWIN_APPROVED`] === "true",
        merchantId: env[`${prefix}_AWIN_MERCHANT_ID`] ?? awin?.merchantId ?? "",
        affiliateId: env.AWIN_AFFILIATE_ID ?? AWIN_ACCOUNT.affiliateId,
      },
      { network: "cj", approved: env[`${prefix}_CJ_APPROVED`] === "true", publisherId: env.CJ_PUBLISHER_ID || "", linkId: env[`${prefix}_CJ_LINK_ID`] || "" },
      { network: "skimlinks", approved: env[`${prefix}_SKIMLINKS_APPROVED`] === "true" },
    ].map((programme) => ({
      ...programme,
      commissionRate: Number(env[`${prefix}_${programme.network.toUpperCase()}_COMMISSION_RATE`]) || 0,
      cookieDays: Number(env[`${prefix}_${programme.network.toUpperCase()}_COOKIE_DAYS`]
        ?? (programme.network === "awin" ? awin?.cookieDays : 0)) || 0,
    }));
  }
  return config;
}
