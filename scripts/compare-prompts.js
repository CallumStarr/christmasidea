#!/usr/bin/env node
// Offline blind comparison of two saved benchmark runs (for example gift-curator-v2 vs gift-curator-v3).
// Makes NO API calls and never writes into the runs it reads.
//
//   node scripts/compare-prompts.js --candidate=<v3 benchmark-results.json> [--baseline=<v2 benchmark-results.json>]
//        [--model=haiku] [--output=<new directory>] [--seed=<text>]
//
// Both runs are replayed through the SAME current validators, so the review shows what a visitor would
// have seen from each prompt. Writes:
//   blind-review.csv        reviewer-facing, Model A / Model B only, no prompt versions
//   blind-key.json          which prompt is A or B (do not open before scoring)
//   comparison-metrics.json deterministic, unblinded metrics (do not open before scoring)
//   comparison-report.md    the same metrics as readable text (do not open before scoring)

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curateIdeas, normaliseInput, VALIDATOR_VERSION } from "../src/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_BASELINE = path.join(ROOT, "benchmarks", "runs", "2026-11-02T23-17-14-316Z", "benchmark-results.json");
export const SCORE_COLUMNS = [
  "recipient_fit_1_to_5", "budget_fit_1_to_5", "variety_1_to_5", "originality_1_to_5",
  "constraints_and_age_safety_1_to_5", "amazon_search_usefulness_1_to_5", "summary_accuracy_1_to_5",
];
export const CSV_HEADERS = [
  "case_id", "case_name", "blind_model", "recipient_request", "evaluation_focus", "recipient_summary", "idea_count",
  "recommendation_titles", "recommendation_descriptions", "amazon_search_queries", "validation_diagnostics",
  ...SCORE_COLUMNS, "reviewer_notes",
];
const SHOWN = 8;

/* ---------- pure helpers (exported for tests) ---------- */

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function requestText(input) {
  return input.mode === "describe"
    ? input.description
    : [input.relation, input.age, input.budget, input.occasion, input.interests, input.about].filter(Boolean).join(" | ");
}

/** Completed or truncated results for one model, keyed by case id. Errors are excluded. */
export function usableResults(doc, modelKey) {
  const map = new Map();
  for (const r of doc.results || []) {
    if (r.status !== "completed" && r.status !== "truncated") continue;
    if (modelKey && r.model_key !== modelKey) continue;
    map.set(r.case_id, r);
  }
  return map;
}

/** Replays one stored result through the current validators. */
export function curateStored(result, scenario) {
  const input = normaliseInput(scenario.input).value;
  const raw = result.raw_output || result.output || {};
  const truncated = Boolean(result.truncated) || result.stop_reason === "max_tokens";
  const curated = curateIdeas(raw, input, { exclude: [], truncated });
  return { curated, truncated };
}

/** Balanced, unpredictable A/B assignment: half the cases (by seeded hash order) show the baseline as A. */
export function assignBlindLabels(caseIds, variantKeys, seed) {
  if (variantKeys.length !== 2) throw new Error("A blind comparison needs exactly two variants.");
  const ranked = [...caseIds].sort((a, b) => {
    const ha = crypto.createHash("sha256").update(`${seed}:${a}`).digest("hex");
    const hb = crypto.createHash("sha256").update(`${seed}:${b}`).digest("hex");
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
  const half = Math.ceil(ranked.length / 2);
  const out = {};
  ranked.forEach((id, i) => {
    const [first, second] = variantKeys;
    out[id] = i < half ? { [first]: "A", [second]: "B" } : { [first]: "B", [second]: "A" };
  });
  return out;
}

const countBy = (items) => items.reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {});

/**
 * Neutral diagnostics for the reviewer. Deliberately omits candidate counts, replacements and spares,
 * which would reveal which prompt (8 vs 10 candidates) produced the output.
 */
export function describeDiagnostics(curated, truncated) {
  const d = curated.diagnostics;
  const rejectedCodes = [...new Set(d.rejected.flatMap((r) => r.codes))];
  const byAction = (action) => [...new Set(d.issues.filter((i) => i.action === action).map((i) => i.code))];
  const parts = [`shown: ${d.accepted}`];
  if (d.rejected_count) parts.push(`rejected by validator: ${d.rejected_count} (${rejectedCodes.join(", ")})`);
  const repaired = [...byAction("repaired"), ...byAction("removed")];
  if (repaired.length) parts.push(`repairs: ${repaired.join(", ")}`);
  const warned = byAction("warned");
  if (warned.length) parts.push(`warnings: ${warned.join(", ")}`);
  if (byAction("replaced").length) parts.push(`summary replaced: ${byAction("replaced").join(", ")}`);
  if (truncated) parts.push("RESPONSE WAS CUT OFF AT THE OUTPUT LIMIT");
  return parts.join(" | ");
}

export function renderBlindCsv({ caseIds, cases, views, labels, variantKeys }) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const rows = [CSV_HEADERS.join(",")];
  for (const id of caseIds) {
    const scenario = byId.get(id);
    const ordered = [...variantKeys].sort((a, b) => labels[id][a].localeCompare(labels[id][b]));
    for (const key of ordered) {
      const { curated, truncated } = views[key].get(id);
      const numbered = (fn) => curated.ideas.map((idea, i) => `${i + 1}. ${fn(idea)}`).join("\n");
      rows.push([
        id, scenario.name, `Model ${labels[id][key]}`, requestText(scenario.input), (scenario.evaluation_focus || []).join("; "),
        curated.recipientSummary, curated.ideas.length,
        numbered((i) => i.title), numbered((i) => i.why), numbered((i) => i.query),
        describeDiagnostics(curated, truncated),
        ...SCORE_COLUMNS.map(() => ""), "",
      ].map(csvCell).join(","));
    }
  }
  return `${rows.join("\r\n")}\r\n`;
}

/** Deterministic, unblinded metrics for one variant. */
export function summariseVariant(rows) {
  const n = rows.length || 1;
  const sum = (fn) => rows.reduce((t, r) => t + fn(r), 0);
  const mean = (fn) => Number((sum(fn) / n).toFixed(3));
  const rejectCodes = countBy(rows.flatMap((r) => r.curated.diagnostics.rejected.flatMap((x) => x.codes)));
  const issueCodes = (action) => countBy(rows.flatMap((r) => r.curated.diagnostics.issues.filter((i) => i.action === action).map((i) => i.code)));
  const withUsage = rows.filter((r) => r.usage && Number.isFinite(Number(r.usage.output_tokens)));
  return {
    cases: rows.length,
    truncated_cases: rows.filter((r) => r.truncated).length,
    mean_candidates_generated: mean((r) => r.curated.diagnostics.raw_count),
    mean_shown: mean((r) => r.curated.ideas.length),
    cases_with_full_eight: rows.filter((r) => r.curated.ideas.length >= SHOWN).length,
    cases_below_eight: rows.filter((r) => r.curated.ideas.length < SHOWN).length,
    min_shown: rows.length ? Math.min(...rows.map((r) => r.curated.ideas.length)) : 0,
    // How often the model's own first eight ideas failed validation: a measure of prompt compliance.
    mean_rejected_within_first_eight: mean((r) => r.curated.diagnostics.rejected.filter((x) => x.index < SHOWN).length),
    mean_rejected_total: mean((r) => r.curated.diagnostics.rejected_count),
    mean_replacements_used: mean((r) => r.curated.diagnostics.replacements_used),
    cases_with_any_rejection_in_first_eight: rows.filter((r) => r.curated.diagnostics.rejected.some((x) => x.index < SHOWN)).length,
    summaries_replaced: rows.filter((r) => r.curated.diagnostics.issues.some((i) => i.code === "summary_unsupported_by_input")).length,
    mean_distinct_categories_shown: mean((r) => new Set(r.curated.ideas.map((i) => i.category)).size),
    rejection_reasons: rejectCodes,
    repairs: { ...issueCodes("repaired"), ...issueCodes("removed") },
    warnings: issueCodes("warned"),
    tokens: {
      calls_with_usage: withUsage.length,
      mean_input: withUsage.length ? Math.round(withUsage.reduce((t, r) => t + Number(r.usage.input_tokens || 0), 0) / withUsage.length) : null,
      mean_output: withUsage.length ? Math.round(withUsage.reduce((t, r) => t + Number(r.usage.output_tokens || 0), 0) / withUsage.length) : null,
      max_output: withUsage.length ? Math.max(...withUsage.map((r) => Number(r.usage.output_tokens || 0))) : null,
      mean_cost_usd: withUsage.length ? Number((withUsage.reduce((t, r) => t + Number(r.estimated_cost_usd || 0), 0) / withUsage.length).toFixed(6)) : null,
    },
  };
}

export function renderReport({ metrics, variants, caveats, sharedCaseCount }) {
  const keys = Object.keys(metrics);
  const row = (label, fn) => `| ${label} | ${keys.map((k) => fn(metrics[k])).join(" | ")} |`;
  const topCodes = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ×${n}`).join(", ") || "none";
  return [
    "# Prompt comparison — deterministic metrics (UNBLINDED)",
    "",
    "Do not open this file until the blind review has been scored.",
    "",
    `Cases compared: ${sharedCaseCount}. Validator: ${VALIDATOR_VERSION}. Both variants were replayed through the same validators.`,
    "These are mechanical checks, not quality scores. The seven-criterion review remains an AI-led, subjective evaluation, and 30 synthetic cases cannot establish statistical significance.",
    "",
    `| Measure | ${keys.map((k) => `${k} (${variants[k].label})`).join(" | ")} |`,
    `|---|${keys.map(() => "---:").join("|")}|`,
    row("Cases", (m) => m.cases),
    row("Truncated responses", (m) => m.truncated_cases),
    row("Mean candidates generated", (m) => m.mean_candidates_generated),
    row("Mean ideas shown", (m) => m.mean_shown),
    row("Cases showing a full eight", (m) => m.cases_with_full_eight),
    row("Cases below eight", (m) => m.cases_below_eight),
    row("Fewest ideas shown in any case", (m) => m.min_shown),
    row("Mean rejected within model's first eight (compliance)", (m) => m.mean_rejected_within_first_eight),
    row("Cases with a rejection in the first eight", (m) => m.cases_with_any_rejection_in_first_eight),
    row("Mean rejected overall", (m) => m.mean_rejected_total),
    row("Mean replacement ideas used", (m) => m.mean_replacements_used),
    row("Summaries replaced", (m) => m.summaries_replaced),
    row("Mean distinct categories shown", (m) => m.mean_distinct_categories_shown),
    row("Mean input tokens", (m) => m.tokens.mean_input ?? "n/a"),
    row("Mean output tokens", (m) => m.tokens.mean_output ?? "n/a"),
    row("Largest output (tokens)", (m) => m.tokens.max_output ?? "n/a"),
    row("Mean estimated cost per call (USD)", (m) => m.tokens.mean_cost_usd ?? "n/a"),
    "",
    "## Rejection reasons",
    ...keys.map((k) => `- **${k}**: ${topCodes(metrics[k].rejection_reasons)}`),
    "",
    "## Repairs and warnings",
    ...keys.map((k) => `- **${k}** repairs: ${topCodes(metrics[k].repairs)}; warnings: ${topCodes(metrics[k].warnings)}`),
    "",
    "## How to read this fairly",
    ...caveats.map((c) => `- ${c}`),
    "",
  ].join("\n");
}

export const CAVEATS = [
  "v3 generates ten candidates and shows the best eight valid ones; v2 generated eight. Compare 'rejected within first eight' for prompt compliance, and 'ideas shown' for what visitors receive.",
  "v2 outputs contain no estimated price, concept, based_on or angle fields, so the budget-estimate, invented-basis and angle-variety checks can only act on v3. Rejections for those reasons are not evidence that v2 was better.",
  "A full eight ideas is not a quality measure on its own: replacements can dilute quality, and rejecting ideas is not an improvement if the rejected ideas were good. Read the rejection reasons.",
  "The validators are heuristic. Inspect comparison-metrics.json (rejected titles and reasons) to separate genuine catches from false positives before drawing conclusions.",
  "Human or AI scoring of the blind CSV is subjective. Do not claim statistical significance from 30 synthetic cases.",
];

/* ---------- command line ---------- */

function parseArgs(argv) {
  const out = { baseline: DEFAULT_BASELINE, candidate: "", model: "haiku", output: "", seed: "" };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg.startsWith("--baseline=")) out.baseline = arg.slice(11);
    else if (arg.startsWith("--candidate=")) out.candidate = arg.slice(12);
    else if (arg.startsWith("--model=")) out.model = arg.slice(8);
    else if (arg.startsWith("--output=")) out.output = arg.slice(9);
    else if (arg.startsWith("--seed=")) out.seed = arg.slice(7);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
}

export async function buildComparison({ baselineDoc, candidateDoc, cases, model, seed, baselineFile = "", candidateFile = "" }) {
  const baseKey = baselineDoc.prompt_version;
  const candKey = candidateDoc.prompt_version;
  if (!baseKey || !candKey) throw new Error("Both runs must record a prompt_version.");
  if (baseKey === candKey) throw new Error(`Both runs use prompt ${baseKey}; compare two different prompt versions.`);
  const byId = new Map(cases.map((c) => [c.id, c]));
  const stored = { [baseKey]: usableResults(baselineDoc, model), [candKey]: usableResults(candidateDoc, model) };
  const caseIds = [...stored[baseKey].keys()].filter((id) => stored[candKey].has(id) && byId.has(id)).sort();
  if (!caseIds.length) throw new Error("The two runs share no usable cases for that model.");

  const views = {};
  for (const key of [baseKey, candKey]) {
    views[key] = new Map(caseIds.map((id) => {
      const result = stored[key].get(id);
      return [id, { ...curateStored(result, byId.get(id)), usage: result.usage, estimated_cost_usd: result.estimated_cost_usd }];
    }));
  }
  const variantKeys = [baseKey, candKey];
  const labels = assignBlindLabels(caseIds, variantKeys, seed);
  const flatRows = (key) => caseIds.map((id) => {
    const v = views[key].get(id);
    return { curated: v.curated, truncated: v.truncated, usage: v.usage, estimated_cost_usd: v.estimated_cost_usd };
  });
  const metrics = Object.fromEntries(variantKeys.map((k) => [k, summariseVariant(flatRows(k))]));
  const variants = {
    [baseKey]: { label: `${baseKey} · ${model}`, prompt_version: baseKey, source_run: baselineFile, role: "baseline" },
    [candKey]: { label: `${candKey} · ${model}`, prompt_version: candKey, source_run: candidateFile, role: "candidate" },
  };
  const perCase = caseIds.map((id) => ({
    case_id: id,
    ...Object.fromEntries(variantKeys.map((k) => {
      const v = views[k].get(id);
      return [k, {
        shown: v.curated.ideas.length,
        truncated: v.truncated,
        rejected: v.curated.diagnostics.rejected,
        malformed: v.curated.diagnostics.malformed,
        shown_titles: v.curated.ideas.map((i) => i.title),
      }];
    })),
  }));
  return {
    caseIds, views, labels, variantKeys, variants, metrics, perCase,
    csv: renderBlindCsv({ caseIds, cases, views, labels, variantKeys }),
    key: {
      format: 2,
      note: "Maps Model A / Model B to the prompt version for each case. Do not open before scoring.",
      seed, validator_version: VALIDATOR_VERSION, model, variants, cases: labels,
    },
    report: renderReport({ metrics, variants, caveats: CAVEATS, sharedCaseCount: caseIds.length }),
  };
}

function printHelp() {
  console.log(`Offline blind comparison of two benchmark runs (no API calls).

  node scripts/compare-prompts.js --candidate=<v3 benchmark-results.json>
        [--baseline=<results.json>]   default: the historical gift-curator-v2 run
        [--model=haiku] [--output=<new directory>] [--seed=<text>]

Writes blind-review.csv, blind-key.json, comparison-metrics.json and comparison-report.md into a NEW
directory under benchmarks/comparisons/. Never overwrites an existing directory or either input run.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.candidate) throw new Error("--candidate=<benchmark-results.json> is required (see --help).");
  const [baselineDoc, candidateDoc, cases] = await Promise.all([
    readJson(args.baseline), readJson(args.candidate), readJson(path.join(ROOT, "benchmarks", "recipients.json")),
  ]);
  const seed = args.seed || crypto.randomBytes(8).toString("hex");
  const result = await buildComparison({
    baselineDoc, candidateDoc, cases, model: args.model, seed,
    baselineFile: path.relative(ROOT, path.resolve(args.baseline)), candidateFile: path.relative(ROOT, path.resolve(args.candidate)),
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = args.output ? path.resolve(args.output) : path.join(ROOT, "benchmarks", "comparisons", `${result.variantKeys.join("_vs_")}_${stamp}`);
  const runsRoot = path.join(ROOT, "benchmarks", "runs") + path.sep;
  if ((dir + path.sep).startsWith(runsRoot)) throw new Error("Refusing to write into benchmarks/runs; historical runs are read-only.");
  try {
    await fs.mkdir(dir, { recursive: false });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Output directory already exists: ${dir}. Choose a new --output.`);
    if (error.code === "ENOENT") await fs.mkdir(dir, { recursive: true });
    else throw error;
  }
  await fs.writeFile(path.join(dir, "blind-review.csv"), `\uFEFF${result.csv}`);
  await fs.writeFile(path.join(dir, "blind-key.json"), JSON.stringify(result.key, null, 2));
  await fs.writeFile(path.join(dir, "comparison-metrics.json"), JSON.stringify({ validator_version: VALIDATOR_VERSION, variants: result.variants, metrics: result.metrics, per_case: result.perCase, caveats: CAVEATS }, null, 2));
  await fs.writeFile(path.join(dir, "comparison-report.md"), result.report);

  console.log(`Compared ${result.caseIds.length} case(s): ${result.variantKeys.join(" vs ")} (${args.model})`);
  console.log(`Written to ${dir}`);
  console.log("Review blind-review.csv only. Do NOT open blind-key.json, comparison-metrics.json or comparison-report.md until scoring is finished.");
  console.log(`Then score with: npm run benchmark:score -- "${path.join(dir, "blind-review.csv")}"`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`\nComparison stopped: ${error.message || error}`);
    process.exitCode = 1;
  });
}
