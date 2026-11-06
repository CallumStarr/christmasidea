import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseInput } from "../src/core.js";
import { runEngine } from "../src/engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const EVALUATION_QUESTION = "Would these recommendations make you feel that Santa’s Helper understood this recipient and helped you discover gifts you might not have considered?";
const AXES = [
  "recipient_fit",
  "thoughtfulness",
  "originality",
  "meaningful_diversity",
  "constraint_adherence",
  "budget_suitability",
  "product_search_usefulness",
  "portfolio_helpfulness",
  "understood_recipient",
];
const HEADERS = [
  "case_id",
  "case_name",
  "recipient_request",
  "evaluation_focus",
  "evaluation_question",
  "ideas_A",
  "ideas_B",
  ...AXES.flatMap((axis) => [`${axis}_A_1_to_5`, `${axis}_B_1_to_5`]),
  "shortlisted_ideas_A_0_to_8",
  "shortlisted_ideas_B_0_to_8",
  "overall_preference_A_B_equal_neither",
  "confidence_1_to_5",
  "reviewer_notes",
];

function stableHash(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderIdeas(ideas) {
  return ideas.map((idea, index) =>
    `${index + 1}. ${idea.title}\n   ${idea.why || ""}\n   Product search: ${idea.query || idea.search_query || ""}`,
  ).join("\n\n");
}

export function buildPairedReview({ cases, baselineCases, baselineResults, currentResults, seed = "santas-helper-paired-review-v1" }) {
  const sharedCases = cases.filter((item) => item.set === "v3.3-original");
  if (sharedCases.length !== 30) throw new Error(`Expected 30 shared v3.3 scenarios, found ${sharedCases.length}.`);

  const baselineCaseById = new Map(baselineCases.map((item) => [item.id, item]));
  const rows = [];
  const key = { seed, versions: {} };

  for (const item of sharedCases) {
    const oldCase = baselineCaseById.get(item.id);
    const oldResult = baselineResults.find((result) => result.case_id === item.id && result.model_key === "haiku");
    const currentResult = currentResults.find((result) => result.case_id === item.id && result.model_key === "haiku");
    if (!oldCase || !oldResult || !currentResult || oldResult.status !== "completed" || currentResult.status !== "completed") {
      throw new Error(`Missing a completed Haiku result for ${item.id}.`);
    }
    if (JSON.stringify(oldCase.input) !== JSON.stringify(item.input)) {
      throw new Error(`Scenario ${item.id} differs from the preserved v3.3 benchmark input.`);
    }
    if (!Array.isArray(oldResult.output?.ideas) || !currentResult.raw_output) {
      throw new Error(`Stored ideas are missing for ${item.id}.`);
    }

    const parsed = normaliseInput(item.input);
    if (!parsed.ok) throw new Error(`Invalid benchmark input for ${item.id}: ${parsed.error}`);
    const ideasV34 = runEngine(currentResult.raw_output, parsed.value, { truncated: currentResult.truncated }).ideas;
    const ideasV33 = oldResult.output.ideas;
    const currentFirst = stableHash(`${seed}:${item.id}:side`) % 2 === 0;
    const ideasA = currentFirst ? ideasV34 : ideasV33;
    const ideasB = currentFirst ? ideasV33 : ideasV34;
    key.versions[item.id] = {
      A: currentFirst ? "v3.4-current-engine" : "v3.3-preserved-baseline",
      B: currentFirst ? "v3.3-preserved-baseline" : "v3.4-current-engine",
    };

    const request = item.input.mode === "describe"
      ? item.input.description
      : [item.input.relation, item.input.age, item.input.budget, item.input.occasion, item.input.interests, item.input.about].filter(Boolean).join(" | ");
    const values = [
      item.id,
      item.name,
      request,
      (item.evaluation_focus || []).join("; "),
      EVALUATION_QUESTION,
      renderIdeas(ideasA),
      renderIdeas(ideasB),
      ...AXES.flatMap(() => ["", ""]),
      "",
      "",
      "",
      "",
      "",
    ];
    rows.push({ sort: stableHash(`${seed}:${item.id}:order`), csv: values.map(csvCell).join(",") });
  }

  rows.sort((a, b) => a.sort - b.sort || a.csv.localeCompare(b.csv));
  const csv = [HEADERS.map(csvCell).join(","), ...rows.map((row) => row.csv)].join("\n") + "\n";
  return { csv, key };
}

export function writePairedReview(outputDir, { csv, key }) {
  const output = path.join(outputDir, "paired-blind-review.csv");
  const keyPath = path.join(outputDir, "paired-blind-key.json");
  if (fs.existsSync(output) || fs.existsSync(keyPath)) {
    throw new Error("Refusing to overwrite an existing paired review or key. Choose a fresh --output-dir.");
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(output, csv, { flag: "wx" });
  fs.writeFileSync(keyPath, JSON.stringify(key, null, 2) + "\n", { flag: "wx" });
  return { output, keyPath };
}

async function main() {
  const args = process.argv.slice(2);
  let outputDir = path.join(ROOT, "benchmarks", "v3.4");
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--output-dir" || !args[1].trim()) {
      throw new Error("Usage: node scripts/create-paired-review.js [--output-dir <new-directory>]");
    }
    outputDir = path.resolve(args[1]);
  }
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "v3.4", "cases.json"), "utf8"));
  const legacyCases = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "recipients.json"), "utf8"));
  const byLegacyCase = new Map(legacyCases.map((item) => [item.id, item]));
  const compareCases = cases.filter((item) => item.set === "v3.3-original");
  if (compareCases.some((item) => !byLegacyCase.has(item.id))) throw new Error("A v3.3 baseline case is missing.");

  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "baselines", "v3.3-pre-refactor", "benchmark-results.json"), "utf8"));
  const current = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "v3.4", "live-haiku", "benchmark-results.json"), "utf8"));
  const result = buildPairedReview({
    cases: compareCases,
    baselineCases: legacyCases,
    baselineResults: baseline.results,
    currentResults: current.results,
  });
  const { output, keyPath } = writePairedReview(outputDir, result);
  console.log(`Created ${path.relative(ROOT, output)} with 30 blind pairs.`);
  console.log(`Keep ${path.relative(ROOT, keyPath)} separate from reviewers until scoring is complete.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
