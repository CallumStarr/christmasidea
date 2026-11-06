import { retailerLinks } from "./affiliateRouter.js";
import {
  RELATIONS, RECIPIENT_LABELS, queryContext, matchingSponsor, matchingVerifiedGifts,
  resolveSavedIdea, savedIdea, savedKey, normaliseSavedList, giftAddon, verifiedGiftValid, verifiedGiftDisclosure,
} from "./monetization-data.js";
import { wishlistUrl, decodeWishlist, sharedListText, finderPreset } from "./wishlist-state.js";
import { calendarReminder } from "./calendar-reminder.js";
import { trackMonetizationEvent } from "./monetization-telemetry.js";
import { AdSlot } from "./AdSlot.js";

const $ = (selector) => document.querySelector(selector);
function button(label, action) {
  const element = document.createElement("button");
  element.type = "button"; element.className = "btn btn-outline"; element.textContent = label;
  element.addEventListener("click", action);
  return element;
}

async function loadInventory(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Gift partner inventory could not be loaded (${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new TypeError("Gift partner inventory has an invalid format.");
  return data;
}

export function createMonetizationUI({ config, notify, getShortlist, setShortlist, renderShared, getInput, onInventoryExpiry }) {
  let context = { recipientTag: "other", tags: [], budgetMax: null };
  let sponsors = [], verified = [], recent = [], shared = null;
  let selectedAddon = null;
  let initialisation = 0;
  const offers = new Map();
  const inventoryReady = Promise.all([
    loadInventory("/data/sponsoredProducts.json"), loadInventory("/data/verifiedGifts.json"),
  ]).then(([a, b]) => { sponsors = a; verified = b; scheduleInventoryExpiry(); })
    .catch((error) => { console.warn(error); notify("Partner inventory is unavailable. Ordinary gift ideas and shopping links still work."); });
  try {
    recent = normaliseSavedList(JSON.parse(localStorage.getItem("ci-recent-ideas") || "[]")).slice(-12);
  } catch (error) {
    console.warn("Recently viewed ideas could not be read.", error);
    notify("Recently viewed ideas are unavailable on this browser.");
  }

  const resolve = (item) => resolveSavedIdea(item, sponsors, verified, config);
  const linksFor = (item) => item.unavailableInventory ? [] : retailerLinks(item, config);
  const currentList = () => $("#dlg").open ? getShortlist() : shared || getShortlist();
  const track = (event, metadata = {}) => trackMonetizationEvent(event, metadata, config);
  function scheduleInventoryExpiry() {
    const next = verified.map((item) => Date.parse(item.expiresAt)).filter((date) => date > Date.now()).sort((a, b) => a - b)[0];
    if (!next || next - Date.now() > 86400000) return;
    setTimeout(() => { updateShelf(); onInventoryExpiry?.(); scheduleInventoryExpiry(); }, Math.max(0, next - Date.now()));
  }
  async function share(method) {
    try {
      const items = currentList();
      const url = await wishlistUrl(items, location.href);
      const text = sharedListText(items.map(resolve), url, linksFor);
      if (method === "native") {
        if (!navigator.share) {
          await navigator.clipboard.writeText(text);
          notify("Native sharing is unavailable. Your gift list and shopping links were copied instead.");
          track("copy_list");
          return;
        }
        await navigator.share({ title: "My gift shortlist", text });
        track("native_share");
      } else if (method === "whatsapp" || method === "whatsapp-web") {
        track("whatsapp_share");
        notify("Opening WhatsApp. If the app is unavailable, use WhatsApp Web instead.");
        location.href = method === "whatsapp" ? `whatsapp://send?text=${encodeURIComponent(text)}`
          : `https://wa.me/?text=${encodeURIComponent(text)}`;
      } else {
        await navigator.clipboard.writeText(method === "url" ? url : text);
        notify(method === "url" ? "Shareable gift-list link copied." : "Gift list and shopping links copied.");
        track(method === "url" ? "wishlist_share" : "copy_list");
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Gift list sharing failed.", error);
      notify(error instanceof RangeError || error instanceof TypeError ? error.message : "Couldn't share this list. Check browser permissions and try again.");
    }
  }

  const sharing = $("#gift-sharing");
  sharing.append(
    button("Share this list", () => void share("native")),
    button("Send to WhatsApp / Family Chat", () => void share("whatsapp")),
    button("WhatsApp Web", () => void share("whatsapp-web")),
    button("Copy Gift List", () => void share("copy")),
    button("Copy list link", () => void share("url")),
  );
  const scope = document.createElement("p"); scope.className = "source";
  scope.textContent = "Shares your saved list, not your description. Anyone with the link can read it; removing a local gift cannot revoke a shared copy.";
  sharing.append(scope);
  $("#clear-recent").addEventListener("click", () => {
    recent = [];
    try { localStorage.removeItem("ci-recent-ideas"); }
    catch (error) { console.warn("Recently viewed ideas could not be cleared.", error); notify("Couldn't clear browser history storage. Check your browser settings."); }
    updateShelf();
  });

  const calendar = $("#gift-reminder");
  const explanation = document.createElement("p");
  explanation.textContent = "Download a Black Friday reminder, or choose a birthday for a reminder two weeks before it. The date stays in this browser and is not saved.";
  const birthday = document.createElement("input"); birthday.type = "date"; birthday.id = "reminder-birthday";
  const label = document.createElement("label"); label.htmlFor = birthday.id; label.textContent = "Birthday date (optional)";
  const download = button("Add occasion reminder (.ics)", () => {
    try {
      const contents = calendarReminder({ birthday: birthday.value });
      const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = "santas-helper-reminder.ics";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      birthday.value = "";
      notify("Calendar file downloaded. Open it in your calendar app to add the reminder.");
    } catch (error) { console.warn("Calendar reminder failed.", error); notify(error.message); }
  });
  calendar.append(explanation, label, birthday, download);
  AdSlot($("#loading-ad"), "loading", config);
  AdSlot($("#results-ad"), "below-results", config);

  function updateShelf() {
    const shelf = $("#resume-shopping"), list = $("#resume-items");
    list.replaceChildren();
    const saved = getShortlist();
    const items = [...saved.slice(-8), ...recent.filter((item) => !saved.some((gift) => savedKey(gift) === savedKey(item))).slice(-4)];
    shelf.hidden = items.length === 0;
    for (const item of items) {
      const gift = resolve(item), row = document.createElement("li");
      const title = document.createElement("strong"); title.textContent = item.title;
      const note = document.createElement("small"); note.textContent = `${RECIPIENT_LABELS[item.recipientTag] || RECIPIENT_LABELS.other} · ${saved.some((x) => savedKey(x) === savedKey(item)) ? "Saved" : "Recently viewed"}`;
      row.append(title, note);
      if (gift.sponsored) {
        const badge = document.createElement("small"); badge.className = "sponsored-badge";
        badge.textContent = `Sponsored Pick${gift.demo ? " · Demo placement" : ""}`; row.append(badge);
      }
      if (gift.verifiedGift) {
        const disclosure = document.createElement("p"); disclosure.className = "source";
        disclosure.textContent = verifiedGiftDisclosure(gift.verifiedGift); row.append(disclosure);
      }
      for (const merchant of linksFor(gift)) {
        const link = document.createElement("a"); link.href = merchant.href; link.textContent = `${merchant.search ? "Search" : "View on"} ${merchant.name}`;
        link.target = "_blank"; link.rel = "sponsored noopener noreferrer"; link.className = "shop";
        link.dataset.network = merchant.network; link.dataset.category = gift.category; link.dataset.recipient = item.recipientTag;
        if (gift.sponsored) link.dataset.sponsored = "true";
        row.append(link);
      }
      if (gift.unavailableInventory) {
        const unavailable = document.createElement("p"); unavailable.textContent = "Partner offer no longer available."; row.append(unavailable);
      }
      list.append(row);
    }
  }

  function renderAddon(idea) {
    const container = $("#gift-addons"); container.replaceChildren();
    const addon = giftAddon(idea, context.budgetMax, offers.get(idea.title));
    container.hidden = !addon;
    if (!addon) return;
    const heading = document.createElement("h3"); heading.textContent = `A small extra for ${idea.title}`;
    const note = document.createElement("p"); note.textContent = addon.note;
    const budget = document.createElement("p"); budget.className = "source";
    budget.textContent = addon.remaining === null
      ? "Optional extra, not part of the main gift. Both prices and the combined delivered total must be checked."
      : `About ${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(addon.remaining)} remains against your cap based on the current matched offer. The extra's price and total delivery cost are not verified.`;
    container.append(heading, note, budget);
    for (const merchant of retailerLinks(addon, config)) {
      const link = document.createElement("a"); link.className = "shop"; link.href = merchant.href;
      link.textContent = `Search ${merchant.name}`; link.target = "_blank"; link.rel = "sponsored noopener noreferrer";
      link.dataset.network = merchant.network; link.dataset.category = addon.category; link.dataset.recipient = context.recipientTag;
      container.append(link);
    }
  }

  function comparison(card, idea) {
    const panel = card.querySelector(".offer-comparison");
    if (!panel) return;
    const list = panel.querySelector("ul"); list.replaceChildren();
    const now = Date.now();
    const prices = [...card.querySelectorAll(".product-price")].filter((node) => Number(node.dataset.expiresAt) > now);
    for (const node of prices) {
      const row = document.createElement("li"); row.textContent = node.textContent; list.append(row);
    }
    const note = panel.querySelector("p");
    note.textContent = prices.length >= 2
      ? "These are retailer-specific matched listings, not guaranteed identical products. Check specifications and final delivered totals; no cheapest claim is made."
      : prices.length === 1 ? "Only one current matched price is available. Other merchant buttons are searches, not price comparisons."
        : "No verified prices available. Use the retailer searches to compare current listings, specifications and delivery.";
    const amount = card.querySelector(".product-price");
    if (amount && Number(amount.dataset.expiresAt) > now) {
      offers.set(idea.title, {
        price: { currency: "GBP", amount: Number(amount.dataset.amount) },
        retrievedAt: amount.dataset.retrievedAt, expiresAt: new Date(Number(amount.dataset.expiresAt)).toISOString(),
      });
    } else offers.delete(idea.title);
    if (selectedAddon?.title === idea.title) renderAddon(idea);
  }

  const annotated = new WeakMap();
  function annotateCard(card, idea) {
    const body = card.querySelector(".card-body");
    card.dataset.category = idea.category;
    card.dataset.recipient = idea.recipientTag || context.recipientTag;
    annotated.set(card, idea);
    if (idea.sponsored) {
      card.classList.add("sponsored-card"); card.dataset.sponsored = "true";
      const badge = document.createElement("p"); badge.className = "sponsored-badge";
      badge.textContent = `Sponsored Pick${idea.demo ? " · Demo placement, not a paid endorsement" : ""}`;
      const sponsor = document.createElement("p"); sponsor.className = "source"; sponsor.textContent = idea.sponsorName;
      body.prepend(badge); body.append(sponsor);
      if (idea.imageUrl) {
        const image = document.createElement("img"); image.src = idea.imageUrl;
        image.alt = `${idea.title} — partner-supplied creative`; image.width = 1200; image.height = 840;
        image.loading = "lazy"; image.decoding = "async"; image.className = "sponsor-image";
        image.addEventListener("error", () => { image.remove(); notify("A partner image couldn't load; the gift details and shopping link remain available."); }, { once: true });
        body.prepend(image);
      }
      const price = document.createElement("p"); price.className = "source";
      price.textContent = `Indicative partner range: £${idea.priceRange.min}–£${idea.priceRange.max}. Check the seller's current price and delivery.`;
      body.append(price);
      card.querySelector(".idea-feedback")?.remove();
      card.querySelector(".dismiss")?.remove();
    }
    if (idea.unavailableInventory) {
      card.querySelector(".merchant-links")?.replaceChildren();
      const note = document.createElement("p"); note.textContent = "This partner offer is no longer available. No expired partner link is shown."; body.append(note);
    }
    if (idea.verifiedGift) {
      const gift = idea.verifiedGift;
      const terms = document.createElement("p"); terms.className = "source";
      terms.textContent = verifiedGiftDisclosure(gift);
      const link = document.createElement("a"); link.href = gift.termsUrl; link.target = "_blank";
      link.rel = "noopener noreferrer"; link.textContent = "Read provider terms"; terms.append(" ", link); body.append(terms);
      if (gift.giftType === "subscription") {
        const cancellation = document.createElement("a"); cancellation.href = gift.cancellationUrl;
        cancellation.target = "_blank"; cancellation.rel = "noopener noreferrer"; cancellation.textContent = "Cancellation information";
        terms.append(" · ", cancellation);
      }
      card.querySelector(".idea-feedback")?.remove();
      const expiry = Math.max(0, Date.parse(gift.expiresAt) - Date.now());
      setTimeout(() => {
        if (!card.isConnected) return;
        if (!verifiedGiftValid(gift)) {
          card.querySelector(".merchant-links").replaceChildren();
          terms.textContent = "This verified offer has expired. Check the provider directly before purchasing.";
        }
      }, expiry);
    } else if (!idea.inventoryId) {
      const panel = document.createElement("details"); panel.className = "offer-comparison";
      const summary = document.createElement("summary"); summary.textContent = "Compare available offers";
      panel.append(summary, document.createElement("ul"), document.createElement("p")); body.append(panel);
      comparison(card, idea);
      panel.addEventListener("toggle", () => comparison(card, idea));
      const extra = giftAddon(idea, context.budgetMax);
      if (extra) body.append(button("Complete this gift", () => {
        selectedAddon = idea; renderAddon(idea); $("#gift-addons").scrollIntoView({ behavior: "auto", block: "nearest" });
      }));
      if (idea.productSpec?.personalisationRequired || /\bpersonali[sz]ed\b/i.test(idea.title)) {
        const advice = document.createElement("p"); advice.className = "personalisation-note";
        advice.textContent = "For a personal touch: compare Etsy and Not On The High Street designs. Check spelling, personalisation options and dispatch dates; custom items may have different cancellation rights.";
        body.append(advice);
      }
    }
  }
  new MutationObserver((mutations) => {
    const cards = new Set(mutations.map((mutation) => mutation.target.closest?.(".card")).filter(Boolean));
    for (const card of cards) {
      const idea = annotated.get(card);
      if (idea && !idea.inventoryId && mutations.some((mutation) => mutation.target.closest?.(".merchant-offer"))) comparison(card, idea);
    }
  }).observe($("#cards"), { childList: true, subtree: true });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.shop, a.product-image");
    if (!link) return;
    const card = link.closest(".card");
    const idea = annotated.get(card);
    const provider = link.dataset.provider;
    const merchant = provider && idea ? retailerLinks(idea, config).find((entry) => entry.merchantId === provider) : null;
    track(link.dataset.sponsored === "true" || card?.dataset.sponsored === "true" || idea?.sponsored ? "sponsored_click" : "affiliate_click", {
      merchantNetwork: link.dataset.network || merchant?.network || (link.dataset.provider === "amazon" ? "amazon" : "direct"),
      giftCategory: card?.dataset.category || link.dataset.category,
      recipientTag: card?.dataset.recipient || link.dataset.recipient,
    });
    if (idea) {
      try {
        const item = savedIdea(idea, card.dataset.recipient);
        recent = [...recent.filter((entry) => savedKey(entry) !== savedKey(item)), item].slice(-12);
        localStorage.setItem("ci-recent-ideas", JSON.stringify(recent));
      } catch (error) { console.warn("Recently viewed ideas could not be saved.", error); notify("Recently viewed ideas are available for this visit only."); }
      updateShelf();
    }
  });

  return {
    inventoryReady,
    resolve,
    linksFor,
    annotateCard,
    recipientTag: () => context.recipientTag,
    update: updateShelf,
    refreshStorage() {
      try { recent = normaliseSavedList(JSON.parse(localStorage.getItem("ci-recent-ideas") || "[]")).slice(-12); }
      catch (error) { console.warn("Recently viewed ideas could not be refreshed.", error); notify("Recently viewed history is unavailable on this browser."); }
      updateShelf();
    },
    copyList: () => share("copy"),
    decorateIdeas(ideas, { includeInventory = true } = {}) {
      shared = null; offers.clear(); selectedAddon = null; $("#gift-addons").hidden = true;
      if (new URLSearchParams(location.hash.slice(1)).has("list")) {
        const url = new URL(location.href); url.hash = ""; history.replaceState(null, "", url);
      }
      $("#shared-list-notice").hidden = true; $("#more").hidden = false;
      $("#results-title").textContent = "See what might suit them";
      scope.textContent = "Shares your saved list, not your description. Anyone with the link can read it; removing a local gift cannot revoke a shared copy.";
      const input = getInput() || {};
      context = queryContext(input, ideas);
      if (!includeInventory) return ideas.map((idea) => ({ ...idea, recipientTag: context.recipientTag }));
      const extras = matchingVerifiedGifts(verified, context, input, config, {
        experience: $("#include-experiences").checked, subscription: $("#include-subscriptions").checked,
      }).filter((gift, index, all) => !ideas.some((idea) => idea.title.toLowerCase() === gift.title.toLowerCase())
        && all.findIndex((other) => other.title.toLowerCase() === gift.title.toLowerCase()) === index);
      const result = [...ideas, ...extras].map((idea) => ({ ...idea, recipientTag: context.recipientTag }));
      const sponsor = matchingSponsor(sponsors, context, config);
      if (sponsor && !result.some((idea) => idea.title.toLowerCase() === sponsor.title.toLowerCase())) {
        result.splice(Math.min(1, result.length), 0, { ...sponsor, recipientTag: context.recipientTag });
      }
      return result;
    },
    async initialise() {
      const revision = ++initialisation;
      await inventoryReady;
      if (revision !== initialisation) return;
      $("#verified-preferences").hidden = config.ENABLE_VERIFIED_GIFTS !== true;
      updateShelf();
      try {
        const preset = finderPreset(location.hash);
        if (preset) {
          const radio = document.querySelector('input[name="mode"][value="describe"]');
          radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true }));
          $("#description").value = preset;
          $("#description").dispatchEvent(new Event("input", { bubbles: true }));
          notify("Gift-guide interests and budget filled in. Review them before searching.");
        }
      } catch (error) { console.warn("Finder preset rejected.", error); notify("This gift-guide preset is invalid. Enter your own interests and budget."); }
      const parameters = new URLSearchParams(location.hash.slice(1));
      if (!parameters.has("list")) {
        if (shared) {
          shared = null; $("#results").hidden = true; $("#shared-list-notice").hidden = true; $("#more").hidden = false;
        }
        return;
      }
      try {
        const decoded = await decodeWishlist(parameters.get("list"));
        if (revision !== initialisation) return;
        if (!decoded.length) throw new TypeError("This shared list is empty.");
        shared = decoded;
        renderShared(decoded.map(resolve));
        scope.textContent = "Shares this received list. Your separate saved list is shared only from its shortlist dialog. Anyone with a link can read or forward it.";
        $("#shared-list-notice").hidden = false;
        $("#save-shared-list").onclick = () => {
          const unique = new Map(getShortlist().map((item) => [savedKey(item), item]));
          for (const item of decoded) unique.set(savedKey(item), item);
          if (unique.size > 50) { notify("Your combined list exceeds 50 gifts. Remove some saved ideas first."); return; }
          const persistent = setShortlist([...unique.values()]);
          updateShelf(); notify(persistent ? "Shared ideas saved on this device only." : "Shared ideas saved for this visit only; browser storage is unavailable.");
        };
      } catch (error) {
        console.warn("Shared gift list could not be opened.", error);
        notify(`Couldn't open this shared list. ${error.message}`);
      }
    },
  };
}
