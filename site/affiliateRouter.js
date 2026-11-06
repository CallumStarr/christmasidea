import { amazonUrl, ebayUrl } from "./merchant-links.js";
import { MERCHANTS } from "./config/affiliates.config.js";

const numeric = (value) => /^\d+$/.test(String(value || ""));

export function merchantDestination(merchantId, query) {
  const merchant = MERCHANTS[merchantId];
  if (!merchant?.search) throw new TypeError("Unknown searchable merchant");
  const url = new URL(`https://${merchant.host}${merchant.search}`);
  url.searchParams.set(merchant.parameter, query);
  return url.toString();
}

export function validDestination(value, merchantId) {
  try {
    const url = new URL(value);
    const host = MERCHANTS[merchantId]?.host.replace(/^www\./, "");
    return Boolean(host && url.protocol === "https:" && !url.username && !url.password && !url.port
      && [host, `www.${host}`].includes(url.hostname));
  } catch {
    return false;
  }
}

export function affiliateRouter(merchantId, destinationUrl, config = {}) {
  if (!validDestination(destinationUrl, merchantId)) throw new TypeError("Invalid merchant destination");
  const programmes = config.MERCHANT_PROGRAMMES?.[merchantId] || [];
  const eligible = programmes.filter((p) => p.approved === true && (
    (p.network === "awin" && numeric(p.merchantId) && numeric(p.affiliateId))
    || (p.network === "cj" && numeric(p.publisherId) && numeric(p.linkId))
    || (p.network === "skimlinks" && /^\d+(?:X\d+)?$/i.test(config.SKIMLINKS_ID || ""))
  ));
  if (programmes.some((p) => p.approved === true) && !eligible.length) {
    console.warn(`Approved affiliate configuration is incomplete for ${merchantId}; using the direct merchant link.`);
  }
  // Only operator-verified programme terms participate in commission/cookie ordering.
  eligible.sort((a, b) => (Number(b.commissionRate) || 0) - (Number(a.commissionRate) || 0)
    || (Number(b.cookieDays) || 0) - (Number(a.cookieDays) || 0));
  const programme = eligible[0];
  if (!programme) return { href: destinationUrl, network: "direct", affiliate: false };
  let url;
  if (programme.network === "awin") {
    url = new URL("https://www.awin1.com/cread.php");
    url.searchParams.set("awinmid", programme.merchantId);
    url.searchParams.set("awinaffid", programme.affiliateId);
    url.searchParams.set("ued", destinationUrl);
  } else if (programme.network === "cj") {
    url = new URL(`https://www.anrdoezrs.net/click-${programme.publisherId}-${programme.linkId}`);
    url.searchParams.set("url", destinationUrl);
  } else {
    url = new URL("https://go.redirectingat.com/");
    url.searchParams.set("id", config.SKIMLINKS_ID);
    url.searchParams.set("xs", "1");
    url.searchParams.set("url", destinationUrl);
  }
  return { href: url.toString(), network: programme.network, affiliate: true,
    commissionRate: Number(programme.commissionRate) || 0, cookieDays: Number(programme.cookieDays) || 0 };
}

export function retailerLinks(idea, config = {}) {
  if (idea.merchantId && idea.destinationUrl && validDestination(idea.destinationUrl, idea.merchantId)) {
    const routed = affiliateRouter(idea.merchantId, idea.destinationUrl, config);
    return [{ merchantId: idea.merchantId, name: MERCHANTS[idea.merchantId].name, ...routed, search: false }];
  }
  const links = [
    { merchantId: "amazon", name: "Amazon", href: amazonUrl(idea.query, config), network: config.AMAZON_TAG ? "amazon" : "direct", affiliate: Boolean(config.AMAZON_TAG), search: true },
    { merchantId: "ebay", name: "eBay", href: ebayUrl(idea.query, config), network: numeric(config.EBAY_CAMPAIGN_ID) ? "ebay" : "direct", affiliate: numeric(config.EBAY_CAMPAIGN_ID), search: true },
  ];
  const personalised = idea.productSpec?.personalisationRequired === true
    || /\bpersonali[sz]ed\b/i.test(`${idea.title} ${idea.query}`);
  const merchants = personalised ? ["etsy", "noths"] : ["johnlewis", ...["etsy", "noths"].filter((id) =>
    config.MERCHANT_PROGRAMMES?.[id]?.some((programme) => programme.approved === true))];
  const alternatives = merchants.map((id) => ({
    merchantId: id, name: MERCHANTS[id].name,
    ...affiliateRouter(id, merchantDestination(id, idea.query), config), search: true,
  }));
  const paid = alternatives.filter((link) => link.affiliate).sort((a, b) => b.commissionRate - a.commissionRate || b.cookieDays - a.cookieDays);
  return personalised ? [...paid, ...links, ...alternatives.filter((link) => !link.affiliate)] : [...links, ...alternatives];
}
