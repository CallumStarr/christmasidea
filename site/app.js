import { initialiseFinderControls } from "./finder-controls.js";

initialiseFinderControls();

if (document.documentElement.classList.contains("gift-app")) {
  const $ = (selector) => document.querySelector(selector);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $(".seasonal-hero").hidden = true;
  const stage = document.createElement("div");
  stage.className = "app-discovery";
  $(".atelier").before(stage);
  stage.append($(".atelier"));
  const art = document.createElement("img");
  art.className = "app-still-life";
  art.src = "/images/app-still-life.webp";
  art.alt = "";
  art.width = 1008; art.height = 820;
  art.fetchPriority = "high";
  stage.prepend(art);
  $("#finder-title").innerHTML = "Who are you<br><em>shopping for?</em>";
  $(".panel>.deck").textContent = "Add their interests and your budget.";
  $("#description").placeholder = "My dad loves coffee and the outdoors. Something thoughtful, around \u00a340.";
  $(".prompt-examples>p").textContent = "Try an example";
  $(".privacy").replaceChildren(
    document.createTextNode("No names or sensitive details. Your answers go to our AI provider. "),
    $(".privacy a"),
  );
  $(".privacy a").textContent = "Privacy";
  $("#dlg-title").textContent = "Your wishlists";
  document.querySelectorAll('link[rel=preload][as=image]').forEach((link) => link.remove());

  const nav = document.createElement("nav");
  nav.className = "app-tabbar";
  nav.setAttribute("aria-label", "App");
  nav.innerHTML = `
    <button type="button" aria-current="page" data-tab="finder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="9" width="16" height="12" rx="2"/><path d="M3 9h18M12 9v12M12 9C3 9 5 1 9 4l3 5Zm0 0c9 0 7-8 3-5l-3 5Z"/></svg><span>Discover</span></button>
    <button type="button" data-tab="saved"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4Z"/></svg><span>Wishlists <span id="app-saved-count">0</span></span></button>
    <button type="button" data-tab="about"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg><span>About</span></button>`;
  document.body.append(nav);
  nav.querySelector('[data-tab="finder"]').addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
    $("#form").focus({ preventScroll: true });
  });
  $(".masthead .brand").addEventListener("click", (event) => {
    event.preventDefault();
    nav.querySelector('[data-tab="finder"]').click();
  });
  function selectTab(name) {
    nav.querySelectorAll("button").forEach((button) => {
      if (button.dataset.tab === name) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }
  nav.querySelector('[data-tab="saved"]').addEventListener("click", () => {
    selectTab("saved"); $("#nav-shortlist").click();
  });
  nav.querySelector('[data-tab="about"]').addEventListener("click", () => {
    selectTab("about"); $("#deck-about-button").click();
  });
  for (const dialog of [$("#dlg"), $("#deck-about")]) {
    dialog.addEventListener("close", () => selectTab("finder"));
  }
  const syncCount = () => { $("#app-saved-count").textContent = $("#nav-count").textContent; };
  new MutationObserver(syncCount).observe($("#nav-count"), { childList: true, characterData: true, subtree: true });
  syncCount();
  const links = document.createElement("p");
  links.className = "app-settings-links";
  links.innerHTML = '<a href="/about">About &amp; contact</a><a href="/privacy">Privacy notice</a>';
  $(".deck-about-content").append(links);

  const viewport = window.visualViewport;
  function updateKeyboard() {
    const editing = document.activeElement?.matches("textarea,input:not([type=radio]):not([type=checkbox])");
    document.documentElement.classList.toggle("app-keyboard", Boolean(editing && viewport && innerHeight - viewport.height > 120));
  }
  viewport?.addEventListener("resize", updateKeyboard);
  document.addEventListener("focusin", updateKeyboard);
  document.addEventListener("focusout", () => requestAnimationFrame(updateKeyboard));

  const connection = document.createElement("p");
  connection.className = "app-connection";
  connection.setAttribute("role", "status"); connection.hidden = true;
  document.body.append(connection);
  function updateConnection() {
    connection.hidden = navigator.onLine;
    connection.textContent = "You're offline. Saved wishlists are still here. Reconnect to find new ideas.";
  }
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
  updateConnection();
  document.addEventListener("click", (event) => {
    if (event.target.closest(".swipe-actions button,.app-tabbar button,.chip,.checkbox-options label")) {
      void window.GIFT_NATIVE?.haptic();
    }
  });
}
