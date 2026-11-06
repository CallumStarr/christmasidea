export function initialiseFinderControls() {
  const $ = (selector) => document.querySelector(selector);
  document.documentElement.classList.add("gift-controls");
  $(".mode-option input[value=guided]+.mode-copy .mode-title").textContent = "A few questions";
  $("#interests-hint").textContent = "Choose what they enjoy. Search or open a category.";
  $("#about-hint").textContent = "What suits them, what they own, or what to avoid. This step is optional.";
  const fields = $("#guided-fields");
  const children = [...fields.children].slice(1);
  const steps = [children.slice(0, 4), children.slice(4, 5), children.slice(5)];
  const titles = ["Start with the little details", "What lights them up?", "Make it a little more personal"];
  const wizard = document.createElement("div");
  wizard.className = "app-wizard";
  wizard.innerHTML = '<div class="app-step-top"><button type="button" id="app-step-back" aria-label="Previous question">Back</button><span id="app-step-label" role="status"></span></div><div class="app-step-track" aria-hidden="true"><span></span></div><h3 id="app-step-title" tabindex="-1"></h3>';
  fields.before(wizard);
  const relation = document.createElement("select");
  relation.id = "app-relation";
  const relationLabel = document.createElement("label");
  relationLabel.className = "sr-only";
  relationLabel.htmlFor = relation.id;
  relationLabel.textContent = "Who are you buying for?";
  relation.append(new Option("Choose a person (optional)", "", true, true));
  for (const radio of $("#relation").querySelectorAll("input")) {
    relation.append(new Option(radio.nextElementSibling.textContent, radio.value));
    if (radio.checked) relation.value = radio.value;
    radio.addEventListener("change", () => { if (radio.checked) relation.value = radio.value; });
  }
  $("#relation").before(relationLabel, relation);
  relation.addEventListener("change", () => {
    for (const radio of $("#relation").querySelectorAll("input")) {
      radio.checked = radio.value === relation.value;
      if (radio.checked) radio.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!relation.value) fields.dispatchEvent(new Event("change", { bubbles: true }));
  });
  let step = 0;
  const guided = () => document.querySelector('input[name="mode"]:checked').value === "guided";
  function showStep(next, focus = false) {
    step = next;
    wizard.hidden = !guided();
    steps.forEach((elements, index) => elements.forEach((element) => { element.hidden = guided() && index !== step; }));
    $("#app-step-back").disabled = step === 0;
    $("#app-step-label").textContent = `Step ${step + 1} of 3`;
    $("#app-step-title").textContent = titles[step];
    wizard.style.setProperty("--step-progress", `${(step + 1) / 3 * 100}%`);
    $("#go>span:first-child").textContent = guided() && step < 2 ? "Continue" : "Find gift ideas";
    if (focus) {
      fields.scrollTop = 0;
      $("#app-step-title").focus({ preventScroll: true });
    }
  }
  $("#app-step-back").addEventListener("click", () => showStep(Math.max(0, step - 1), true));
  document.querySelectorAll('input[name="mode"]').forEach((radio) => radio.addEventListener("change", () => showStep(step)));
  new MutationObserver(() => showStep(step)).observe(fields, { attributes: true, attributeFilter: ["hidden"] });
  $("#form").addEventListener("reset", () => requestAnimationFrame(() => showStep(0)));
  $("#form").addEventListener("submit", (event) => {
    if (!guided() || step === 2) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (step === 0 && !$("#budget-any").checked && !$("#budget-amount").validity.valid) {
      $("#budget-amount").setAttribute("aria-invalid", "true");
      $("#budget-amount").reportValidity(); $("#budget-amount").focus();
      return;
    }
    if (step === 1 && !fields.querySelector('input[name="interests"]:checked') && !fields.querySelector('input[name="about"]:checked')) {
      $("#interests").setAttribute("aria-invalid", "true");
      $("#interests-selected").textContent = "Choose at least one interest so we can make it thoughtful.";
      $("#app-search-interests").value = "";
      $("#app-search-interests").dispatchEvent(new Event("input"));
      const options = $("#interests .checkbox-options");
      options.hidden = false;
      options.closest(".choice-category").querySelector("button").setAttribute("aria-expanded", "true");
      $("#interests").querySelector("input").focus();
      return;
    }
    showStep(step + 1, true);
  }, true);
  for (const group of document.querySelectorAll(".choice-category")) {
    const list = group.querySelector(".checkbox-options");
    const label = group.querySelector("legend");
    const toggle = document.createElement("button");
    toggle.type = "button"; toggle.className = "app-category-toggle";
    const id = `app-options-${document.querySelectorAll(".app-category-toggle").length}`;
    list.id = id;
    toggle.setAttribute("aria-controls", id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.append(...label.childNodes);
    label.append(toggle); list.hidden = true;
    toggle.addEventListener("click", () => {
      list.hidden = !list.hidden;
      toggle.setAttribute("aria-expanded", String(!list.hidden));
    });
  }
  for (const name of ["interests", "about"]) {
    const root = $(`#${name}`);
    const search = document.createElement("input");
    search.type = "search"; search.id = `app-search-${name}`;
    search.className = "app-choice-search";
    search.placeholder = name === "interests" ? "Search interests" : "Search preferences";
    search.autocomplete = "off";
    const label = document.createElement("label");
    label.className = "sr-only"; label.htmlFor = search.id; label.textContent = search.placeholder;
    root.before(label, search);
    const empty = document.createElement("p");
    empty.className = "hint"; empty.hidden = true; empty.setAttribute("role", "status");
    empty.textContent = "No matches. Try another word or browse the categories.";
    root.after(empty);
    let expanded = [];
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase("en-GB");
      if (query && !expanded.length) {
        expanded = [...root.querySelectorAll(".app-category-toggle")].map((button) => button.getAttribute("aria-expanded") === "true");
      }
      let matches = 0;
      [...root.children].forEach((group, index) => {
        const categoryMatch = group.querySelector(".app-category-toggle>span").textContent.toLocaleLowerCase("en-GB").includes(query);
        const options = group.querySelector(".checkbox-options");
        let visible = 0;
        options.querySelectorAll("label").forEach((option) => {
          option.hidden = Boolean(query && !categoryMatch && !option.textContent.toLocaleLowerCase("en-GB").includes(query));
          if (!option.hidden) visible++;
        });
        group.hidden = visible === 0;
        matches += visible;
        options.hidden = query ? false : !expanded[index];
        group.querySelector("button").setAttribute("aria-expanded", String(!options.hidden));
      });
      empty.hidden = matches > 0;
      if (!query) expanded = [];
    });
    $("#form").addEventListener("reset", () => requestAnimationFrame(() => search.dispatchEvent(new Event("input"))));
    fields.addEventListener("change", () => {
      const selected = [...root.querySelectorAll("input:checked")].map((input) => input.value);
      if (selected.length) {
        $(`#${name}-selected`).textContent = selected.slice(0, 3).join(", ") + (selected.length > 3 ? ` +${selected.length - 3} more` : "");
      }
    });
  }
  showStep(0);
  const loading = $("#loading");
  loading.setAttribute("role", "region");
  loading.setAttribute("aria-labelledby", "loading-text");
  new MutationObserver(() => {
    if (!loading.hidden) $("#cancel").focus({ preventScroll: true });
  }).observe(loading, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("keydown", (event) => {
    if (loading.hidden || $("#ts").classList.contains("turnstile-interactive") || $("#ts").contains(document.activeElement)) return;
    if (event.key === "Escape") { event.preventDefault(); $("#cancel").click(); }
    if (event.key === "Tab") { event.preventDefault(); $("#cancel").focus({ preventScroll: true }); }
  });
}
