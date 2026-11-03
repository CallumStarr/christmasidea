// Server-side curation of model output. The model's response is untrusted: every idea is
// checked, repaired only where the repair removes information (never adds any), or rejected.
// The model is asked for a few spare candidates so a rejected idea can be replaced by the
// next-best valid one rather than leaving the visitor with a short list.

import { ANGLES, CATEGORIES } from "./constants.js";
import { deriveRecipient } from "./recipient.js";
import {
  AGE_RATING_CLAIM, ALWAYS_BLOCKED, BABY_BLOCKED, INJECTION_ECHO, MINOR_BLOCKED, PREFERENCE_TOPICS,
  PREFERENCE_VERB, PRICE_OR_STOCK_CLAIM, QUERY_ACRONYMS, QUERY_FOR_PHRASE, QUERY_NOISE, SAFETY_CLAIM,
  SMALL_PARTS, SPECIALIST, SUPERVISION,
} from "./rules.js";
import { cleanText, contentStems, jaccard, sentences, stem, stemSet, words } from "./text.js";

export const VALIDATOR_VERSION = "validator-v2";
export const MAX_IDEAS = 8;

const QUERY_ALLOWED = /[^\p{L}\p{N} '&-]/gu;
const NON_EDIBLE_FOOD = /\bfood (?:wraps?|storage|containers?|prep|boxes?|jars?|savers?|covers?|processors?|scales?|thermometers?|mats?|tins?|bags?)\b/gi;
const UPGRADE_WORDS = /\b(upgrade|replacement|refill|spare|top-?up)\b/i;
const NEGATED_SERVICE = /\b(?:subscriptions?|memberships?)\s+(?:alternative|free)\b|\b(?:no|non|without|instead of|alternative to)[- ](?:a |an )?(?:subscriptions?|memberships?)\b/gi;
const GENERIC_LABEL = new Set(["gift", "set", "kit", "pack", "box", "mini", "travel", "small", "pair", "collection", "tin", "bundle"].map(stem));
const THRESHOLDS = { duplicateConcept: 0.6, duplicateQuery: 0.75, maxPerCategory: 4, maxPerAngle: 3, maxPerProductType: 2 };

/* ---------- structural normalisation (shared with the legacy sanitiser) ---------- */

function toQuery(value) {
  return cleanText(String(value || "").replace(QUERY_ALLOWED, " "), 60);
}

export function normaliseCandidates(raw) {
  const list = raw && Array.isArray(raw.ideas) ? raw.ideas : [];
  const out = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const title = cleanText(item.title, 60);
    const why = cleanText(item.why, 260);
    const rawQuery = toQuery(item.search_query);
    if (!title || !why || rawQuery.length < 3) return;
    if (/https?:|www\./i.test(title + why)) return;
    const est = Number(item.estimated_max_price_gbp);
    out.push({
      index,
      title,
      why,
      rawQuery,
      photo: cleanText(String(item.photo_query || "").replace(QUERY_ALLOWED, " "), 40) || title,
      category: CATEGORIES.find((c) => c.toLowerCase() === String(item.category || "").trim().toLowerCase()) || "Home",
      concept: cleanText(item.concept, 60),
      angle: ANGLES.find((a) => a.toLowerCase() === String(item.angle || "").trim().toLowerCase()) || "",
      basedOn: cleanText(item.based_on, 100),
      estMax: Number.isFinite(est) && est > 0 ? est : null,
    });
  });
  return out;
}

function summaryOf(raw) {
  return raw && typeof raw.recipient_summary === "string" ? cleanText(raw.recipient_summary, 180) : "";
}
function noteOf(raw) {
  return raw && typeof raw.note === "string" ? cleanText(raw.note, 200) : "";
}

/** Legacy structural sanitiser: duplicates and markup only. Used when no recipient context exists. */
export function sanitiseIdeas(raw, exclude = []) {
  const seen = new Set(exclude.map((t) => t.toLowerCase()));
  const seenQueries = new Set();
  const ideas = [];
  for (const c of normaliseCandidates(raw)) {
    const key = c.title.toLowerCase();
    const queryKey = c.rawQuery.toLowerCase();
    if (seen.has(key) || seenQueries.has(queryKey)) continue;
    seen.add(key);
    seenQueries.add(queryKey);
    ideas.push({ title: c.title, why: c.why, query: c.rawQuery, photo: c.photo, category: c.category });
    if (ideas.length >= MAX_IDEAS) break;
  }
  return { ideas, note: noteOf(raw), recipientSummary: summaryOf(raw) };
}

/* ---------- query cleaning ---------- */

const MODEL_NUMBER = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9-]{3,}$/;
const SIZE_UNIT = /^\d+(?:\.\d+)?(?:ml|l|g|kg|cm|mm|m|pack|pc|pcs|piece|pieces|inch|in|oz|w|v|mah|gb|tb|ft|x\d+)$|^\d+x\d+$/i;

function looksLikeBrand(token, index, titleCased, corpusStems) {
  const clean = token.replace(/[^A-Za-z0-9&-]/g, "");
  if (clean.length < 2 || QUERY_ACRONYMS.has(clean.toUpperCase())) return false;
  if (corpusStems.has(stem(clean))) return false; // the shopper named it
  if (SIZE_UNIT.test(clean)) return false;
  if (MODEL_NUMBER.test(clean)) return true;
  if (/^[A-Z]{3,}$/.test(clean)) return true;
  return !titleCased && index > 0 && /^[A-Z][a-z]+/.test(clean);
}

/** Returns { query, removedBrand, truncated } or null if nothing usable remains. */
export function cleanQuery(rawQuery, corpusStems = new Set()) {
  const tokens = rawQuery.split(/\s+/).filter(Boolean);
  const titleCased = tokens.length > 1 && tokens.every((t) => /^[A-Z]/.test(t));
  let removedBrand = false;
  const kept = [];
  tokens.forEach((token, index) => {
    if (looksLikeBrand(token, index, titleCased, corpusStems)) removedBrand = true;
    else kept.push(token);
  });
  let q = kept.join(" ").replace(QUERY_FOR_PHRASE, " ").toLowerCase();
  q = q.split(/\s+/).filter((w) => w && !QUERY_NOISE.has(w) && !/^\d+$/.test(w) && w !== "&").join(" ");
  const parts = q.split(/\s+/).filter(Boolean);
  const unique = parts.filter((w, i) => parts.indexOf(w) === i);
  if (unique.length < 2) return null;
  return { query: unique.slice(0, 6).join(" "), removedBrand, truncated: unique.length > 6 };
}

/* ---------- per-idea checks ---------- */

function firstMatch(rules, text) {
  for (const [code, re] of rules) if (re.test(text)) return code;
  return null;
}

function stripClaimSentences(why, patterns) {
  const kept = sentences(why).filter((s) => !patterns.some((p) => p.test(s)));
  return kept.join(" ").trim();
}

function evaluate(c, ctx, corpusText) {
  const issues = [];
  const reject = (code) => { issues.push({ code, action: "rejected" }); return { ok: false, issues }; };
  const label = `${c.title} ${c.concept} ${c.rawQuery}`;
  const idea = { ...c };

  if (INJECTION_ECHO.test(`${label} ${c.why} ${c.basedOn}`)) return reject("prompt_injection_echo");
  // "magazine single issue (subscription alternative)" is the opposite of a subscription.
  const blocked = firstMatch(ALWAYS_BLOCKED, label.replace(NEGATED_SERVICE, " "));
  if (blocked) return reject(blocked);

  // Claims we cannot support: remove the offending sentence, never rewrite it.
  if (AGE_RATING_CLAIM.test(c.title) && !PRICE_OR_STOCK_CLAIM.test(c.title) && !SAFETY_CLAIM.test(c.title)) {
    // An age band in the title is removed, not rejected; the idea is kept only if a real title remains.
    const stripped = c.title.replace(new RegExp(AGE_RATING_CLAIM.source, "gi"), " ").replace(/^[\s\-–:,|]+|[\s\-–:,|]+$/g, "").replace(/\s{2,}/g, " ");
    if (stripped.split(/\s+/).length < 2 || AGE_RATING_CLAIM.test(stripped)) return reject("unsupported_claim_in_title");
    idea.title = `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`;
    issues.push({ code: "age_band_removed_from_title", action: "repaired" });
  } else if (PRICE_OR_STOCK_CLAIM.test(c.title) || SAFETY_CLAIM.test(c.title) || AGE_RATING_CLAIM.test(c.title)) {
    return reject("unsupported_claim_in_title");
  }
  const claimPatterns = [];
  if (PRICE_OR_STOCK_CLAIM.test(c.why)) { claimPatterns.push(PRICE_OR_STOCK_CLAIM); issues.push({ code: "price_or_stock_claim", action: "removed" }); }
  if (SAFETY_CLAIM.test(c.why)) { claimPatterns.push(SAFETY_CLAIM); issues.push({ code: "unsupported_safety_claim", action: "removed" }); }
  if (AGE_RATING_CLAIM.test(c.why)) { claimPatterns.push(AGE_RATING_CLAIM); issues.push({ code: "invented_age_rating", action: "removed" }); }
  if (claimPatterns.length) {
    idea.why = stripClaimSentences(c.why, claimPatterns);
    if (idea.why.length < 15) return reject("nothing_left_after_claim_removal");
  }

  // "food wraps" or "food storage" are kitchenware, not food, for a shopper who avoids food products.
  const match = stemSet(`${c.title} ${c.concept} ${c.rawQuery}`.replace(NON_EDIBLE_FOOD, " "));
  const category = c.category;

  if (ctx) {
    if (ctx.isMinor) {
      const code = firstMatch(MINOR_BLOCKED, label);
      if (code) return reject(code);
    }
    if (ctx.ageBand === "baby") {
      const code = firstMatch(BABY_BLOCKED, label);
      if (code) return reject(code);
    }
    const smallPartsAge = ctx.ageYears !== null && (ctx.ageYears < 5 || (ctx.wantsNoSmallParts && ctx.ageYears < 9));
    if (smallPartsAge) {
      const code = firstMatch(SMALL_PARTS, label);
      if (code) return reject(code);
    }
    if (ctx.ageYears !== null && ctx.ageYears < 13 && SUPERVISION.test(label)) {
      if (/supervis/i.test(idea.why)) { /* already explained */ } else if (`${idea.why} Needs adult supervision.`.length <= 260) {
        idea.why = `${idea.why} Needs adult supervision.`;
        issues.push({ code: "supervision_note_added", action: "repaired" });
      } else issues.push({ code: "supervision_note_missing", action: "warned" });
    }
    for (const rule of SPECIALIST) {
      if (rule.terms.test(label) && !rule.unless.test(corpusText)) return reject(`specialist_${rule.id}`);
    }
    const avoidIds = new Set(ctx.avoid.flatMap((a) => a.groups.map((g) => g.id)));
    for (const topic of PREFERENCE_TOPICS) {
      const hit = topic.terms.test(label) || (topic.categories || []).includes(category);
      if (hit && topic.id === "personal_care" && !avoidIds.has(topic.id) && !topic.mentioned.test(corpusText) && tiedToStatedInterest(c, ctx, topic.terms)) {
        // e.g. a climbers' hand balm for someone who climbs: the hobby, not a guess about grooming, is the reason.
        issues.push({ code: "personal_care_tied_to_stated_interest", action: "warned" });
        continue;
      }
      if (hit && (!topic.mentioned.test(corpusText) || avoidIds.has(topic.id))) return reject(`unknown_preference_${topic.id}`);
    }
    for (const a of ctx.avoid) {
      const grouped = a.groups.some((g) => g.terms.test(label) || (g.categories || []).includes(category));
      const stemmed = a.stems.size > 0 && [...a.stems].every((s) => match.has(s));
      if (grouped || stemmed) return reject("excluded_by_shopper");
    }
    for (const o of ctx.owned) {
      // Owning "a football" rules out another football, not a football stats book: the item must be the product itself.
      if (o.stems.size > 0 && productType(c) === o.head && [...o.stems].every((s) => match.has(s))) {
        if (UPGRADE_WORDS.test(`${c.title} ${idea.why}`)) issues.push({ code: "possible_owned_item_framed_as_upgrade", action: "warned" });
        else return reject("already_owned");
      }
    }
    if (ctx.budget.max && c.estMax) {
      const limit = ctx.budget.max * (ctx.budget.soft ? 1.1 : 1);
      if (c.estMax > limit) return reject("over_budget");
    }
    if (c.basedOn && !/^versatile\b/i.test(c.basedOn) && !/^(?:general|neutral|none|n\/a)\b/i.test(c.basedOn)) {
      const basis = contentStems(c.basedOn);
      if (basis.length && !basis.some((s) => ctx.textStems.has(s))) return reject("invented_basis");
    }
    for (const m of idea.why.matchAll(PREFERENCE_VERB)) {
      const object = contentStems(m[1]);
      if (object.length && !object.some((s) => ctx.textStems.has(s))) {
        issues.push({ code: "possible_unsupported_preference_claim", action: "warned" });
        break;
      }
    }
  }

  const cleaned = cleanQuery(c.rawQuery, ctx ? ctx.textStems : new Set());
  if (!cleaned) return reject("query_unusable");
  if (cleaned.removedBrand) issues.push({ code: "brand_or_model_removed_from_query", action: "repaired" });
  if (cleaned.truncated) issues.push({ code: "query_truncated", action: "repaired" });
  idea.query = cleaned.query;
  const queryStems = stemSet(cleaned.query);
  const titleStems = stemSet(`${c.title} ${c.concept}`);
  if (![...queryStems].some((s) => titleStems.has(s))) return reject("query_title_mismatch");
  const whyStems = stemSet(idea.why);
  if (![...titleStems, ...queryStems].some((s) => whyStems.has(s))) issues.push({ code: "description_not_about_title", action: "warned" });

  return { ok: true, issues, idea };
}

const BODY_WORDS = new Set(["hand", "skin", "body", "face", "lip", "nail", "hair", "foot", "feet", "bath", "care", "gentle", "natural", "organic", "soft"].map(stem));

function tiedToStatedInterest(c, ctx, topicTerms) {
  const own = new Set(contentStems((`${c.title} ${c.concept} ${c.rawQuery}`.match(new RegExp(topicTerms.source, "gi")) || []).join(" ")));
  return contentStems(`${c.title} ${c.concept} ${c.rawQuery}`)
    .some((s) => ctx.textStems.has(s) && !own.has(s) && !GENERIC_LABEL.has(s) && !BODY_WORDS.has(s));
}

function productType(c) {
  // "Bread lame with replacement blades" is a lame, not a blade: use the part before the first preposition.
  const basis = (c.concept || c.title).split(/\b(?:with|for|and|in|to|from|of|that|featuring|by)\b|[,:(–]/i)[0] || c.title;
  const stems = contentStems(basis);
  return stems[stems.length - 1] || "";
}

/* ---------- summary ---------- */

const SUMMARY_FILLER = new Set((
  "love enjoy like interest keen fan into budget gift buy buying someone person adult new recent recently already own owns have " +
  "avoid dislike prefer age aged year old hobby hobbies practical thoughtful personal appreciate appreciates spend spending " +
  "around about under over up around approximately upto limit loves enjoys likes likes interested interests nephew niece " +
  "relative member family special occasion present looking idea ideas stated mentioned described buying birthday christmas anniversary " +
  "recipient lot taken want open focus maintain prep useless single use one only slightly wish unknown shopper knows favour " +
  "reusable preference tech student daytime value values"
).split(" ").map(stem));

export function unsupportedSummaryTerms(text, ctx) {
  const unsupported = [];
  for (const w of words(text)) {
    if (/^\d+$/.test(w)) { if (!ctx.text.includes(w)) unsupported.push(w); continue; }
  }
  for (const s of contentStems(text)) {
    if (!ctx.textStems.has(s) && !SUMMARY_FILLER.has(s) && !/^\d+$/.test(s)) unsupported.push(s);
  }
  return unsupported;
}

const normEvidence = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}£]+/gu, " ").trim();

/**
 * known_facts must be things the shopper actually wrote. Each fact needs a short verbatim extract
 * (`evidence`) that appears in the shopper's input. Legacy plain-string facts are checked against
 * the input as their own evidence. Anything unverified is reported, never trusted.
 */
export function verifyKnownFacts(raw, ctx) {
  const list = Array.isArray(raw?.recipient_profile?.known_facts) ? raw.recipient_profile.known_facts : [];
  const verified = [];
  const unverified = [];
  const corpus = ctx ? ` ${normEvidence(ctx.text)} ` : "";
  for (const item of list) {
    const fact = cleanText(typeof item === "string" ? item : item?.fact, 120);
    const evidence = cleanText(typeof item === "string" ? item : item?.evidence, 160);
    if (!fact) continue;
    const ev = normEvidence(evidence);
    const ok = Boolean(ctx) && ev.length >= 3 && corpus.includes(` ${ev} `);
    (ok ? verified : unverified).push({ fact, evidence, reason: ok ? "" : (ev ? "evidence_not_in_input" : "no_evidence") });
  }
  return { verified, unverified, total: verified.length + unverified.length };
}

function chooseSummary(raw, ctx, issues, facts) {
  const summary = summaryOf(raw);
  const clean = (s) => !INJECTION_ECHO.test(s) && !/https?:|www\./i.test(s);
  if (!ctx) return summary;
  if (summary && clean(summary) && unsupportedSummaryTerms(summary, ctx).length <= 1) return summary;
  if (summary) issues.push({ code: "summary_unsupported_by_input", action: "replaced" });
  const good = facts.verified.map((f) => f.fact).filter((f) => clean(f) && unsupportedSummaryTerms(f, ctx).length === 0).slice(0, 3);
  if (!good.length) return "";
  const joined = good.join("; ");
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`.replace(/\.\.$/, ".").slice(0, 180);
}

/* ---------- public entry point ---------- */

/**
 * @param raw   the tool input returned by the model (untrusted)
 * @param input the normalised shopper input, or null for structural checks only
 * @param opts  { exclude: string[] (ideas already shown), limit }
 */
export function curateIdeas(raw, input, opts = {}) {
  const limit = opts.limit || MAX_IDEAS;
  const exclude = opts.exclude || (input && input.exclude) || [];
  const ctx = input ? deriveRecipient(input) : null;
  const corpusText = ctx ? ctx.text : "";
  const candidates = normaliseCandidates(raw);
  const rawCount = raw && Array.isArray(raw.ideas) ? raw.ideas.length : 0;
  const issues = [];
  const valid = [];
  // Every rejected candidate is retained with its title and reason(s), so filtering can be audited.
  const rejected = new Map();
  const noteRejection = (c, code) => {
    const entry = rejected.get(c.index) || { index: c.index, title: c.title, codes: [] };
    entry.codes.push(code);
    rejected.set(c.index, entry);
  };

  const shown = exclude.map((t) => stemSet(t));
  const shownTitles = new Set(exclude.map((t) => t.toLowerCase()));

  for (const c of candidates) {
    const result = evaluate(c, ctx, corpusText);
    for (const issue of result.issues) issues.push({ index: c.index, ...issue });
    if (!result.ok) {
      for (const issue of result.issues) if (issue.action === "rejected") noteRejection(c, issue.code);
      continue;
    }
    const idea = result.idea;
    idea.titleStems = stemSet(`${c.title} ${c.concept}`);
    idea.queryStems = stemSet(idea.query);
    if (shownTitles.has(c.title.toLowerCase()) || shown.some((s) => jaccard(s, idea.titleStems) >= 0.8)) {
      issues.push({ index: c.index, code: "already_shown", action: "rejected" });
      noteRejection(c, "already_shown");
      continue;
    }
    valid.push(idea);
  }

  // Remove duplicates, keeping the earlier (higher-ranked) idea.
  const unique = [];
  for (const idea of valid) {
    const clash = unique.find((u) =>
      u.title.toLowerCase() === idea.title.toLowerCase()
      || u.query === idea.query
      || jaccard(u.queryStems, idea.queryStems) >= THRESHOLDS.duplicateQuery
      || jaccard(u.titleStems, idea.titleStems) >= THRESHOLDS.duplicateConcept);
    if (clash) {
      const sameQuery = clash.query === idea.query || jaccard(clash.queryStems, idea.queryStems) >= THRESHOLDS.duplicateQuery;
      const code = sameQuery ? "near_duplicate_query" : "duplicate_concept";
      issues.push({ index: idea.index, code, action: "rejected" });
      noteRejection(idea, code);
    } else unique.push(idea);
  }

  // Pass 1 enforces variety caps; pass 2 only tops up so variety never costs us a valid idea.
  const chosen = [];
  const tally = { category: {}, angle: {}, type: {} };
  const add = (idea) => {
    chosen.push(idea);
    tally.category[idea.category] = (tally.category[idea.category] || 0) + 1;
    if (idea.angle) tally.angle[idea.angle] = (tally.angle[idea.angle] || 0) + 1;
    const t = productType(idea);
    if (t) tally.type[t] = (tally.type[t] || 0) + 1;
  };
  const skipped = [];
  for (const idea of unique) {
    if (chosen.length >= limit) break;
    const t = productType(idea);
    const capped = (tally.category[idea.category] || 0) >= THRESHOLDS.maxPerCategory
      || (idea.angle && (tally.angle[idea.angle] || 0) >= THRESHOLDS.maxPerAngle)
      || (t && (tally.type[t] || 0) >= THRESHOLDS.maxPerProductType);
    if (capped) skipped.push(idea); else add(idea);
  }
  for (const idea of skipped) {
    if (chosen.length >= limit) break;
    add(idea);
    issues.push({ index: idea.index, code: "variety_cap_relaxed", action: "warned" });
  }
  chosen.sort((a, b) => a.index - b.index);

  const ideas = chosen.map((i) => ({ title: i.title, why: i.why, query: i.query, photo: i.photo, category: i.category }));
  let note = noteOf(raw);
  if (note && (INJECTION_ECHO.test(note) || /https?:|www\./i.test(note) || (ctx && /£\s?\d/.test(note) && ![...note.matchAll(/£\s?(\d+)/g)].every((m) => ctx.text.includes(m[1]))))) {
    note = "";
    issues.push({ code: "note_removed", action: "removed" });
  }
  const facts = verifyKnownFacts(raw, ctx);
  for (const f of facts.unverified) issues.push({ code: "fact_unverified", action: "demoted", detail: f.reason });
  const recipientSummary = chooseSummary(raw, ctx, issues, facts);

  return {
    ideas,
    note,
    recipientSummary,
    diagnostics: {
      validator: VALIDATOR_VERSION,
      candidates: candidates.length,
      returned: ideas.length,
      shortfall: ideas.length < limit,
      shortfall_count: Math.max(0, limit - ideas.length),
      truncated: Boolean(opts.truncated),
      raw_count: rawCount,
      malformed: rawCount - candidates.length,
      accepted: ideas.length,
      rejected_count: rejected.size,
      rejected: [...rejected.values()],
      // Valid ideas that were not needed because eight had already been chosen.
      spare_unused: unique.length - ideas.length,
      // Shown ideas that came from beyond the first `limit` positions, i.e. replacements.
      replacements_used: chosen.filter((i) => i.index >= limit).length,
      facts_verified: facts.verified.length,
      facts_unverified: facts.unverified,
      issues,
    },
  };
}
