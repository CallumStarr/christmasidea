// Deterministic, offline metrics for benchmark result files. No API calls, no human scores.
//
//   node scripts/engine-metrics.js --results=<benchmark-results.json> [--cases-file=<cases.json>] [--replay] [--json=<out.json>]
//
// --replay re-runs each stored raw model response through the current gift engine, so an old run
// (e.g. the frozen v3.3 baseline) can be compared with the new ranking without spending tokens.
// Metrics describe structure (diversity, grounding, budget, literalness); they are not quality scores.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseInput } from "../src/core.js";
import { runEngine, understand } from "../src/engine/index.js";
import { intraListDiversity } from "../src/engine/ranking.js";
import { isDirectFor } from "../src/engine/interest-graph.js";
import { stemSet } from "../src/text.js";
import { normEvidence } from "../src/validate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function args(argv) {
  const out = { results: "", casesFile: path.join(ROOT, "benchmarks", "v3.4", "cases.json"), replay: false, json: "" };
  for (const a of argv) {
    if (a.startsWith("--results=")) out.results = a.slice(10);
    else if (a.startsWith("--cases-file=")) out.casesFile = a.slice(13);
    else if (a === "--replay") out.replay = true;
    else if (a.startsWith("--json=")) out.json = a.slice(7);
  }
  return out;
}

const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 1000) / 1000 : null);

/** Metrics for one shown list. */
export function listMetrics(ideas, input) {
  const u = understand(input);
  const stated = u.interests.filter((d) => !d.trait).map((d) => d.id);
  const text = normEvidence(u.ctx.text);
  const budget = u.ctx.budget?.max || null;
  const literal = ideas.filter((i) => stated.length && isDirectFor(stemSet(`${i.title} ${i.concept || ""}`), stated)).length;
  const overBudget = budget ? ideas.filter((i) => Number(i.productSpec?.maxPriceGbp) > budget * 1.1).length : 0;
  const grounded = ideas.filter((i) => i.connection && text.includes(normEvidence(i.connection.anchor))).length;
  return {
    shown: ideas.length,
    // Content-only ILD: strategy/direction labels exist only on new outputs and would bias the comparison.
    ild: intraListDiversity(ideas.map(({ title, concept, category }) => ({ title, concept, category }))),
    literal_share: ideas.length ? Math.round((literal / ideas.length) * 1000) / 1000 : null,
    discovery: ideas.filter((i) => i.discovery).length,
    grounded_connections: grounded,
    over_budget: overBudget,
    categories: new Set(ideas.map((i) => i.category)).size,
    backups: ideas.filter((i) => i.source && i.source !== "model").length,
  };
}

export function summarise(rows) {
  const pick = (k) => rows.map((r) => r[k]).filter((v) => typeof v === "number");
  return {
    cases: rows.length,
    mean_shown: mean(pick("shown")),
    mean_ild: mean(pick("ild")),
    mean_literal_share: mean(pick("literal_share")),
    mean_discovery: mean(pick("discovery")),
    mean_grounded_connections: mean(pick("grounded_connections")),
    total_over_budget: pick("over_budget").reduce((s, x) => s + x, 0),
    mean_categories: mean(pick("categories")),
    shortfall_cases: rows.filter((r) => r.shown < 8).length,
  };
}

function main() {
  const a = args(process.argv.slice(2));
  if (!a.results) {
    console.log("Usage: node scripts/engine-metrics.js --results=<benchmark-results.json> [--cases-file=...] [--replay] [--json=out.json]");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(a.results), "utf8"));
  const cases = new Map(JSON.parse(fs.readFileSync(path.resolve(a.casesFile), "utf8")).map((c) => [c.id, c]));
  const rows = [];
  for (const r of data.results || []) {
    const c = cases.get(r.case_id);
    if (!c || !r.raw_output) continue;
    const input = normaliseInput(c.input).value;
    const ideas = a.replay ? runEngine(r.raw_output, input, { truncated: r.truncated }).ideas : r.output?.ideas || [];
    rows.push({ case_id: r.case_id, set: c.set || "", status: r.status, cost: r.estimated_cost_usd || 0, ...listMetrics(ideas, input) });
  }
  const bySet = {};
  for (const r of rows) (bySet[r.set || "all"] ||= []).push(r);
  const report = {
    source: path.relative(ROOT, path.resolve(a.results)).replaceAll("\\", "/"),
    mode: a.replay ? "replayed through current engine" : "as stored",
    prompt_version: data.prompt_version,
    overall: { ...summarise(rows), truncated: rows.filter((r) => r.status === "truncated").length, total_cost_usd: Math.round(rows.reduce((s, r) => s + r.cost, 0) * 1e6) / 1e6 },
    by_set: Object.fromEntries(Object.entries(bySet).map(([k, v]) => [k, summarise(v)])),
    cases: rows,
  };
  if (a.json) fs.writeFileSync(path.resolve(a.json), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ source: report.source, mode: report.mode, overall: report.overall, by_set: report.by_set }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
