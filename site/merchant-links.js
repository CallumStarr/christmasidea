export function amazonUrl(query, config = {}) {
  const url = new URL("https://www.amazon.co.uk/s");
  url.searchParams.set("k", query);
  if (config.AMAZON_TAG) url.searchParams.set("tag", config.AMAZON_TAG.trim());
  return url.toString();
}

export function ebayUrl(query, config = {}) {
  const url = new URL("https://www.ebay.co.uk/sch/i.html");
  url.searchParams.set("_nkw", query);
  url.searchParams.set("LH_ItemCondition", "1000");
  url.searchParams.set("LH_BIN", "1");
  if (/^\d+$/.test(config.EBAY_CAMPAIGN_ID || "")) {
    url.searchParams.set("campid", config.EBAY_CAMPAIGN_ID);
    url.searchParams.set("mkcid", "1");
    url.searchParams.set("mkevt", "1");
    url.searchParams.set("toolid", "10001");
  }
  return url.toString();
}

// Device clocks drift from the server's. A listing timestamped slightly "in the future" by this
// device's clock is still a fresh listing, so allow a few minutes either way before rejecting it.
export const CLOCK_SKEW_MS = 5 * 60000;

/** True when the server's retrieval time is plausible on this device's clock, allowing for drift. */
export function retrievedInPast(retrieved, now = Date.now()) {
  return Number.isFinite(retrieved) && retrieved <= now + CLOCK_SKEW_MS;
}

export function validProduct(product, config = {}, now = Date.now()) {
  if (!product || !["amazon", "ebay", "awin"].includes(product.provider)
      || product.affiliateUrl !== product.productUrl || !product.title
      || product.condition !== "NEW" || !["IN_STOCK", "IN_STOCK_SCARCE"].includes(product.availability)) return false;
  const retrieved = Date.parse(product.retrievedAt), expires = Date.parse(product.expiresAt);
  const maxAge = product.provider === "awin" ? 24 * 3600000 : 3600000;
  if (!Number.isFinite(expires) || !retrievedInPast(retrieved, now)
      || now - retrieved >= maxAge + CLOCK_SKEW_MS || expires <= now || expires > retrieved + maxAge) return false;
  try {
    const url = new URL(product.affiliateUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (product.provider === "amazon") {
      const id = url.pathname.match(/^\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
      return /^[A-Z0-9]{10}$/.test(product.asin || "") && product.productId === product.asin
        && ["amazon.co.uk", "www.amazon.co.uk"].includes(url.hostname)
        && id?.toUpperCase() === product.asin && Boolean(config.AMAZON_TAG)
        && url.searchParams.get("tag") === config.AMAZON_TAG;
    }
    if (product.provider === "ebay") {
      const identity = /^v1\|(\d{9,15})\|(\d{1,15})$/.exec(product.productId || "");
      const listing = url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/);
      const campaign = config.EBAY_CAMPAIGN_ID || "";
      return Boolean(identity && (!campaign || /^\d+$/.test(campaign))
        && ["www.ebay.co.uk", "www.ebay.com"].includes(url.hostname)
        && listing?.[1] === identity[1]
        && (identity[2] === "0" || url.searchParams.get("var") === identity[2])
        && (campaign
          ? url.searchParams.get("campid") === campaign
            && url.searchParams.get("mkevt") === "1" && url.searchParams.get("mkcid") === "1"
          : !["campid", "mkevt", "mkcid"].some((key) => url.searchParams.has(key))));
    }
    const identity = /^(\d{1,8}):([A-Za-z0-9._-]{1,80})$/.exec(product.productId || "");
    const publisherId = String(config.AWIN_AFFILIATE_ID || "").trim();
    const merchantDestination = new URL(product.merchantProductUrl || "");
    if (!identity || !/^\d{1,8}$/.test(publisherId)
        || url.hostname !== "www.awin1.com" || !["/cread.php", "/pclick.php"].includes(url.pathname)
        || merchantDestination.protocol !== "https:" || merchantDestination.username
        || merchantDestination.password || merchantDestination.port) return false;
    const advertiserId = url.searchParams.get("awinmid") || url.searchParams.get("m");
    const affiliateId = url.searchParams.get("awinaffid") || url.searchParams.get("a");
    if (advertiserId !== identity[1] || affiliateId !== publisherId) return false;
    if (url.pathname === "/pclick.php" && url.searchParams.has("p")) {
      if (url.searchParams.get("p") !== identity[2]) return false;
      const destinationValue = url.searchParams.get("ued");
      if (!destinationValue) return true;
      const destination = new URL(destinationValue);
      return destination.protocol === "https:" && !destination.username && !destination.password
        && !destination.port && destination.href === merchantDestination.href;
    }
    const destination = new URL(url.searchParams.get("ued") || "");
    return destination.href === merchantDestination.href
      && destination.protocol === "https:"
      && !destination.username && !destination.password && !destination.port;
  } catch {
    return false;
  }
}

export function validProductImage(value, provider, config = {}) {
  const hosts = provider === "ebay" ? ["i.ebayimg.com"]
    : provider === "amazon" ? ["m.media-amazon.com", "images-eu.ssl-images-amazon.com"]
      : provider === "awin" ? (Array.isArray(config.AWIN_IMAGE_HOSTS) ? config.AWIN_IMAGE_HOSTS
        : String(config.AWIN_IMAGE_HOSTS || "").split(",").map((host) => host.trim().toLowerCase())) : [];
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname)
      && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}
