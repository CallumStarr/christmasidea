import { readFile } from "node:fs/promises";
import { FEEDBACK_EVENTS } from "../src/engine/feedback.js";
import { CONCEPT_BY_KEY } from "../src/engine/concepts.js";
import { GRAPH_VERSION } from "../src/engine/interest-graph.js";
import {
  KNOWLEDGE_APPROVAL_DAYS, KNOWLEDGE_CSV_HEADER, KNOWLEDGE_EVIDENCE, KNOWLEDGE_WINDOW_DAYS, supportedConcept, utcDay, wilsonLowerBound,
} from "../src/engine/knowledge.js";
import { LEARNING_CONTROL, cellKey, validLearning } from "../src/engine/learning.js";

export function proposeKnowledge(csv, now = new Date()) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.shift() !== KNOWLEDGE_CSV_HEADER) throw new Error("Unexpected knowledge CSV schema.");
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 86400_000;
  const cells = new Map();
  const seen = new Set();
  let excludedRows = 0;
  for (const line of lines) {
    const fields = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1].replaceAll('""', '"'));
    if (fields.length !== 12 || fields.map((value) => `"${value.replaceAll('"', '""')}"`).join(",") !== line) {
      throw new Error("Invalid CSV row.");
    }
    const [day, event, topic, age, budget, category, policy, position, concept, graph, evidence, count] = fields;
    const value = { topic, age, budget, category, policy: LEARNING_CONTROL };
    if (utcDay(day) === null || !validLearning(value) || !FEEDBACK_EVENTS.includes(event)
      || !/^[a-z0-9.-]{1,60}$/.test(policy) || !/^[a-z0-9.-]{1,60}$/.test(graph)
      || !/^[a-z0-9-]{1,150}$/.test(concept) || !/^[a-z0-9-]{1,40}$/.test(evidence) || !/^(?:[0-9]|1[01])$/.test(position)
      || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count))) throw new Error("Invalid knowledge dimensions.");
    const rowKey = fields.slice(0, 11).join("|");
    if (seen.has(rowKey)) throw new Error("Duplicate knowledge row; do not combine overlapping exports.");
    seen.add(rowKey);
    if (utcDay(day) >= today || utcDay(day) < today - KNOWLEDGE_WINDOW_DAYS * dayMs
      || policy !== LEARNING_CONTROL || graph !== GRAPH_VERSION || evidence !== KNOWLEDGE_EVIDENCE || !["shown", "good", "bad"].includes(event)
      || !CONCEPT_BY_KEY.has(concept) || CONCEPT_BY_KEY.get(concept).category !== category || topic === "unknown") {
      excludedRows++;
      continue;
    }
    const key = `${cellKey(value)}|${concept}`;
    const cell = cells.get(key) || { topic, age, budget, category, concept, shown: 0, good: 0, bad: 0, lastRated: "", positions: {} };
    cell[event] += Number(count);
    if (!Number.isSafeInteger(cell[event])) throw new Error("Knowledge count overflow.");
    const atPosition = cell.positions[position] ||= { shown: 0, good: 0, bad: 0 };
    atPosition[event] += Number(count);
    if (event !== "shown" && Number(count) > 0 && day > cell.lastRated) cell.lastRated = day;
    cells.set(key, cell);
  }
  const all = [...cells.values()];
  const eligible = all.filter((cell) => supportedConcept(cell)
    && utcDay(cell.lastRated) >= today - KNOWLEDGE_APPROVAL_DAYS * dayMs)
    .map((cell) => ({ ...cell, lowerBound: Number(wilsonLowerBound(cell.good, cell.bad).toFixed(4)) }))
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.concept.localeCompare(b.concept));
  return {
    version: "knowledge-v1", approved: false, evidence: KNOWLEDGE_EVIDENCE, graph: GRAPH_VERSION,
    evidenceThrough: new Date(today - dayMs).toISOString().slice(0, 10),
    expiresAt: new Date(today + KNOWLEDGE_APPROVAL_DAYS * dayMs).toISOString().slice(0, 10),
    cells: eligible,
    review: { observedCells: all.length, eligibleCells: eligible.length, excludedRows,
      warning: "Signed, deduplicated card reports are not independent shoppers or causal evidence. Review position bias, abuse and blind paired quality before approval." },
  };
}

if (process.argv[1]?.endsWith("review-knowledge.mjs")) {
  if (!process.argv[2]) throw new Error("Usage: node scripts\\review-knowledge.mjs gift-knowledge.csv");
  console.log(JSON.stringify(proposeKnowledge(await readFile(process.argv[2], "utf8")), null, 2));
}
