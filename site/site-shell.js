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
  try {
    const saved = JSON.parse(localStorage.getItem("ci-shortlist") || "[]");
    if (!Array.isArray(saved)) throw new TypeError("Invalid shortlist format");
    const count = saved.filter((item) => item && typeof item.title === "string" && typeof item.query === "string").slice(0, 50).length;
    document.querySelector("#nav-count").textContent = count;
    shortlistLink.setAttribute("aria-label", `Open your shortlist, ${count} saved ${count === 1 ? "idea" : "ideas"}`);
  } catch (error) {
    console.warn("Shortlist count could not be read.", error);
    document.querySelector("#nav-count").hidden = true;
    shortlistLink.setAttribute("aria-label", "Open your shortlist");
  }
}
