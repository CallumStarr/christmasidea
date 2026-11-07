import { readWishlists } from "./wishlists.js";

const countdown = document.querySelector("#countdown");
if (countdown) {
  const now = new Date();
  const year = now.getFullYear() + (now.getMonth() === 11 && now.getDate() > 25 ? 1 : 0);
  const days = Math.round((Date.UTC(year, 11, 25) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const long = document.createElement("span");
  long.className = "long";
  long.textContent = days === 0 ? "It's Christmas Day!" : `${days} ${days === 1 ? "day" : "days"} until Christmas`;
  const short = document.createElement("span");
  short.className = "short";
  short.textContent = days === 0 ? "Merry Christmas!" : `${days} ${days === 1 ? "day" : "days"} to go`;
  countdown.replaceChildren(long, short);
  countdown.hidden = false;
}

const shortlistLink = document.querySelector("a#nav-shortlist");
if (shortlistLink) {
  // The visible "Wishlists" text, count and a visually hidden suffix give the accessible name (WCAG 2.5.3).
  const countLabel = document.querySelector("#nav-count-label");
  try {
    let collection, notice = "";
    try { collection = readWishlists(localStorage); }
    catch (error) {
      if (!error.recovered) throw error;
      collection = error.recovered; notice = `. ${error.message}`;
      shortlistLink.title = error.message;
    }
    const count = collection.lists.reduce((sum, list) => sum + list.items.length, 0);
    document.querySelector("#nav-count").textContent = count;
    if (countLabel) countLabel.textContent = ` saved ${count === 1 ? "idea" : "ideas"}${notice}`;
  } catch (error) {
    console.warn("Shortlist count could not be read.");
    document.querySelector("#nav-count").hidden = true;
    if (countLabel) countLabel.textContent = "";
  }
}
