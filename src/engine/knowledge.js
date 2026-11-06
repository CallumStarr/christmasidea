import { CATEGORIES } from "../constants.js";
import { CONCEPT_BY_KEY, conceptKey } from "./concepts.js";
import { GRAPH_VERSION, audienceFor, interestById } from "./interest-graph.js";
import { runEngine, understand } from "./index.js";
import { KNOWLEDGE_POLICY } from "./knowledge-policy.js";
import { LEARNING_CONTROL, cellKey, learningContext, ratingScore, validLearning } from "./learning.js";
import { provenance } from "./retrieval.js";

export const KNOWLEDGE_WINDOW_DAYS = 60;
export const KNOWLEDGE_APPROVAL_DAYS = 30;
export const KNOWLEDGE_MIN_LOWER_BOUND = 0.6;
export const KNOWLEDGE_EVIDENCE = "signed-card-v1";
export const KNOWLEDGE_CSV_HEADER = "day,event,topic,age,budget,category,policy,position,concept,graph,evidence,count";
const DAY = 86400_000;

export function utcDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function wilsonLowerBound(good, bad) {
  const n = good + bad;
  if (!Number.isFinite(n) || good < 0 || bad < 0 || n <= 0) return 0;
  const z = 1.96;
  const p = good / n;
  return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n);
}

export function supportedConcept(cell) {
  const concept = CONCEPT_BY_KEY.get(cell?.concept);
  return Boolean(concept && concept.category === cell.category
    && validLearning({ ...cell, policy: LEARNING_CONTROL }) && cell.topic !== "unknown"
    && ratingScore(cell) !== null && wilsonLowerBound(cell.good, cell.bad) >= KNOWLEDGE_MIN_LOWER_BOUND);
}

export function knowledgeCounter(event, value, position) {
  if (!validLearning(value) || value.singleTopic !== true || value.graph !== GRAPH_VERSION || !CONCEPT_BY_KEY.has(value.concept)
    || CONCEPT_BY_KEY.get(value.concept).category !== value.category) return null;
  return `V|${event}|${cellKey(value)}|${value.policy}|${position}|${value.concept}|${GRAPH_VERSION}`;
}

export function knowledgeCsv(rows) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return [KNOWLEDGE_CSV_HEADER, ...rows.map(({ bucket, k, n }) => {
    const [kind, event, topic, age, budget, category, policy, position, concept, graph] = k.split("|");
    return [bucket.slice(1), event, topic, age, budget, CATEGORIES[Number(category)], policy, position, concept, graph,
      kind === "V" ? KNOWLEDGE_EVIDENCE : "legacy", n]
      .map(quote).join(",");
  })].join("\r\n") + "\r\n";
}

// Abstain on unrecognised details rather than mistaking partial topic overlap for understanding.
export function reusableProfile(input, u) {
  if (u.ctx.ageYears === null || u.ctx.ageYears < 4 || !u.ctx.budget.max
    || u.ctx.owned.length || u.ctx.avoid.length || u.interests.length !== 1 || u.interests[0].trait) return false;
  let rest = [input.description, input.interests, input.about, input.relationOther].filter(Boolean).join(" ");
  for (const interest of u.interests) rest = rest.replace(new RegExp(interestById(interest.id).re.source, "gi"), " ");
  rest = rest.replace(/\b(?:my|our|a|an|the|and|or|who|is|are|he|she|they|his|her|their|year|years|old|aged|age|s|likes?|loves?|enjoys?|really|very|into|interested|in|with|for|budget|up|to|under|about|around|pounds?|gbp|christmas|birthday|gift|present|ideas?|mum|mom|mother|dad|father|son|daughter|brother|sister|friend|partner|husband|wife|child|boy|girl)\b/gi, " ");
  rest = rest.replace(new RegExp(`\\b(?:${u.ctx.ageYears}|${u.ctx.budget.max})\\b`, "g"), " ");
  return !/[^\s.,;:!?'"()\u2019\u00a3\u2013-]/u.test(rest);
}

/** Aggregate-safe decision reasons are shared by production diagnostics and offline readiness checks. */
export function assessKnowledge(input, env = {}, policy = KNOWLEDGE_POLICY, now = new Date()) {
  const abstain = (reason) => ({ result: null, reason });
  if (env.KNOWLEDGE_REUSE_ENABLED !== "true") return abstain("disabled");
  if (policy?.approved !== true) return abstain("unapproved");
  if (!/^knowledge-[a-z0-9][a-z0-9.-]{0,40}$/.test(policy.version)
    || !Array.isArray(policy.cells) || policy.evidence !== KNOWLEDGE_EVIDENCE) return abstain("invalid-policy");
  if (policy.graph !== GRAPH_VERSION) return abstain("graph-mismatch");
  const through = utcDay(policy.evidenceThrough);
  const expires = utcDay(policy.expiresAt);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (through === null || expires === null || through >= today || expires <= today
    || expires > through + (KNOWLEDGE_APPROVAL_DAYS + 1) * DAY || through < today - KNOWLEDGE_APPROVAL_DAYS * DAY) return abstain("stale-policy");
  const u = understand(input);
  if (!reusableProfile(input, u)) return abstain("unsupported-profile");
  const context = learningContext(input);
  const audience = audienceFor(u.ctx.ageYears);
  const candidates = [];
  const keys = new Set();
  for (const cell of policy.cells || []) {
    if (!supportedConcept(cell) || cell.topic !== context.topic || cell.age !== context.age || cell.budget !== context.budget
      || utcDay(cell.lastRated) === null || utcDay(cell.lastRated) > through
      || utcDay(cell.lastRated) < through - KNOWLEDGE_APPROVAL_DAYS * DAY || keys.has(cell.concept)) continue;
    const concept = CONCEPT_BY_KEY.get(cell.concept);
    const via = provenance(concept, u.facetMap, u.interests);
    if (!via || !concept.audiences.includes(audience) || concept.maxPrice > u.ctx.budget.max) continue;
    keys.add(cell.concept);
    candidates.push({
      title: concept.title, concept: concept.concept, search_query: concept.query, why: concept.why,
      category: concept.category, estimated_max_price_gbp: concept.maxPrice, based_on: via.anchor,
      strategy: via.direct ? "core-interest" : "adjacent-driver", gift_type: "physical", source: "graph", provenance: via,
    });
  }
  if (candidates.length < 8) return abstain("insufficient-evidence");
  const result = runEngine({ ideas: [] }, input, { backups: false, extraCandidates: candidates, understanding: u });
  if (result.ideas.length !== 8) return abstain("validation-shortfall");
  if (result.ideas.some((idea) => !idea.connection)) return abstain("ungrounded");
  if (new Set(result.ideas.map((idea) => idea.category)).size < 3) return abstain("insufficient-diversity");
  const selected = result.ideas.map((idea) => CONCEPT_BY_KEY.get(conceptKey({ query: idea.query }))).filter(Boolean);
  const covered = u.interests.filter((interest) => !interest.trait)
    .every((interest) => selected.some((concept) => concept.interests.includes(interest.id)));
  if (!covered) return abstain("missing-interest-coverage");
  return { result: { ...result, knowledgeVersion: policy.version }, reason: "reused" };
}

/** Returns null unless a fresh, reviewed library alone can supply a complete suitable list. */
export function reuseKnowledge(input, env = {}, policy = KNOWLEDGE_POLICY, now = new Date()) {
  return assessKnowledge(input, env, policy, now).result;
}
