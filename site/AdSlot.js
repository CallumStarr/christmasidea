let scriptPromise;
let scriptSource;

export function approvedAdScript(config) {
  try {
    const url = new URL(config.AD_SCRIPT_URL);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && url.hostname === config.AD_ALLOWED_HOST ? url.toString() : null;
  } catch {
    return null;
  }
}

export function AdSlot(container, placement, config = {}) {
  if (config.ENABLE_ADS !== true) return;
  container.hidden = false;
  container.classList.add("ad-slot");
  container.dataset.adPlacement = placement;
  container.setAttribute("aria-label", "Advertisement");
  const label = document.createElement("p");
  label.className = "ad-label";
  label.textContent = placement === "loading" ? "Advertisement · While Santa's Helper searches the workshop..." : "Advertisement";
  const fallback = document.createElement("div");
  fallback.className = "ad-skeleton";
  fallback.textContent = "Ad space";
  container.replaceChildren(label, fallback);
  const source = approvedAdScript(config);
  if (!source) {
    if (config.AD_SCRIPT_URL) console.warn("Ad script rejected: configure an approved HTTPS host.");
    return;
  }
  if (!scriptPromise) {
    scriptSource = source;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source; script.async = true; script.referrerPolicy = "no-referrer";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("Approved ad script failed to load")), { once: true });
      document.head.append(script);
    });
  }
  if (scriptSource !== source) {
    console.warn("Ad slot rejected a second script source.");
    return;
  }
  scriptPromise.then(() => {
    // The approved provider adapter receives a slot, never finder state or shortlist contents.
    if (typeof window.santasHelperContextualAd === "function") window.santasHelperContextualAd(container, { placement });
    else console.warn("Ad script loaded without the contextual slot adapter; placeholder retained.");
  }).catch((error) => console.warn(error.message));
}
