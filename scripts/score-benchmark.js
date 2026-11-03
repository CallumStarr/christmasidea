#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CRITERIA = [
  ["recipient_fit_1_to_5", 0.25, "Recipient fit"],
  ["budget_fit_1_to_5", 0.15, "Budget fit"],
  ["variety_1_to_5", 0.15, "Variety"],
  ["originality_1_to_5", 0.10, "Originality"],
  ["constraints_and_age_safety_1_to_5", 0.15, "Constraints / age safety"],
  ["amazon_search_usefulness_1_to_5", 0.10, "Amazon search usefulness"],
  ["summary_accuracy_1_to_5", 0.10, "Recipient summary accuracy"],
];

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (quoted) throw new Error("CSV has an unterminated quoted field.");
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one review row.");
  const headers = rows.shift();
  if (headers[0]?.startsWith("\uFEFF")) headers[0] = headers[0].slice(1);
  return rows.filter((r) => r.some((v) => v.trim() !== "")).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function weightedScore(row) {
  let total = 0;
  for (const [key, weight] of CRITERIA) {
    const value = Number(row[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error(`Row ${row.case_id} / ${row.blind_model}: '${key}' must be an integer from 1 to 5 (received '${row[key]}').`);
    }
    total += value * weight;
  }
  return Number(total.toFixed(3));
}

const KNOWN_LABELS = { haiku: "Claude Haiku 5.5", sonnet: "Claude Sonnet 5.5" };

/** Accepts the legacy key ({case: {haiku: "A"}}) and the format-2 key ({cases, variants}). */
export function readBlindKey(blindKey) {
  const cases = blindKey && blindKey.cases ? blindKey.cases : blindKey;
  const variants = (blindKey && blindKey.variants) || {};
  return { cases, labelFor: (key) => variants[key]?.label || KNOWN_LABELS[key] || key };
}

/** Pure scoring: rows are parsed CSV rows. Works for any pair (or set) of variants named in the key. */
export function scoreRows(rows, blindKey) {
  const { cases: caseMap, labelFor } = readBlindKey(blindKey);
  for (const row of rows) row.weighted_score = weightedScore(row);

  const variantKeys = new Set();
  for (const row of rows) {
    const label = String(row.blind_model).replace(/^Model\s+/i, "").toUpperCase();
    const mapping = caseMap[row.case_id];
    if (!mapping || !["A", "B"].includes(label)) throw new Error(`Missing blind-key mapping for ${row.case_id} / ${row.blind_model}.`);
    const actualKey = Object.entries(mapping).find(([, blindLabel]) => blindLabel === label)?.[0];
    if (!actualKey) throw new Error(`Could not map ${row.case_id} / Model ${label} to a variant.`);
    row.variant_key = actualKey;
    variantKeys.add(actualKey);
  }

  const summaries = {};
  for (const key of variantKeys) {
    const subset = rows.filter((r) => r.variant_key === key);
    summaries[key] = {
      label: labelFor(key),
      reviewed_rows: subset.length,
      weighted_average: Number((subset.reduce((sum, r) => sum + r.weighted_score, 0) / subset.length).toFixed(3)),
      criteria: Object.fromEntries(CRITERIA.map(([field, , label]) => [label, Number((subset.reduce((sum, r) => sum + Number(r[field]), 0) / subset.length).toFixed(3))])),
    };
  }

  const perCase = new Map();
  for (const row of rows) {
    if (!perCase.has(row.case_id)) perCase.set(row.case_id, {});
    perCase.get(row.case_id)[row.variant_key] = row.weighted_score;
  }
  const keys = [...variantKeys];
  const wins = Object.fromEntries(keys.map((k) => [k, 0]));
  let ties = 0;
  let paired = 0;
  if (keys.length === 2) {
    const [a, b] = keys;
    for (const pair of perCase.values()) {
      if (pair[a] === undefined || pair[b] === undefined) continue;
      paired++;
      if (Math.abs(pair[a] - pair[b]) < 0.001) ties++;
      else if (pair[a] > pair[b]) wins[a]++;
      else wins[b]++;
    }
  }
  return { summaries, paired_case_results: { wins, ties, paired_cases: paired }, variantKeys: keys };
}

async function main() {
  const file = process.argv[2];
  if (!file || file === "--help") {
    console.log("Usage: npm run benchmark:score -- <path-to-review-csv>\n\nFill in all seven 1-5 scoring columns in the CSV first. The script uses blind-key.json in the same folder to unblind the Model A / Model B labels after scoring. It works for model comparisons and for prompt-version comparisons.");
    return;
  }
  const csvPath = path.resolve(file);
  const directory = path.dirname(csvPath);
  const [csv, keyText] = await Promise.all([
    fs.readFile(csvPath, "utf8"),
    fs.readFile(path.join(directory, "blind-key.json"), "utf8"),
  ]);
  const { summaries, paired_case_results: paired, variantKeys } = scoreRows(parseCsv(csv), JSON.parse(keyText));

  const report = {
    created_at: new Date().toISOString(),
    scoring: "Weighted mean of seven subjective 1-5 ratings: recipient fit 25%, budget fit 15%, variety 15%, originality 10%, constraints/age safety 15%, search usefulness 10%, summary accuracy 10%. AI-led or manual review of synthetic cases; not statistically validated.",
    summaries,
    paired_case_results: paired,
  };
  await fs.writeFile(path.join(directory, "score-summary.json"), JSON.stringify(report, null, 2));

  console.log("\nChristmasIdea benchmark score (subjective review; not statistically significant)\n");
  for (const key of variantKeys) {
    console.log(`${summaries[key].label}: ${summaries[key].weighted_average.toFixed(3)} / 5 across ${summaries[key].reviewed_rows} reviews`);
    for (const [name, value] of Object.entries(summaries[key].criteria)) console.log(`  ${name}: ${value.toFixed(2)} / 5`);
  }
  if (variantKeys.length === 2) {
    console.log(`\nPaired wins: ${variantKeys.map((k) => `${summaries[k].label} ${paired.wins[k]}`).join(" · ")} · ties ${paired.ties}`);
    const [a, b] = variantKeys;
    const delta = summaries[b].weighted_average - summaries[a].weighted_average;
    if (Math.abs(delta) < 0.15) console.log("Result: no meaningful average-score difference is evident.");
    else {
      const [leader, trailer] = delta > 0 ? [b, a] : [a, b];
      console.log(`Result: ${summaries[leader].label} leads ${summaries[trailer].label} by ${Math.abs(delta).toFixed(3)} points. Check per-criterion scores and the deterministic metrics before acting.`);
    }
  }
  console.log(`\nSaved ${path.join(directory, "score-summary.json")}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`\nScoring stopped: ${error.message || error}`);
    process.exitCode = 1;
  });
}
