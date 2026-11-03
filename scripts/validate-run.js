#!/usr/bin/env node
// Offline replay: runs the deterministic validators over a saved benchmark run. No API calls.
//
//   node scripts/validate-run.js benchmarks/runs/<run>/benchmark-results.json [--model=haiku] [--detail] [--json]
//
// It reports how often the raw model output would have been rejected, repaired or flagged, so two
// prompt versions can be compared with the same rules. These are mechanical checks, not quality
// scores: a clean result does not mean the gifts are good, and the 7-criterion review stays manual.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curateIdeas, normaliseInput } from "../src/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function loadCases() {
  const cases = JSON.parse(await fs.readFile(path.join(ROOT, "benchmarks", "recipients.json"), "utf8"));
  return new Map(cases.map((c) => [c.id, c]));
}

/** Replays one run and returns aggregate metrics. `modelKey` filters by model. */
export function replayRun(doc, casesById, modelKey) {
  const rows = [];
  for (const r of doc.results || []) {
    if (r.status !== "completed" || (modelKey && r.model_key !== modelKey)) continue;
    const scenario = casesById.get(r.case_id);
    if (!scenario) continue;
    const parsed = normaliseInput(scenario.input);
    // Prefer the raw candidates when the run stored them (v3 runs); otherwise the stored output (v2 runs).
    const raw = r.raw_output || r.output;
    const curated = curateIdeas(raw, parsed.value, { exclude: [] });
    const codes = {};
    for (const issue of curated.diagnostics.issues) {
      const key = `${issue.action}:${issue.code}`;
      codes[key] = (codes[key] || 0) + 1;
    }
    const shown = (raw.ideas || []).slice(0, 8);
    const shownRejected = curated.diagnostics.issues.filter((i) => i.action === "rejected" && i.index < 8).length;
    rows.push({
      case_id: r.case_id,
      model_key: r.model_key,
      candidates: (raw.ideas || []).length,
      shownByModel: shown.length,
      shownRejected,
      returnedAfterValidation: curated.diagnostics.returned,
      summaryReplaced: curated.diagnostics.issues.some((i) => i.code === "summary_unsupported_by_input"),
      codes,
    });
  }
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  const codeTotals = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.codes)) codeTotals[k] = (codeTotals[k] || 0) + v;
  const n = rows.length || 1;
  return {
    results: rows.length,
    avg_candidates: Number((sum((r) => r.candidates) / n).toFixed(2)),
    avg_ideas_the_model_put_first_8: Number((sum((r) => r.shownByModel) / n).toFixed(2)),
    avg_returned_after_validation: Number((sum((r) => r.returnedAfterValidation) / n).toFixed(2)),
    results_with_fewer_than_8_after_validation: rows.filter((r) => r.returnedAfterValidation < 8).length,
    results_with_a_rejected_idea_in_first_8: rows.filter((r) => r.shownRejected > 0).length,
    rejected_ideas_in_first_8: sum((r) => r.shownRejected),
    summaries_replaced: rows.filter((r) => r.summaryReplaced).length,
    issue_totals: Object.fromEntries(Object.entries(codeTotals).sort((a, b) => b[1] - a[1])),
    rows,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.log("Usage: node scripts/validate-run.js <benchmark-results.json> [--model=haiku] [--detail] [--json]");
    return;
  }
  const model = args.find((a) => a.startsWith("--model="))?.slice(8) || "";
  const doc = JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
  const report = replayRun(doc, await loadCases(), model);
  if (args.includes("--json")) return console.log(JSON.stringify(report, null, 2));
  console.log(`\nDeterministic replay · prompt ${doc.prompt_version} · ${model || "all models"} · ${report.results} results`);
  for (const [k, v] of Object.entries(report)) {
    if (["rows", "issue_totals", "results"].includes(k)) continue;
    console.log(`  ${k.replace(/_/g, " ")}: ${v}`);
  }
  console.log("  issue totals:");
  for (const [k, v] of Object.entries(report.issue_totals)) console.log(`    ${String(v).padStart(3)}  ${k}`);
  if (args.includes("--detail")) {
    for (const r of report.rows.filter((x) => Object.keys(x.codes).length)) console.log(`  ${r.case_id} ${r.model_key}: ${JSON.stringify(r.codes)}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
