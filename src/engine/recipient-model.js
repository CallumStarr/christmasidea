// Structured recipient model. Keeps what the shopper actually said (explicit, each with a verbatim
// anchor) strictly apart from what the system guesses (inferred, each with a confidence and the
// anchor it was inferred from) and what nobody knows yet (unknowns). Model output is only used
// when its evidence can be found verbatim in the shopper's words.

import { deriveRecipient } from "../recipient.js";
import { INJECTION_ECHO } from "../rules.js";
import { cleanText } from "../text.js";
import { normEvidence, verifyKnownFacts } from "../validate.js";
import { detectInterests, facetWeights } from "./interest-graph.js";

const unsafe = (s) => !s || INJECTION_ECHO.test(s) || /https?:|www\.|[<>{}]/i.test(s);

export function corpusOf(ctx) {
  return ` ${normEvidence(ctx?.text || "")} `;
}

/** True when `anchor` is a short verbatim extract of what the shopper typed. */
export function verifyAnchor(anchor, ctx) {
  const a = normEvidence(anchor);
  return a.length >= 3 && a.length <= 80 && corpusOf(ctx).includes(` ${a} `);
}

/** Pre-call understanding: everything the server can work out without the model. */
export function understand(input) {
  const ctx = deriveRecipient(input);
  const interests = detectInterests(ctx.text);
  const facets = facetWeights(interests);
  return { ctx, interests, facets, facetMap: new Map(facets.map((f) => [f.id, f])) };
}

/** The model's discovery directions, kept only when anchored in the shopper's words. */
export function verifiedDirections(raw, ctx) {
  const list = Array.isArray(raw?.directions) ? raw.directions : [];
  const map = new Map();
  for (const d of list.slice(0, 8)) {
    if (!d || typeof d !== "object") continue;
    const id = cleanText(d.id, 40).toLowerCase();
    const label = cleanText(d.label, 60);
    const anchor = cleanText(d.anchor, 80);
    if (!id || !label || unsafe(label) || !verifyAnchor(anchor, ctx)) continue;
    map.set(id, { id, label, anchor, strategy: cleanText(d.strategy, 30) });
  }
  return map;
}

function modelDrivers(raw, ctx) {
  const list = Array.isArray(raw?.recipient_profile?.drivers) ? raw.recipient_profile.drivers : [];
  const out = [];
  for (const d of list.slice(0, 6)) {
    const label = cleanText(d?.driver, 60);
    const because = cleanText(d?.evidence, 80);
    const confidence = Number(d?.confidence);
    if (!label || unsafe(label) || !verifyAnchor(because, ctx)) continue;
    out.push({ label, because, confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(0.9, confidence)) : 0.5, source: "model" });
  }
  return out;
}

/**
 * @returns { explicit: [{fact, evidence}], inferred: [{label, because, confidence, source}], unknowns: [] }
 */
export function buildRecipientModel(understanding, raw = null) {
  const { ctx, interests, facets } = understanding;
  const explicit = [];
  const add = (fact, evidence) => {
    if (fact && !explicit.some((e) => e.fact.toLowerCase() === fact.toLowerCase())) explicit.push({ fact, evidence });
  };
  if (ctx.ageYears !== null) add(`Age ${ctx.ageYears}`, "");
  for (const d of interests) add(d.trait ? `Described as ${d.evidence}` : `Likes ${d.label}`, d.evidence);
  for (const o of ctx.owned) add(`Already has ${o.phrase}`, o.phrase);
  for (const a of ctx.avoid) add(`Avoid ${a.phrase}`, a.phrase);
  if (ctx.budget?.max) add(`Budget about £${ctx.budget.max}`, "");
  if (raw) {
    for (const f of verifyKnownFacts(raw, ctx).verified) if (!unsafe(f.fact)) add(f.fact, f.evidence);
  }

  const inferred = [];
  const top = facets[0]?.weight || 1;
  for (const f of facets.slice(0, 4)) {
    const from = interests.filter((d) => f.from.includes(d.id)).sort((a, b) => b.strength - a.strength)[0];
    if (!from) continue;
    inferred.push({ label: f.label, because: from.evidence, confidence: Math.round(Math.min(0.85, 0.4 + 0.45 * (f.weight / top)) * 100) / 100, source: "graph", facet: f.id });
  }
  if (raw) {
    for (const d of modelDrivers(raw, ctx)) {
      if (!inferred.some((i) => i.label.toLowerCase() === d.label.toLowerCase())) inferred.push(d);
    }
  }

  const unknowns = [];
  if (ctx.ageYears === null) unknowns.push("age");
  if (!ctx.budget?.max) unknowns.push("budget");
  if (!interests.some((d) => !d.trait)) unknowns.push("specific interests");
  const modelUnknowns = Array.isArray(raw?.recipient_profile?.unknowns) ? raw.recipient_profile.unknowns : [];
  for (const u of modelUnknowns.slice(0, 4)) {
    const text = cleanText(u, 60);
    if (text && !unsafe(text) && !unknowns.includes(text.toLowerCase())) unknowns.push(text.toLowerCase());
  }

  return { explicit: explicit.slice(0, 10), inferred: inferred.slice(0, 6), unknowns: unknowns.slice(0, 5) };
}
