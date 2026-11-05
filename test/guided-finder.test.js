import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { INTEREST_GROUPS, ABOUT_GROUPS, selectedValues } from "../site/guided-options.js";
import { normaliseInput, buildUserMessage, curateIdeas } from "../src/core.js";
import { buildUserMessage as baselineMessage } from "../src/prompts/gift-curator-v3.3.js";
import { deriveRecipient, recipientCorpus } from "../src/recipient.js";

const guided = (extra = {}) => normaliseInput({ mode: "guided", interests: "Gardening", ...extra });

test("guided mode frames the survey at the top and restores describe mode without clearing answers", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const source = html.match(/function setMode\(mode\)\{[\s\S]*?\n\}/)[0];
  for (const reduceMotion of [false, true]) {
    const fields = {
      "#quick-fields": { hidden: false },
      "#guided-fields": { hidden: true, scrollTop: 120 },
      ".seasonal-hero": { hidden: false },
    };
    const classes = new Set();
    const scrolls = [];
    const setMode = runInNewContext(`(${source})`, {
      $: (selector) => fields[selector],
      document: { body: { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } } },
      window: { scrollTo: (options) => scrolls.push(options) },
      reduceMotion,
    });
    setMode("guided");
    assert.equal(fields["#guided-fields"].hidden, false);
    assert.equal(fields["#quick-fields"].hidden, true);
    assert.equal(fields[".seasonal-hero"].hidden, true);
    assert.equal(classes.has("guided-mode"), true);
    assert.equal(fields["#guided-fields"].scrollTop, 0);
    assert.equal(scrolls[0].top, 0);
    assert.equal(scrolls[0].behavior, reduceMotion ? "instant" : "smooth");
    setMode("describe");
    assert.equal(fields["#guided-fields"].hidden, true);
    assert.equal(fields["#quick-fields"].hidden, false);
    assert.equal(fields[".seasonal-hero"].hidden, false);
    assert.equal(classes.has("guided-mode"), false);
    assert.equal(scrolls.length, 1);
  }
  assert.equal((html.match(/<details class="guided-picker">/g) || []).length, 2);
  assert.match(html, /querySelectorAll\("\.choice-category, \.guided-picker"\)/);
});

test("guided budget controls appear on demand and collapsed pickers keep selection counts", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const source = html.match(/function updateGuidedFields\(\)\{[\s\S]*?\n\}/)[0];
  const fields = Object.fromEntries([
    "relation-other-field", "relation-other", "budget-slider", "budget-amount", "budget-any",
    "budget-controls", "budget-hint", "interests", "about", "interests-selected",
    "about-selected", "interests-count", "about-count",
  ].map((id) => [`#${id}`, {}]));
  fields["#budget-any"].checked = true;
  let other = false;
  let count = 2;
  const update = runInNewContext(`(${source})`, {
    $: (selector) => fields[selector],
    document: { querySelector: () => other },
    selectedValues: () => Array(count).fill("selected"),
    updateCheckboxSummary: () => {},
  });
  update();
  assert.equal(fields["#budget-controls"].hidden, true);
  assert.equal(fields["#budget-hint"].hidden, true);
  assert.equal(fields["#budget-amount"].disabled, true);
  assert.equal(fields["#interests-count"].textContent, "2 selected");
  fields["#budget-any"].checked = false;
  other = true;
  count = 0;
  update();
  assert.equal(fields["#budget-controls"].hidden, false);
  assert.equal(fields["#budget-hint"].hidden, false);
  assert.equal(fields["#budget-amount"].disabled, false);
  assert.equal(fields["#relation-other"].disabled, false);
  assert.equal(fields["#about-count"].textContent, "");
});

test("checkbox categories offer broad, unique choices and every selection survives API normalisation", () => {
  const interests = INTEREST_GROUPS.flatMap(([, options]) => options);
  const about = ABOUT_GROUPS.flatMap(([, options]) => options);
  assert.ok(INTEREST_GROUPS.length >= 12);
  assert.ok(interests.length >= 150);
  assert.ok(about.length >= 40);
  for (const groups of [INTEREST_GROUPS, ABOUT_GROUPS]) {
    for (const [, options] of groups) assert.ok(options.length <= 20);
    const values = groups.flatMap(([, options]) => options);
    assert.equal(new Set(values).size, values.length);
  }
  const parsed = guided({ interests: interests.join("; "), about: about.join(". ") });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.interests, interests.join("; "));
  assert.equal(parsed.value.about, about.join(". "));
});

test("exact guided budgets and custom relationships reach both prompts and recipient ground truth", () => {
  const input = guided({ relation: "other", relationOther: "my aunt", budgetMaxGbp: 37 }).value;
  for (const message of [buildUserMessage(input), baselineMessage(input), recipientCorpus(input)]) {
    assert.match(message, /Buying for: my aunt/);
    assert.match(message, /Budget per gift: up to £37/);
  }
  assert.deepEqual(deriveRecipient(input).budget, { max: 37, soft: false, scope: "per_gift", source: "form" });
  assert.equal(guided({ relation: "dad", relationOther: "my aunt" }).value.relationOther, undefined);
  assert.equal(guided({ relationOther: "x".repeat(100) }).value.relationOther.length, 80);
});

test("guided budget validation rejects invalid amounts rather than silently removing the cap", () => {
  for (const budgetMaxGbp of [0, -1, 1001, 37.5, NaN, Infinity, null, "37"]) {
    const result = guided({ budgetMaxGbp });
    assert.equal(result.ok, false, String(budgetMaxGbp));
    assert.match(result.error, /whole-pound budget/);
  }
  for (const budgetMaxGbp of [1, 37, 1000]) assert.equal(guided({ budgetMaxGbp }).ok, true);
  assert.equal(deriveRecipient(guided().value).budget.max, null);
  assert.equal(deriveRecipient(guided({ budget: "30-50" }).value).budget.max, 50);
  const freeform = normaliseInput({ mode: "describe", description: "Gardening, up to £20.", budgetMaxGbp: 1000, relationOther: "aunt" }).value;
  assert.equal(freeform.budgetMaxGbp, undefined);
  assert.equal(freeform.relationOther, undefined);
  assert.equal(deriveRecipient(freeform).budget.max, 20);
});

test("exact cap rejects over-budget estimates and reaches retailer product specifications", () => {
  const input = guided({ budgetMaxGbp: 37 }).value;
  const idea = (price) => ({
    title: "Pruning shears", concept: "Pruning shears", search_query: "pruning shears",
    why: "A useful tool for gardening.", category: "Outdoors & sport",
    angle: "practical-upgrade", estimated_max_price_gbp: price,
  });
  assert.equal(curateIdeas({ ideas: [idea(38)] }, input).ideas.length, 0);
  const result = curateIdeas({ ideas: [idea(37)] }, input);
  assert.equal(result.ideas.length, 1);
  assert.equal(result.ideas[0].productSpec.budgetMaxGbp, 37);
});

test("about checkboxes preserve explicit owned items and exclusions", () => {
  const input = guided({ about: "They already own plenty of mugs. Avoid alcohol. Avoid candles" }).value;
  const recipient = deriveRecipient(input);
  assert.ok(recipient.owned.some((item) => /mug/i.test(item.phrase)));
  assert.ok(recipient.avoid.some((item) => /alcohol/i.test(item.phrase)));
  assert.ok(recipient.avoid.some((item) => /candle/i.test(item.phrase)));
});

test("guided form serialises checkboxes only, leaves hidden values out, and preserves describe mode", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const source = html.match(/function readForm\(\)\{[\s\S]*?\n\}/)[0];
  const values = {
    "#description": { value: "My dad likes coffee." },
    "#budget-any": { checked: false },
    "#budget-amount": { valueAsNumber: 37 },
    "#relation-other": { value: "my aunt" },
    "#age": { value: "30s-40s" },
    "#occasion": { value: "christmas" },
    "#interests": { querySelectorAll: () => [{ value: "Gardening" }, { value: "Tea" }] },
    "#about": { querySelectorAll: () => [{ value: "Avoid alcohol" }] },
  };
  let mode = "guided", relation = "other";
  values["#form"] = {
    querySelector: (selector) => {
      if (selector.includes('name="mode"')) return { value: mode };
      if (selector.includes('value="other"')) return relation === "other" ? { value: relation } : null;
      return { value: relation };
    },
  };
  const readForm = runInNewContext(`(${source})`, { $: (selector) => values[selector], selectedValues });
  let form = readForm();
  assert.equal(form.interests, "Gardening; Tea");
  assert.equal(form.about, "Avoid alcohol");
  assert.equal(form.budgetMaxGbp, 37);
  assert.equal(form.relationOther, "my aunt");
  relation = "dad"; values["#budget-any"].checked = true;
  form = readForm();
  assert.equal(form.relationOther, undefined);
  assert.equal(form.budgetMaxGbp, undefined);
  mode = "describe";
  form = readForm();
  assert.equal(form.description, "My dad likes coffee.");
  assert.equal(form.interests, "");
  assert.equal(form.budgetMaxGbp, undefined);
  assert.doesNotMatch(html, /<textarea[^>]*id="about"|<input[^>]*type="text"[^>]*id="interests"/);
});
