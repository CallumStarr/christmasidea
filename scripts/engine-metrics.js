// Deterministic, offline metrics for benchmark result files. No API calls, no human scores.
//
//   node scripts/engine-metrics.js --results=<benchmark-results.json> [--cases-file=<cases.json>] [--case-set=<set>] [--expected-cases=<count>] [--replay] [--json=<out.json>]
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
import { jaccard, stemSet } from "../src/text.js";
import { normEvidence } from "../src/validate.js";
import { detectInterests } from "../src/engine/interest-graph.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function args(argv) {
  const out = { results: "", casesFile: path.join(ROOT, "benchmarks", "v3.4", "cases.json"), caseSet: "", expectedCases: 0, replay: false, json: "" };
  for (const a of argv) {
    if (a.startsWith("--results=")) out.results = a.slice(10);
    else if (a.startsWith("--cases-file=")) out.casesFile = a.slice(13);
    else if (a.startsWith("--case-set=")) out.caseSet = a.slice(11);
    else if (a.startsWith("--expected-cases=")) out.expectedCases = Number(a.slice(17));
    else if (a === "--replay") out.replay = true;
    else if (a.startsWith("--json=")) out.json = a.slice(7);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (out.expectedCases && (!Number.isSafeInteger(out.expectedCases) || out.expectedCases < 1)) {
    throw new Error("--expected-cases must be a positive integer.");
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
  const validCaps = budget ? ideas.map((i) => i.productSpec?.maxPriceGbp)
    .filter((cap) => typeof cap === "number" && Number.isFinite(cap) && cap > 0) : [];
  const matchCapOverBudget = validCaps.length ? validCaps.filter((cap) => cap > budget * 1.1).length : null;
  const budgetAssessment = validCaps.length === 0 ? "unassessed"
    : validCaps.length === ideas.length ? "assessed" : "partial";
  const grounded = ideas.filter((i) => i.connection && text.includes(normEvidence(i.connection.anchor))).length;
  let nearDuplicatePairs = 0;
  for (let i = 0; i < ideas.length; i += 1) {
    for (let j = i + 1; j < ideas.length; j += 1) {
      if (jaccard(stemSet(`${ideas[i].title} ${ideas[i].concept || ""}`), stemSet(`${ideas[j].title} ${ideas[j].concept || ""}`)) >= 0.72) {
        nearDuplicatePairs += 1;
      }
    }
  }
  const repeatedInterests = new Map();
  for (const idea of ideas) {
    const ids = new Set(detectInterests(`${idea.title} ${idea.concept || ""} ${idea.query || ""}`)
      .filter((interest) => !interest.trait)
      .map((interest) => interest.id));
    for (const id of ids) repeatedInterests.set(id, (repeatedInterests.get(id) || 0) + 1);
  }
  const repeatedInterestExcess = [...repeatedInterests.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const strategies = new Map();
  for (const idea of ideas) {
    if (typeof idea.strategy === "string" && idea.strategy) strategies.set(idea.strategy, (strategies.get(idea.strategy) || 0) + 1);
  }
  const labelledStrategies = [...strategies.values()].reduce((sum, count) => sum + count, 0);
  const strategyBalance = strategies.size === 1 ? 0 : strategies.size
    ? Math.round((-([...strategies.values()].reduce((sum, count) => {
      const p = count / labelledStrategies;
      return sum + p * Math.log(p);
    }, 0)) / Math.log(strategies.size)) * 1000) / 1000
    : null;
  return {
    shown: ideas.length,
    // Content-only ILD: strategy/direction labels exist only on new outputs and would bias the comparison.
    ild: intraListDiversity(ideas.map(({ title, concept, category }) => ({ title, concept, category }))),
    literal_share: ideas.length ? Math.round((literal / ideas.length) * 1000) / 1000 : null,
    discovery: ideas.filter((i) => i.discovery).length,
    grounded_connections: grounded,
    match_cap_over_budget: matchCapOverBudget,
    budget_assessment: budgetAssessment,
    match_caps_assessed: validCaps.length,
    match_caps_unassessed: ideas.length - validCaps.length,
    near_duplicate_pairs: nearDuplicatePairs,
    repeated_interest_excess: repeatedInterestExcess,
    strategy_balance: strategyBalance,
    strategy_labels_present: labelledStrategies,
    strategy_labels_missing: ideas.length - labelledStrategies,
    categories: new Set(ideas.map((i) => i.category)).size,
    backups: ideas.filter((i) => i.source && i.source !== "model").length,
  };
}

export function summarise(rows) {
  const pick = (k) => rows.map((r) => r[k]).filter((v) => typeof v === "number");
  const assessedBudgets = pick("match_cap_over_budget");
  return {
    cases: rows.length,
    mean_shown: mean(pick("shown")),
    mean_ild: mean(pick("ild")),
    mean_literal_share: mean(pick("literal_share")),
    mean_discovery: mean(pick("discovery")),
    mean_grounded_connections: mean(pick("grounded_connections")),
    total_match_cap_over_budget: assessedBudgets.length ? assessedBudgets.reduce((s, x) => s + x, 0) : null,
    budget_assessed_cases: rows.filter((r) => r.budget_assessment === "assessed").length,
    budget_partially_assessed_cases: rows.filter((r) => r.budget_assessment === "partial").length,
    budget_unassessed_cases: rows.filter((r) => r.budget_assessment === "unassessed").length,
    match_caps_assessed: pick("match_caps_assessed").reduce((s, x) => s + x, 0),
    match_caps_unassessed: pick("match_caps_unassessed").reduce((s, x) => s + x, 0),
    total_near_duplicate_pairs: pick("near_duplicate_pairs").reduce((s, x) => s + x, 0),
    mean_repeated_interest_excess: mean(pick("repeated_interest_excess")),
    mean_strategy_balance: mean(pick("strategy_balance")),
    mean_categories: mean(pick("categories")),
    shortfall_cases: rows.filter((r) => r.shown < 8).length,
  };
}

export function summariseCompletion(rows) {
  return {
    truncated: rows.filter((row) => row.truncated === true).length,
    truncation_unknown: rows.filter((row) => typeof row.truncated !== "boolean").length,
    sample_scope: "completed results only; failed or missing attempts are excluded",
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateBenchmarkData(data, caseRows, { caseSet = "", expectedCases = 0, replay = false } = {}) {
  if (!isRecord(data) || !Array.isArray(data.results) || !Array.isArray(data.selected_case_ids)) {
    throw new Error("Results file must contain results and selected_case_ids arrays.");
  }
  if (!Array.isArray(caseRows) || !caseRows.length) throw new Error("Cases file must be a non-empty array.");

  const allCases = new Map();
  for (const c of caseRows) {
    if (!isRecord(c) || typeof c.id !== "string" || !c.id || !isRecord(c.input)) {
      throw new Error("Cases file contains a malformed case.");
    }
    if (allCases.has(c.id)) throw new Error(`Cases file contains duplicate case ID: ${c.id}.`);
    allCases.set(c.id, c);
  }
  const expected = [...allCases.values()].filter((c) => !caseSet || c.set === caseSet);
  if (!expected.length) throw new Error(`Cases file contains no cases for set "${caseSet}".`);
  const expectedIds = new Set(expected.map((c) => c.id));
  if (expected.some((c) => !normaliseInput(c.input).ok)) {
    throw new Error("Cases file contains an invalid benchmark input.");
  }
  const count = expectedCases || expected.length;
  if (count !== expected.length) {
    throw new Error(`Expected ${count} cases, but the selected case set contains ${expected.length}.`);
  }

  const selectedIds = data.selected_case_ids;
  if (selectedIds.length !== count || selectedIds.some((id) => typeof id !== "string") ||
      new Set(selectedIds).size !== selectedIds.length ||
      selectedIds.some((id) => !expectedIds.has(id)) ||
      expected.some((c) => !selectedIds.includes(c.id))) {
    throw new Error("selected_case_ids does not exactly match the expected cases.");
  }
  if (data.results.length !== count) throw new Error(`Expected ${count} results, found ${data.results.length}.`);

  const resultIds = new Set();
  for (const r of data.results) {
    if (!isRecord(r) || typeof r.case_id !== "string" || !expectedIds.has(r.case_id)) {
      throw new Error("Results contain a malformed or unexpected case ID.");
    }
    if (resultIds.has(r.case_id)) throw new Error(`Results contain duplicate case ID: ${r.case_id}.`);
    resultIds.add(r.case_id);
    if (r.status !== "completed") throw new Error(`Result ${r.case_id} is not completed.`);
    if (!isRecord(r.raw_output) || !Array.isArray(r.raw_output.ideas)) {
      throw new Error(`Result ${r.case_id} has no valid raw_output ideas.`);
    }
    if (!replay && (!isRecord(r.output) || !Array.isArray(r.output.ideas))) {
      throw new Error(`Result ${r.case_id} has no valid stored ideas output.`);
    }
  }
  if (expected.some((c) => !resultIds.has(c.id))) throw new Error("Results are missing one or more expected cases.");
  return new Map(expected.map((c) => [c.id, c]));
}

function main() {
  try {
    const a = args(process.argv.slice(2));
    if (!a.results) throw new Error("Usage: node scripts/engine-metrics.js --results=<benchmark-results.json> [--cases-file=...] [--case-set=<set>] [--expected-cases=<count>] [--replay] [--json=out.json]");
    const data = JSON.parse(fs.readFileSync(path.resolve(a.results), "utf8"));
    const caseRows = JSON.parse(fs.readFileSync(path.resolve(a.casesFile), "utf8"));
    const cases = validateBenchmarkData(data, caseRows, a);
    const rows = data.results.map((r) => {
      const c = cases.get(r.case_id);
      const input = normaliseInput(c.input).value;
      const ideas = a.replay ? runEngine(r.raw_output, input, { truncated: r.truncated }).ideas : r.output.ideas;
      return {
        case_id: r.case_id,
        set: c.set || "",
        status: r.status,
        truncated: typeof r.truncated === "boolean" ? r.truncated : null,
        stored_generation_cost_usd: r.estimated_cost_usd || 0,
        ...listMetrics(ideas, input),
      };
    });
    const bySet = {};
    for (const r of rows) (bySet[r.set || "all"] ||= []).push(r);
    const report = {
      source: path.relative(ROOT, path.resolve(a.results)).replaceAll("\\", "/"),
      mode: a.replay ? "replayed through current engine" : "as stored",
      prompt_version: data.prompt_version,
      overall: {
        ...summarise(rows),
        ...summariseCompletion(rows),
        stored_generation_total_cost_usd: Math.round(rows.reduce((sum, row) => sum + row.stored_generation_cost_usd, 0) * 1e6) / 1e6,
      },
      by_set: Object.fromEntries(Object.entries(bySet).map(([k, v]) => [k, summarise(v)])),
      cases: rows,
    };
    if (a.json) fs.writeFileSync(path.resolve(a.json), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ source: report.source, mode: report.mode, overall: report.overall, by_set: report.by_set }, null, 2));
  } catch (error) {
    console.error(`Benchmark integrity error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
