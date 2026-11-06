import { AGE_BANDS, BUDGETS, CATEGORIES } from "../constants.js";
import { deriveRecipient, recipientCorpus } from "../recipient.js";
import { detectInterests, GRAPH_VERSION, INTERESTS } from "./interest-graph.js";
import { LEARNING_POLICY } from "./learning-policy.js";
import { matchConcept } from "./concepts.js";
import { KNOWLEDGE_POLICY } from "./knowledge-policy.js";

export const LEARNING_CONTROL = "control-v1";
export const LEARNING_TOPICS = ["unknown", ...INTERESTS.filter((i) => !i.trait).map((i) => i.id)];
export const MIN_SHOWN = 200;
export const MIN_RATINGS = 30;

export function learningContext(input) {
  const ctx = deriveRecipient(input);
  const max = ctx.budget.max;
  const budget = max === null ? "any" : max < 15 ? "under-15" : max <= 30 ? "15-30"
    : max <= 50 ? "30-50" : max <= 100 ? "50-100" : "100-plus";
  const topic = detectInterests(recipientCorpus(input)).find((i) => LEARNING_TOPICS.includes(i.id))?.id || "unknown";
  return { topic, age: ctx.ageBand, budget };
}

export function validLearning(value) {
  return value && LEARNING_TOPICS.includes(value.topic) && AGE_BANDS.includes(value.age)
    && Object.hasOwn(BUDGETS, value.budget) && CATEGORIES.includes(value.category)
    && [LEARNING_CONTROL, LEARNING_POLICY.version, KNOWLEDGE_POLICY.version].includes(value.policy);
}

export function cellKey(value) {
  return [value.topic, value.age, value.budget, CATEGORIES.indexOf(value.category)].join("|");
}

export function ratingScore({ shown, good, bad }) {
  if (![shown, good, bad].every((n) => Number.isSafeInteger(n) && n >= 0)
    || shown < MIN_SHOWN || good + bad < MIN_RATINGS || good + bad > shown) return null;
  return (good - bad) / (good + bad + 20);
}

export function applyLearning(ideas, input, env = {}, policy = LEARNING_POLICY) {
  const context = learningContext(input);
  const interests = detectInterests(recipientCorpus(input));
  const singleTopic = interests.length === 1 && !interests[0].trait;
  const active = env.LEARNING_RANKING_ENABLED === "true" && policy.approved === true;
  const scores = new Map();
  if (active) {
    for (const cell of policy.cells) {
      const score = ratingScore(cell);
      if (score !== null && validLearning({ ...cell, policy: LEARNING_POLICY.version })) scores.set(cellKey(cell), score);
    }
  }
  const output = ideas.map((idea) => {
    const concept = matchConcept(idea);
    return {
      ...idea,
      learning: { ...context, category: idea.category, policy: active ? policy.version : LEARNING_CONTROL,
        ...(concept ? { concept, graph: GRAPH_VERSION, singleTopic } : {}) },
    };
  });
  // Only swap disjoint adjacent pairs; never add candidates or bypass suitability/variety validation.
  for (let i = 0; active && i + 1 < output.length; i++) {
    const first = scores.get(cellKey(output[i].learning)) || 0;
    const next = scores.get(cellKey(output[i + 1].learning)) || 0;
    if (next - first > 0.1) {
      [output[i], output[i + 1]] = [output[i + 1], output[i]];
      i++;
    }
  }
  return output;
}

export function learningCounter(event, value, position) {
  if (!validLearning(value)) return null;
  return `L|${event}|${cellKey(value)}|${value.policy}|${position}`;
}

export function feedbackCsv(rows) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return ["day,event,topic,age,budget,category,policy,position,count",
    ...rows.map(({ bucket, k, n }) => {
      const [, event, topic, age, budget, category, policy, position] = k.split("|");
      return [bucket.slice(1), event, topic, age, budget, CATEGORIES[Number(category)], policy, position, n].map(quote).join(",");
    })].join("\r\n") + "\r\n";
}
