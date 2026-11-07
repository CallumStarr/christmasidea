import test from "node:test";
import assert from "node:assert/strict";
import { NEW_GUIDES } from "../scripts/new-gift-guides.mjs";
import { ALWAYS_BLOCKED, BABY_BLOCKED, MINOR_BLOCKED, SMALL_PARTS } from "../src/rules.js";
import { curateIdeas } from "../src/validate.js";
import { deriveRecipient } from "../src/recipient.js";
import { normaliseInput } from "../src/core.js";

// Limited to the six Black Friday 2026 guides: an existing guide (gifts-for-dad, "Whisky tasting glasses")
// matches ALWAYS_BLOCKED, and existing guides were left unchanged.
const SLUGS = ["gifts-for-teenagers", "gifts-for-grandparents", "gifts-for-colleagues", "secret-santa-gifts-under-20", "gifts-for-partner", "gifts-for-someone-who-has-everything"];
const hits = (rules, text) => rules.filter(([, re]) => re.test(text)).map(([code]) => code);

test("the six new guides are present with eight ideas and a stated budget", () => {
  assert.deepEqual(NEW_GUIDES.map((g) => g.slug), SLUGS);
  for (const g of NEW_GUIDES) {
    assert.equal(g.ideas.length, 8, g.slug);
    assert.ok(Number.isInteger(g.budget) && g.budget > 0, g.slug);
    assert.equal(g.rules.budgetMaxGbp, g.budget, `${g.slug}: finder input uses the guide budget`);
    assert.ok(g.desc.includes(`£${g.budget}`), `${g.slug}: description states the budget`);
    assert.ok(g.intro.includes(`£${g.budget}`), `${g.slug}: intro states the budget`);
  }
});

for (const g of NEW_GUIDES) {
  test(`${g.slug}: every idea passes the AI idea rules for its recipient`, () => {
    const parsed = normaliseInput(g.rules);
    assert.ok(parsed.ok, `${g.slug}: rules input must normalise`);
    const ctx = deriveRecipient(parsed.value);
    if (g.slug === "gifts-for-teenagers") assert.equal(ctx.isMinor, true, "teenagers are minors");
    const smallPartsAge = ctx.ageYears !== null && (ctx.ageYears < 5 || (ctx.wantsNoSmallParts && ctx.ageYears < 9));
    for (const [title, why, query, note, estMax] of g.ideas) {
      const label = `${title} ${title} ${query}`;
      const copy = `${label} ${why} ${note}`;
      assert.deepEqual(hits(ALWAYS_BLOCKED, copy), [], `${g.slug} / ${title}: ALWAYS_BLOCKED`);
      if (ctx.isMinor) assert.deepEqual(hits(MINOR_BLOCKED, copy), [], `${g.slug} / ${title}: MINOR_BLOCKED`);
      if (ctx.ageBand === "baby") assert.deepEqual(hits(BABY_BLOCKED, label), [], `${g.slug} / ${title}: BABY_BLOCKED`);
      if (smallPartsAge) assert.deepEqual(hits(SMALL_PARTS, label), [], `${g.slug} / ${title}: SMALL_PARTS`);
      assert.ok(Number.isFinite(estMax) && estMax > 0 && estMax <= g.budget, `${g.slug} / ${title}: within £${g.budget}`);
      assert.doesNotMatch(copy, /[\u2013\u2014]/, `${g.slug} / ${title}: hyphens only`);
    }
    assert.doesNotMatch(`${g.h1} ${g.desc} ${g.intro} ${g.tips.join(" ")} ${g.edit.title} ${g.edit.label} ${g.edit.description}`, /[\u2013\u2014]/, `${g.slug}: hyphens only`);
  });

  test(`${g.slug}: every idea survives curateIdeas for a matching recipient`, () => {
    const raw = {
      ideas: g.ideas.map(([title, why, query, , estMax]) => ({
        title, why, search_query: query, concept: title, estimated_max_price_gbp: estMax,
      })),
    };
    const result = curateIdeas(raw, normaliseInput(g.rules).value);
    assert.deepEqual(result.diagnostics.rejected, [], `${g.slug}: no idea may be rejected`);
    assert.deepEqual(result.ideas.map((i) => i.title), g.ideas.map(([title]) => title), g.slug);
  });
}
