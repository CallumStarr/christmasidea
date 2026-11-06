import { openPartnerModal } from "./partner-modal.js";
import { trackMonetizationEvent } from "./monetization-telemetry.js";
import { MONETIZATION_CONFIG } from "./monetization-config.js";
import { readLocalGiftList, savedIdea, savedKey } from "./monetization-data.js";
import { WISHLISTS_KEY, readWishlists, writeWishlists, activeWishlist } from "./wishlists.js";

let visitList = [];
let wishlists;
let persistent = true;
function readSaved() {
  if (!persistent) return visitList;
  try { wishlists = readWishlists(localStorage); visitList = activeWishlist(wishlists).items; return visitList; }
  catch (error) { console.warn("Guide shortlist storage could not be read.", error); persistent = false; return visitList; }
}

function syncGuideSaves() {
  const saved = readSaved();
  const count = document.querySelector("#nav-count");
  const nav = document.querySelector("a#nav-shortlist");
  if (count && nav) {
    const total = wishlists ? wishlists.lists.reduce((sum, list) => sum + list.items.length, 0) : saved.length;
    count.textContent = total;
    nav.setAttribute("aria-label", `Open your wishlists, ${total} saved ${total === 1 ? "idea" : "ideas"}`);
  }
  for (const button of document.querySelectorAll("[data-guide-save]")) {
    const on = saved.some((item) => savedKey(item) === button.dataset.guideSave);
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "Saved idea" : "Save idea";
  }
}

for (const article of document.querySelectorAll(".idea")) {
  const link = article.querySelector(".merchant-links a");
  if (!link?.dataset.query) continue;
  const item = savedIdea({ title: article.querySelector("h3").textContent, query: link.dataset.query,
    why: article.querySelector(".idea-why").textContent, category: link.dataset.category, recipientTag: link.dataset.recipient });
  const button = document.createElement("button"); button.type = "button"; button.className = "guide-save";
  button.dataset.guideSave = savedKey(item);
  button.setAttribute("aria-label", `Save or remove ${item.title} from your shortlist`);
  const status = document.createElement("p"); status.className = "source"; status.setAttribute("role", "status");
  button.addEventListener("click", () => {
    const saved = readSaved(), key = savedKey(item);
    if (!saved.some((gift) => savedKey(gift) === key) && saved.length >= 50) {
      status.textContent = "This wishlist has 50 gifts. Open your wishlists to choose another list or remove a gift.";
      return;
    }
    visitList = saved.some((gift) => savedKey(gift) === key)
      ? saved.filter((gift) => savedKey(gift) !== key) : [...saved, item];
    try {
      if (!wishlists) throw new Error("Wishlist storage is unavailable.");
      activeWishlist(wishlists).items = visitList;
      writeWishlists(localStorage, wishlists); persistent = true;
    }
    catch (error) { console.warn("Guide shortlist storage could not be updated.", error); persistent = false; }
    syncGuideSaves();
    status.textContent = persistent ? `${activeWishlist(wishlists).name} updated on this device only.` : "Shortlist updated for this visit only; browser storage is unavailable.";
  });
  article.append(button, status);
}
syncGuideSaves();
window.addEventListener("storage", (event) => {
  if (event.key === WISHLISTS_KEY || event.key === null) { persistent = true; syncGuideSaves(); }
});

document.addEventListener("click", (event) => {
  const partner = event.target.closest("[data-partner]");
  if (partner) openPartnerModal(partner);
  const link = event.target.closest(".idea .merchant-links a");
  if (link) {
    trackMonetizationEvent("affiliate_click", {
      merchantNetwork: link.dataset.network,
      giftCategory: link.dataset.category,
      recipientTag: link.dataset.recipient,
    }, MONETIZATION_CONFIG);
    try {
      const item = savedIdea({ title: link.closest(".idea").querySelector("h3").textContent, query: link.dataset.query,
        category: link.dataset.category, recipientTag: link.dataset.recipient });
      const recent = readLocalGiftList(JSON.parse(localStorage.getItem("ci-recent-ideas") || "[]"));
      localStorage.setItem("ci-recent-ideas", JSON.stringify([...recent.filter((gift) => savedKey(gift) !== savedKey(item)), item].slice(-12)));
    } catch (error) {
      console.warn("Recently viewed guide ideas could not be saved.", error);
      const status = link.closest(".idea").querySelector('[role="status"]');
      if (status) status.textContent = "Recently viewed history is unavailable; the shopping link still works.";
    }
  }
});
