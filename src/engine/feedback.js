// Anonymous learning signals. Events are reduced to a handful of enumerated fields before they reach storage:
// no IP, no free text, no idea titles, no session ids in counters. Receipt replay markers expire within 24 hours.
// Counts are aggregated per UTC day and kept for 90 days.
// Clicks are not quality ratings. Reviewed policies can use explicit ratings, never these counters directly.

import { STRATEGIES } from "../constants.js";
import { learningCounter } from "./learning.js";
import { knowledgeCounter } from "./knowledge.js";

export const FEEDBACK_EVENTS = ["shown", "click", "save", "dismiss", "more", "good", "bad", "bought"];
export const FEEDBACK_SOURCES = ["model", "graph", "catalogue"];
export const FEEDBACK_RETENTION_DAYS = 90;
const MAX_ITEMS = 12;

function item(value) {
  if (!value || typeof value !== "object") return null;
  const strategy = STRATEGIES.includes(value.strategy) ? value.strategy : "unknown";
  const source = FEEDBACK_SOURCES.includes(value.source) ? value.source : null;
  const position = Number.isInteger(value.position) && value.position >= 0 && value.position < MAX_ITEMS ? value.position : null;
  if (!source || position === null) return null;
  return { strategy, source, discovery: value.discovery === true, position, learning: value.learning };
}

/**
 * Validates a feedback body into counter keys. "shown" carries every displayed card; other events carry one.
 * "more" carries none. Returns { ok, keys } or { ok: false, error }.
 */
export function feedbackKeys(body, { verified = false } = {}) {
  if (!body || typeof body !== "object" || !FEEDBACK_EVENTS.includes(body.event)) return { ok: false, error: "Unknown event." };
  const event = body.event;
  if (event === "more") return { ok: true, keys: ["more"] };
  const raw = event === "shown" ? (Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : []) : [body.item];
  const items = raw.map(item).filter(Boolean);
  if (!items.length) return { ok: false, error: "Nothing to record." };
  const keys = [];
  for (const i of items) {
    keys.push(`${event}|s:${i.strategy}`, `${event}|src:${i.source}`, `${event}|d:${i.discovery ? 1 : 0}`, `${event}|p:${i.position}`);
    const joint = learningCounter(event, i.learning, i.position);
    if (joint) keys.push(joint);
    const concept = verified ? knowledgeCounter(event, i.learning, i.position) : null;
    if (concept) keys.push(concept);
  }
  return { ok: true, keys };
}
