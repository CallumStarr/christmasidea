// Deterministic recipient understanding: turns the (already normalised) form input into
// the facts the validators need. It never calls a model and never guesses beyond what the
// shopper wrote. Where the text is ambiguous it returns "unknown" rather than inventing.

import { budgetCap, budgetLabel, LABELS, relationLabel } from "./constants.js";
import { DISLIKE_GROUPS } from "./rules.js";
import { VAGUE, contentStems, stem } from "./text.js";
import { constraintPhrases, parseTextAge } from "../site/recipient-language.js";

// "train sets" -> "sets" survives the pre-stem vague filter; owned items must be compared on the
// product word ("train") because idea titles drop the vague word ("Wooden train set" -> "train").
const VAGUE_STEMS = new Set([...VAGUE].map(stem));

export function bandForAge(years) {
  if (years === null || years === undefined) return "unknown";
  if (years < 1) return "baby";
  if (years < 4) return "toddler";
  if (years < 9) return "child";
  if (years < 13) return "tween";
  if (years < 18) return "teen";
  return "adult";
}

const GUIDED_AGE = { baby: 0, toddler: 2, child: 6, tween: 10, teen: 15, "20s": 25, "30s-40s": 40, "50s-60s": 60, "70-plus": 75 };

/** Text the model saw, used as the ground truth for "was this supplied by the shopper?". */
export function recipientCorpus(input) {
  if (input.mode === "describe") return input.description;
  return [
    `Buying for: ${relationLabel(input)}`,
    `Age: ${LABELS.age[input.age]}`,
    `Occasion: ${LABELS.occasion[input.occasion]}`,
    `Budget per gift: ${budgetLabel(input)}`,
    `What they're into: ${input.interests || "(not given)"}`,
    `More about them: ${input.about || "(not given)"}`,
  ].filter(Boolean).join(". ");
}

function parseAge(input, text) {
  if (input.mode !== "describe") {
    if (input.age in GUIDED_AGE) return GUIDED_AGE[input.age];
    if (input.relation === "child") return 6;
    if (input.relation === "teen") return 15;
  }
  return parseTextAge(text);
}

const HARD_BUDGET = /(?:under|up to|upto|max(?:imum)?|no more than|nothing (?:over|more than)|not (?:more(?: than)?|over)|within|at most|less than|below|capped at|limit(?: of)?)\s*$/;
const SOFT_BUDGET = /(?:around|about|approx(?:imately)?|roughly|circa|~)\s*$/;

function parseBudget(input, text) {
  if (input.mode !== "describe") {
    const max = budgetCap(input);
    return { max, soft: false, scope: "per_gift", source: "form" };
  }
  const lower = text.toLowerCase();
  const scope = /\b(each|per (?:gift|present|person|item)|every (?:gift|present))\b/.test(lower)
    ? "per_gift"
    : /\b(in total|altogether|overall|total budget|combined|for everything|between them|for all|all (?:the )?(?:gifts|presents))\b/.test(lower)
      ? "total"
      : "unspecified";
  const re = /(?:£\s?(\d+(?:\.\d+)?)(?:\s?(?:-|–|to)\s?£?\s?(\d+(?:\.\d+)?))?|(\d+(?:\.\d+)?)\s?(?:pounds|quid))(\s*(?:or more|plus|\+|and (?:over|above)))?/g;
  const found = [];
  let m;
  while ((m = re.exec(lower))) {
    const before = lower.slice(Math.max(0, m.index - 18), m.index);
    const low = Number(m[1] ?? m[3]);
    const high = m[2] ? Number(m[2]) : low;
    const hard = HARD_BUDGET.test(before);
    if (m[4] || /(?:not|no)\s+(?:less than|under|below)\s*$/.test(before)
      || (!hard && /(?:over|above|at least|more than|from|minimum)\s*$/.test(before))) continue;
    found.push({ value: Math.max(low, high), hard, soft: SOFT_BUDGET.test(before) });
  }
  if (!found.length) return { max: null, soft: false, scope, source: "none" };
  const hard = found.filter((f) => f.hard);
  const pick = hard.length ? hard.reduce((a, b) => (b.value < a.value ? b : a)) : found[0];
  return { max: pick.value, soft: !pick.hard, scope, source: "text" };
}

/** Pulls explicit dislikes/exclusions and things the recipient already owns out of the shopper's text. */
export function extractConstraints(text) {
  const { avoid, owned } = constraintPhrases(text);
  const build = (phrases, kind) => {
    const seen = new Set();
    const out = [];
    for (const phrase of phrases) {
      const key = phrase.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const stems = new Set(contentStems(phrase).filter((s) => kind !== "owned" || !VAGUE_STEMS.has(s)));
      const groups = kind === "avoid" ? DISLIKE_GROUPS.filter((g) => g.trigger.test(phrase)) : [];
      if (!stems.size && !groups.length) continue;
      out.push({ phrase, stems, head: [...stems].pop() || "", groups, kind });
    }
    return out;
  };
  return { avoid: build(avoid, "avoid"), owned: build(owned, "owned") };
}

export function deriveRecipient(input) {
  const text = recipientCorpus(input);
  const constraintText = input.mode === "describe" ? input.description : [input.interests, input.about].filter(Boolean).join(". ");
  const ageYears = parseAge(input, input.mode === "describe" ? input.description : "");
  const { avoid, owned } = extractConstraints(constraintText);
  return {
    text,
    textStems: new Set(contentStems(text, { keepVague: true }).map((s) => s)),
    ageYears,
    ageBand: bandForAge(ageYears),
    isMinor: ageYears !== null && ageYears < 18,
    wantsNoSmallParts: /\b(?:tiny|small|loose)\s+(?:loose\s+)?(?:pieces|parts|bits)\b|\bchok(?:e|ing)\b/i.test(text),
    budget: parseBudget(input, input.mode === "describe" ? input.description : ""),
    avoid,
    owned,
  };
}

export { stem };
