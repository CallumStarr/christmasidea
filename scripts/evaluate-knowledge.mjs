import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { normaliseInput } from "../src/core.js";
import { assessKnowledge } from "../src/engine/knowledge.js";
import { KNOWLEDGE_POLICY } from "../src/engine/knowledge-policy.js";
import { listMetrics, summarise } from "./engine-metrics.js";

export function evaluateKnowledge(cases, policy, now = new Date()) {
  if (!Array.isArray(cases) || !cases.length) throw new Error("Provide a non-empty evaluation case array.");
  const ids = new Set();
  const reasons = {};
  const slices = new Map();
  const metrics = [];
  const rows = cases.map((entry) => {
    if (typeof entry?.id !== "string" || !entry.id || ids.has(entry.id)) throw new Error("Evaluation case IDs must be unique non-empty strings.");
    ids.add(entry.id);
    const parsed = normaliseInput(entry.input);
    if (!parsed.ok) throw new Error(`Invalid evaluation input for ${entry.id}: ${parsed.error}`);
    const decision = assessKnowledge(parsed.value, { KNOWLEDGE_REUSE_ENABLED: "true" }, policy, now);
    reasons[decision.reason] = (reasons[decision.reason] || 0) + 1;
    const slice = typeof entry.set === "string" && entry.set ? entry.set : "unspecified";
    const counts = slices.get(slice) || { cases: 0, reused: 0 };
    counts.cases++;
    if (decision.result) {
      counts.reused++;
      metrics.push(listMetrics(decision.result.ideas, parsed.value));
    }
    slices.set(slice, counts);
    return { id: entry.id, reason: decision.reason, shown: decision.result?.ideas.length || 0 };
  });
  return {
    policy: policy.version, evidenceThrough: policy.evidenceThrough, evaluatedAt: now.toISOString(),
    cases: cases.length, reused: metrics.length, bypassFraction: metrics.length / cases.length,
    reasons, bySet: Object.fromEntries(slices), structure: summarise(metrics), rows,
    qualityClaim: false,
    warning: "Coverage and structure only, not gift quality or causal uplift. Keep later held-out evidence and complete a blind paired human review before approval.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 2) throw new Error("Usage: node scripts\\evaluate-knowledge.mjs [cases.json] [policy.json]");
  const cases = JSON.parse(await readFile(args[0] || new URL("../benchmarks/v3.4/cases.json", import.meta.url), "utf8"));
  const policy = args[1] ? JSON.parse(await readFile(args[1], "utf8")) : KNOWLEDGE_POLICY;
  console.log(JSON.stringify(evaluateKnowledge(cases, policy), null, 2));
}
