export function swipeDirection(dx, dy, width) {
  return Math.abs(dx) >= Math.max(70, Math.min(120, width * 0.22)) && Math.abs(dx) > Math.abs(dy) * 1.25
    ? dx > 0 ? "right" : "left" : null;
}

export function shouldPrefetch(remaining, { busy = false, paused = false, visible = true } = {}) {
  return remaining <= 3 && !busy && !paused && visible;
}

export function createSwipeDeck({ cards, toolbar, progress, onAdvance, onLike }) {
  let enabled = false, busy = false, reviewed = 0, dragging = null, departing = null, releaseTransform = null;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const details = new WeakMap();
  const available = () => [...cards.querySelectorAll(".card:not([hidden])")];
  const top = () => available()[0];
  const buttons = [...toolbar.querySelectorAll("button")];
  function prepare(card) {
    if (details.has(card)) return;
    const body = card.querySelector(".card-body"), title = body.querySelector("h3");
    const sponsorImage = body.querySelector(".sponsor-image");
    if (sponsorImage) {
      card.querySelector(".media").append(sponsorImage);
      card.querySelector(".image-note").textContent = "Partner-supplied creative, not an independently checked product photo.";
      card.classList.add("has-partner-image");
    }
    const dialog = document.createElement("dialog"); dialog.className = "gift-detail";
    dialog.setAttribute("aria-label", `About ${title.textContent}`);
    const header = document.createElement("div"); header.className = "detail-top";
    const label = document.createElement("span"); label.className = "eyebrow"; label.textContent = "A closer look";
    const close = document.createElement("button"); close.type = "button"; close.className = "detail-close";
    close.textContent = "\u00d7"; close.setAttribute("aria-label", "Back to the gift");
    close.addEventListener("click", () => dialog.close());
    header.append(label, close);
    const content = document.createElement("div"); content.className = "gift-detail-content";
    const heading = document.createElement("h2"); heading.textContent = title.textContent;
    content.append(heading);
    for (const element of [...body.children]) {
      if (element === title || element.classList.contains("sponsored-badge")) continue;
      content.append(element);
    }
    const save = content.querySelector(".save");
    if (save) {
      const text = document.createElement("span"); text.textContent = "Save to a wishlist"; save.append(text);
    }
    const attribution = document.createElement("p"); attribution.className = "detail-photo-note";
    const disclosure = document.createElement("p"); disclosure.className = "detail-disclosure";
    disclosure.textContent = "Ad \u00b7 We may earn a commission from shopping links, at no extra cost to you. Search links don't confirm stock or price. Check the seller, product details and delivery before buying.";
    content.append(attribution, disclosure);
    const footer = document.createElement("div"); footer.className = "detail-footer";
    const next = document.createElement("button"); next.type = "button"; next.className = "btn btn-primary deck-next";
    next.textContent = "Keep exploring";
    next.addEventListener("click", () => { dialog.close(); advance(card, "right"); });
    footer.append(next); dialog.append(header, content, footer);
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => {
      card.classList.remove("shopping-open");
      if (enabled && card === top() && card.isConnected && !departing) info.focus({ preventScroll: true });
    });
    const info = document.createElement("button"); info.type = "button"; info.className = "card-info";
    info.setAttribute("aria-label", `Details about ${title.textContent}`); info.title = "Why it might suit them";
    info.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7v1"/></svg>';
    info.addEventListener("click", () => openDetails(card));
    const stamp = document.createElement("span"); stamp.className = "swipe-stamp"; stamp.setAttribute("aria-hidden", "true");
    card.append(stamp, dialog); body.append(info);
    details.set(card, { dialog, attribution });
  }
  function openDetails(card, liked = false) {
    if (!enabled || departing || card !== top()) return;
    const { dialog, attribution } = details.get(card);
    if (dialog.open) return;
    attribution.textContent = card.querySelector(".image-note")?.textContent || "";
    if (liked) { card.classList.add("shopping-open"); onLike(card); }
    dialog.showModal();
  }
  function refresh() {
    if (!enabled) return;
    const remaining = available(), first = remaining[0];
    for (const [index, card] of remaining.entries()) {
      prepare(card);
      card.dataset.depth = Math.min(index, 3);
      card.inert = index !== 0;
      card.setAttribute("aria-hidden", String(index !== 0));
      card.classList.remove("featured", "companion", "solo", "reveal");
      const photo = card.querySelector(".product-image");
      if (photo) photo.tabIndex = -1;
      const image = photo?.querySelector("img");
      if (image) image.loading = index < 2 ? "eager" : "lazy";
    }
    for (const card of cards.querySelectorAll(".card[hidden]")) {
      card.inert = true; card.dataset.depth = 3; card.setAttribute("aria-hidden", "true");
      const dialog = details.get(card)?.dialog;
      if (dialog?.open) { dialog.close(); cards.focus({ preventScroll: true }); }
    }
    toolbar.hidden = false;
    buttons.forEach((button) => { button.disabled = !first || Boolean(departing); });
    progress.textContent = `${reviewed} explored · ${remaining.length} ready${busy ? " · Finding more ideas..." : ""}`;
    cards.classList.toggle("deck-empty", !first);
    cards.classList.toggle("deck-busy", busy);
    const emptyButton = cards.querySelector(".empty-selection button");
    if (emptyButton) {
      emptyButton.disabled = busy;
      emptyButton.textContent = busy ? "Finding more ideas..." : "Find more ideas";
    }
  }
  function advance(card = top(), direction = "left") {
    if (!card || card !== top() || departing) return;
    const dialog = details.get(card)?.dialog;
    if (dialog?.open) dialog.close();
    const toolbarFocused = toolbar.contains(document.activeElement);
    const focusTarget = toolbarFocused ? document.activeElement : toolbar.querySelector("button");
    const hadFocus = card.contains(document.activeElement) || toolbarFocused;
    departing = card;
    refresh();
    const finish = () => {
      if (departing !== card) return;
      departing = null;
      card.hidden = true;
      reviewed++;
      refresh();
      if (hadFocus && enabled) {
        const nextFocus = focusTarget && !focusTarget.disabled ? focusTarget : cards.querySelector(".empty-selection button") || cards;
        nextFocus.focus({ preventScroll: true });
      }
      onAdvance(available().length);
    };
    if (!enabled || reducedMotion || typeof card.animate !== "function") { finish(); return; }
    const distance = Math.max(innerWidth, card.getBoundingClientRect().width) * (direction === "right" ? 1 : -1);
    const start = releaseTransform || getComputedStyle(card).transform;
    releaseTransform = null;
    const end = direction === "save" ? "translateY(-28px) scale(.94)"
      : `translate(${distance}px, 36px) rotate(${direction === "right" ? 18 : -18}deg)`;
    const animation = card.animate([
      { transform: start, opacity: 1 },
      { transform: end, opacity: 0 },
    ], { duration: 280, easing: "cubic-bezier(.3,.65,.3,1)", fill: "forwards" });
    animation.finished.then(() => { finish(); animation.cancel(); }, () => finish());
  }
  function act(action) {
    const card = top();
    if (!enabled || departing || !card || details.get(card)?.dialog.open) return;
    if (action === "left") card.querySelector(".dismiss").click();
    else if (action === "save") card.querySelector(".save").click();
    else openDetails(card, true);
  }
  toolbar.querySelector('[data-swipe="left"]').addEventListener("click", () => act("left"));
  toolbar.querySelector('[data-swipe="save"]').addEventListener("click", () => act("save"));
  toolbar.querySelector('[data-swipe="right"]').addEventListener("click", () => act("right"));
  cards.addEventListener("keydown", (event) => {
    if (!enabled || event.target.closest("button,a,input,select,textarea") || event.altKey || event.ctrlKey || event.metaKey) return;
    const action = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "save" }[event.key];
    if (action) { event.preventDefault(); act(action); }
  });
  cards.addEventListener("pointerdown", (event) => {
    const card = top();
    if (!enabled || departing || !card || event.isPrimary === false || event.button !== 0
        || details.get(card)?.dialog.open || event.target.closest("button,a,input,select,summary,dialog")) return;
    dragging = { card, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
    cards.setPointerCapture(event.pointerId);
  });
  cards.addEventListener("pointermove", (event) => {
    if (!dragging || dragging.id !== event.pointerId) return;
    dragging.dx = event.clientX - dragging.x; dragging.dy = event.clientY - dragging.y;
    if (Math.abs(dragging.dx) < Math.abs(dragging.dy)) return;
    dragging.card.style.setProperty("--drag-x", `${dragging.dx}px`);
    dragging.card.style.setProperty("--drag-angle", `${dragging.dx / 22}deg`);
    dragging.card.style.setProperty("--swipe-opacity", Math.min(1, Math.abs(dragging.dx) / 100));
    dragging.card.dataset.direction = dragging.dx > 0 ? "right" : "left";
    dragging.card.querySelector(".swipe-stamp").textContent = dragging.dx > 0 ? "LIKE" : "PASS";
    dragging.card.classList.add("dragging");
  });
  function finish(event, cancelled = false) {
    if (!dragging || dragging.id !== event.pointerId) return;
    const { card, dx, dy } = dragging;
    dragging = null;
    const action = cancelled ? null : swipeDirection(dx, dy, card.getBoundingClientRect().width);
    if (action === "left" && !reducedMotion) releaseTransform = getComputedStyle(card).transform;
    card.style.removeProperty("--drag-x"); card.style.removeProperty("--drag-angle"); card.style.removeProperty("--swipe-opacity");
    card.classList.remove("dragging"); delete card.dataset.direction;
    if (cards.hasPointerCapture(event.pointerId)) cards.releasePointerCapture(event.pointerId);
    if (!cancelled) {
      if (action) act(action);
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) openDetails(card);
    }
  }
  cards.addEventListener("pointerup", (event) => finish(event));
  cards.addEventListener("pointercancel", (event) => finish(event, true));
  cards.addEventListener("lostpointercapture", (event) => finish(event, true));
  return {
    refresh, advance,
    setBusy(value) { busy = value; refresh(); },
    enable(value, reset = false) {
      enabled = value;
      if (!value || reset) {
        departing = null; dragging = null; releaseTransform = null;
        for (const card of cards.querySelectorAll(".card")) {
          const dialog = details.get(card)?.dialog;
          if (dialog?.open) dialog.close();
          card.getAnimations?.().forEach((animation) => animation.cancel());
        }
      }
      if (reset) reviewed = 0;
      cards.classList.toggle("swipe-cards", value);
      toolbar.hidden = progress.hidden = !value;
      cards.tabIndex = value ? 0 : -1;
      refresh();
    },
  };
}
