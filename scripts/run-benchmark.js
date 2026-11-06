#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  GIFT_TOOL,
  STRICT_GIFT_TOOL,
  buildClaudeRequest,
  generationParams,
  PROMPT_VERSION,
  DEFAULT_MAX_OUTPUT_TOKENS,
  resolveEffort,
  VALIDATOR_VERSION,
  ENGINE_VERSION,
  CANDIDATE_COUNT,
  buildUserMessage,
  normaliseInput,
  sanitiseIdeas,
  curateIdeas,
  promptHints,
  runEngine,
  understand,
} from "../src/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASES_PATH = path.join(ROOT, "benchmarks", "recipients.json");
export const MODELS = {
  haiku: { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", input: 0.10, output: 0.50, forceTool: true },
  sonnet: { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", input: 2.00, output: 10.00, forceTool: false },
};

// Protocol 4: Haiku is benchmarked with exactly the production request (forced strict tool, shared
// thinking/effort/limit). Sonnet 5.5 cannot force a tool, so it alone uses tool_choice=auto.
// Protocol 5 evaluates the experimental v4 prompt and Gift Intelligence Engine.
// Production currently selects the preserved baseline-v3.3 path instead.
export const BENCHMARK_PROTOCOL_VERSION = 5;

/** The experimental engine's user message, including server-side discovery hints. */
export function productionUserMessage(input) {
  return buildUserMessage(input, promptHints(understand(input)));
}

export const BENCHMARK_GIFT_TOOL = STRICT_GIFT_TOOL;

// Matches the production default so truncation seen here is truncation visitors would see.
export function benchmarkMaxTokens() {
  return Number(process.env.BENCHMARK_MAX_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS;
}

export function benchmarkEffort() {
  return resolveEffort(process.env.BENCHMARK_EFFORT);
}

export function buildBenchmarkRequest(model, userMessage) {
  return buildClaudeRequest({
    model: model.id,
    userMessage,
    maxTokens: benchmarkMaxTokens(),
    effort: benchmarkEffort(),
    forceTool: model.forceTool !== false,
  });
}

function parseArgs(argv) {
  const out = { live: false, confirmCost: false, limit: null, cases: [], models: ["haiku"], resume: "", output: "" };
  for (const arg of argv) {
    if (arg === "--live") out.live = true;
    else if (arg === "--confirm-cost") out.confirmCost = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.slice(8));
    else if (arg.startsWith("--case=")) out.cases.push(arg.slice(7));
    else if (arg.startsWith("--models=")) out.models = arg.slice(9).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--resume=")) out.resume = arg.slice(9);
    else if (arg.startsWith("--output=")) out.output = arg.slice(9);
    else if (arg.startsWith("--cases-file=")) out.casesFile = arg.slice(13);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (out.limit !== null && (!Number.isInteger(out.limit) || out.limit < 1)) throw new Error("--limit must be a positive integer.");
  for (const model of out.models) if (!MODELS[model]) throw new Error(`Unknown model '${model}'. Choose: ${Object.keys(MODELS).join(", ")}.`);
  if (!out.models.length) throw new Error("Select at least one model with --models=haiku,sonnet.");
  return out;
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function tokenSet(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
}

function titleSimilarity(a, b) {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const word of aa) if (bb.has(word)) overlap++;
  return overlap / (aa.size + bb.size - overlap);
}

export function assessOutput(raw, caseInput, expected = CANDIDATE_COUNT) {
  const flags = [];
  const items = Array.isArray(raw?.ideas) ? raw.ideas : [];
  if (!items.length) flags.push("no_ideas_returned");
  if (items.length !== expected) flags.push(`candidate_count_not_${expected}_generated_${items.length}`);
  if (items.length > expected) flags.push(`more_than_${expected}_candidates`);
  if (items.length > 0 && items.length < 6) flags.push("fewer_than_6_ideas_review_whether_insufficient_info");
  if (typeof raw?.recipient_summary !== "string" || raw.recipient_summary.length > 180) flags.push("invalid_or_overlong_recipient_summary");

  const titles = new Set();
  const queries = new Set();
  for (let index = 0; index < items.length; index++) {
    const item = items[index] || {};
    const title = String(item.title || "").trim();
    const why = String(item.why || "").trim();
    const query = String(item.search_query || "").trim().toLowerCase();
    if (!title || !why || !query) flags.push(`idea_${index + 1}_missing_required_text`);
    if (title.length > 60) flags.push(`idea_${index + 1}_title_over_60_chars`);
    if (wordCount(why) > 35) flags.push(`idea_${index + 1}_why_over_35_words`);
    if (wordCount(query) < 2 || wordCount(query) > 6) flags.push(`idea_${index + 1}_search_query_not_2_to_6_words`);
    if (titles.has(title.toLowerCase())) flags.push("duplicate_title");
    if (queries.has(query)) flags.push("duplicate_search_query");
    titles.add(title.toLowerCase());
    queries.add(query);
    if (item.category && !GIFT_TOOL.input_schema.properties.ideas.items.properties.category.enum.includes(item.category)) {
      flags.push(`idea_${index + 1}_invalid_category`);
    }
    if (/\b(gift card|voucher|alcohol|wine|beer|tobacco|vape|weapon|knife|medicine|supplement|gambling)\b/i.test(title)) {
      flags.push(`idea_${index + 1}_potentially_disallowed_or_safety_sensitive_title_review`);
    }
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (titleSimilarity(items[i]?.title, items[j]?.title) >= 0.72) {
        flags.push(`ideas_${i + 1}_and_${j + 1}_possibly_near_duplicates`);
      }
    }
  }
  if (caseInput.mode === "describe" && !caseInput.description) flags.push("benchmark_case_missing_description");
  return [...new Set(flags)];
}

function stableBlindLabel(caseId, modelKey) {
  // Stable per case, but reversed between cases, so the same model is not always A.
  const parity = [...caseId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 2;
  const firstKey = parity === 0 ? "haiku" : "sonnet";
  return modelKey === firstKey ? "A" : "B";
}

export function renderReviewCsv(results, cases, key, expected = CANDIDATE_COUNT) {
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const headers = [
    "case_id", "case_name", "blind_model", "recipient_request", "evaluation_focus", "recipient_summary",
    "idea_count", "ideas_title_why_search", "automatic_warnings",
    "recipient_fit_1_to_5", "budget_fit_1_to_5", "variety_1_to_5", "originality_1_to_5",
    "constraints_and_age_safety_1_to_5", "amazon_search_usefulness_1_to_5", "summary_accuracy_1_to_5", "reviewer_notes",
  ];
  const rows = [headers.join(",")];
  for (const result of results.filter((r) => r.status === "completed" || r.status === "truncated")) {
    const c = caseById.get(result.case_id);
    const label = key[result.case_id]?.[result.model_key] || result.model_key;
    const request = c.input.mode === "describe"
      ? c.input.description
      : [c.input.relation, c.input.age, c.input.budget, c.input.occasion, c.input.interests, c.input.about].filter(Boolean).join(" | ");
    const focus = (c.evaluation_focus || []).join("; ");
    const ideas = (result.output?.ideas || []).map((idea, i) => `${i + 1}. ${idea.title} — ${idea.why} [Product search: ${idea.search_query || idea.query || ""}]`).join("\n");
    const warnings = [...(result.auto_flags || [])];
    const generated = Array.isArray(result.raw_output?.ideas) ? result.raw_output.ideas.length : null;
    if (generated !== null && generated !== expected) {
      const countWarning = `candidate_count_not_${expected}_generated_${generated}`;
      if (!warnings.includes(countWarning)) warnings.push(countWarning);
    }
    const row = [
      result.case_id, c.name, `Model ${label}`, request, focus, result.output?.recipient_summary || "",
      (result.output?.ideas || []).length, ideas, warnings.join("; "),
      "", "", "", "", "", "", "", "",
    ];
    rows.push(row.map(csvCell).join(","));
  }
  return rows.join("\r\n") + "\r\n";
}

function estimateCost(result, model) {
  const usage = result.usage || {};
  const input = Number(usage.input_tokens || 0);
  const output = Number(usage.output_tokens || 0);
  const cacheRead = Number(usage.cache_read_input_tokens || 0);
  const cacheWrite5m = Number(usage.cache_creation_input_tokens || usage.cache_creation?.ephemeral_5m_input_tokens || 0);
  const cacheWrite1h = Number(usage.cache_creation?.ephemeral_1h_input_tokens || 0);
  // Anthropic reports uncached input separately from cache creation/read tokens.
  return (input * model.input + output * model.output + cacheRead * (model.input * 0.1)
    + cacheWrite5m * (model.input * 1.25) + cacheWrite1h * (model.input * 2)) / 1_000_000;
}

/** Builds the stored record for one model response. Truncated responses get their own status so they are never counted as ordinary successes. */
export function buildResultRecord({ caseId, model, response, input, blindLabel, latencyMs }) {
  const truncated = response.stop_reason === "max_tokens";
  const curated = runEngine(response.output, input, { truncated });
  const flags = assessOutput(response.output, input);
  if (curated.diagnostics.shortfall) flags.push(`validated_shortfall_${curated.diagnostics.shortfall_count}`);
  if (truncated) flags.unshift("TRUNCATED_max_tokens");
  return {
    case_id: caseId,
    model_key: model.key,
    model_id: model.id,
    blind_label: blindLabel,
    status: truncated ? "truncated" : "completed",
    latency_ms: latencyMs,
    usage: response.usage,
    thinking_tokens: Number(response.usage?.output_tokens_details?.thinking_tokens || 0),
    effort: benchmarkEffort(),
    estimated_cost_usd: Number(estimateCost(response, model).toFixed(8)),
    stop_reason: response.stop_reason,
    truncated,
    auto_flags: flags,
    // output is what a visitor would see after server-side validation; raw_output is the unfiltered model response.
    output: {
      recipient_summary: curated.recipientSummary,
      ideas: curated.ideas,
      note: curated.note || "",
      recipient: curated.recipient,
    },
    raw_output: response.output,
    validation: curated.diagnostics,
    sanitised_idea_count: curated.ideas.length,
  };
}

async function anthropicCall(model, userMessage) {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(buildBenchmarkRequest(model, userMessage)),
    redirect: "error",
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1200);
    const error = new Error(`Anthropic API returned HTTP ${response.status}: ${detail}`);
    error.status = response.status;
    const retryAfter = response.headers.get("retry-after");
    error.retryAfterMs = retryAfter && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : 0;
    throw error;
  }
  const data = await response.json();
  const block = Array.isArray(data.content) ? data.content.find((part) => part.type === "tool_use" && part.name === GIFT_TOOL.name) : null;
  if (!block?.input) {
    const text = Array.isArray(data.content)
      ? data.content.filter((part) => part.type === "text").map((part) => part.text).join(" ").slice(0, 300)
      : "";
    const reason = data.stop_reason || "unknown";
    throw new Error(`Model did not call ${GIFT_TOOL.name} (stop_reason=${reason}). ${text || "Check the model response and retry this case."}`);
  }
  return { output: block.input, usage: data.usage || {}, stop_reason: data.stop_reason || null };
}

async function callWithRetry(model, message) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await anthropicCall(model, message);
    } catch (error) {
      lastError = error;
      const retryable = [429, 500, 502, 503, 529].includes(error.status);
      if (!retryable || attempt === 2) break;
      const delay = error.retryAfterMs || (1000 * (2 ** attempt));
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 15_000)));
    }
  }
  throw lastError;
}

function printHelp() {
  console.log(`Santa's Helper benchmark (prompt ${PROMPT_VERSION}, default model: Haiku 5.5 only)\n\nDry run (no API calls):\n  npm run benchmark\n\nLive run (one call per case per model):\n  $env:ANTHROPIC_API_KEY="..."; npm run benchmark -- --live --confirm-cost --models=haiku\n\nSmall live smoke test:\n  npm run benchmark -- --live --confirm-cost --models=haiku --limit=5\n\nOptions:\n  --models=haiku,sonnet  Select models (default: haiku)\n  --case=case-01          Run a specific case (repeatable)\n  --limit=5               Run the first N cases\n  --resume=<results.json> Continue an interrupted run\n  --output=<directory>   Choose a run output directory\n  --cases-file=<json>     Use another case set (e.g. benchmarks/v3.4/cases.json)\n  --live                  Actually call Anthropic\n  --confirm-cost          Required alongside --live\n\nResponses cut off at the token limit are recorded with status "truncated", never as ordinary successes.\nThe live run writes benchmark-results.json, review-template.csv and blind-key.json.\nFor the blind v2-vs-v3 comparison use: npm run benchmark:compare -- --help\nNo model is changed in the production Worker.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  const casesPath = args.casesFile ? path.resolve(args.casesFile) : CASES_PATH;
  const allCases = JSON.parse(await fs.readFile(casesPath, "utf8"));
  let cases = allCases;
  if (args.cases.length) {
    const wanted = new Set(args.cases);
    cases = allCases.filter((c) => wanted.has(c.id));
    const missing = [...wanted].filter((id) => !cases.some((c) => c.id === id));
    if (missing.length) throw new Error(`Unknown case id(s): ${missing.join(", ")}`);
  } else if (args.limit) {
    cases = allCases.slice(0, args.limit);
  }
  if (!cases.length) throw new Error("No benchmark cases selected.");

  const selectedModels = args.models.map((key) => ({ key, ...MODELS[key] }));
  const planned = cases.length * selectedModels.length;
  console.log(`\nSanta's Helper benchmark · prompt ${PROMPT_VERSION} · protocol ${BENCHMARK_PROTOCOL_VERSION}`);
  console.log(`Cases: ${cases.length} / ${allCases.length} | Models: ${selectedModels.map((m) => m.label).join(", ")} | Planned calls: ${planned}`);
  for (const model of selectedModels) console.log(`  ${model.label}: $${model.input.toFixed(2)} input / $${model.output.toFixed(2)} output per million tokens`);

  if (!args.live) {
    console.log(`\nExperimental v4 request protocol: ${BENCHMARK_PROTOCOL_VERSION} (${selectedModels.map((m) => `${m.label}=${m.forceTool ? "forced strict tool" : "tool_choice=auto"}`).join(", ")}; thinking=adaptive, effort=${benchmarkEffort()}, max_tokens=${benchmarkMaxTokens()}).`);
    console.log("This runner does not evaluate the production-selected baseline-v3.3 path.");
    console.log("DRY RUN ONLY — no Anthropic API calls were made.");
    console.log("Run with --live --confirm-cost and ANTHROPIC_API_KEY to execute the comparison.");
    console.log("The test set covers both freeform and guided inputs, budgets, age safety, dislikes, owned items, low-information requests and cross-interest gifts.");
    return;
  }
  if (!args.confirmCost) throw new Error("Live calls require explicit --confirm-cost as well as --live.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY in your environment before running the live benchmark.");

  let outputDir;
  let results = [];
  if (args.resume) {
    const resumeFile = path.resolve(args.resume);
    const saved = JSON.parse(await fs.readFile(resumeFile, "utf8"));
    if (saved.prompt_version !== PROMPT_VERSION) throw new Error(`Cannot resume: saved prompt ${saved.prompt_version} differs from current ${PROMPT_VERSION}.`);
    if (saved.effort !== benchmarkEffort() || saved.max_tokens !== benchmarkMaxTokens()) throw new Error(`Cannot resume: saved run used effort=${saved.effort ?? "unset"} max_tokens=${saved.max_tokens}; current is effort=${benchmarkEffort()} max_tokens=${benchmarkMaxTokens()}. Results under different settings must not be mixed.`);
    if (saved.benchmark_protocol_version !== BENCHMARK_PROTOCOL_VERSION) throw new Error(`Cannot resume: this run used benchmark protocol ${saved.benchmark_protocol_version ?? "legacy"}; current protocol is ${BENCHMARK_PROTOCOL_VERSION}. Start a fresh run so all results use the same request format.`);
    const savedModels = Object.keys(saved.models || {}).sort().join(",");
    const selectedModelKeys = selectedModels.map((m) => m.key).sort().join(",");
    if (savedModels !== selectedModelKeys) throw new Error(`Cannot resume: use the same --models selection as the saved run (${savedModels}).`);
    const savedCases = [...(saved.selected_case_ids || [])].sort().join(",");
    const selectedCaseIds = cases.map((c) => c.id).sort().join(",");
    if (savedCases !== selectedCaseIds) throw new Error("Cannot resume: use the same case selection / --limit as the saved run.");
    results = saved.results || [];
    outputDir = path.dirname(resumeFile);
  } else {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    outputDir = args.output ? path.resolve(args.output) : path.join(ROOT, "benchmarks", "runs", stamp);
    await fs.mkdir(outputDir, { recursive: true });
  }
  await fs.mkdir(outputDir, { recursive: true });
  const resultFile = path.join(outputDir, "benchmark-results.json");
  const completed = new Set(results.filter((r) => r.status === "completed" || r.status === "truncated").map((r) => `${r.case_id}:${r.model_key}`));
  const blindKey = {};
  for (const c of cases) blindKey[c.id] = Object.fromEntries(selectedModels.map((m) => [m.key, stableBlindLabel(c.id, m.key)]));

  const save = async () => {
    const doc = {
      created_at: new Date().toISOString(),
      prompt_version: PROMPT_VERSION,
      validator_version: VALIDATOR_VERSION,
      engine_version: ENGINE_VERSION,
      cases_file: path.relative(ROOT, casesPath),
      max_tokens: benchmarkMaxTokens(),
      thinking: generationParams().thinking,
      effort: benchmarkEffort(),
      benchmark_protocol_version: BENCHMARK_PROTOCOL_VERSION,
      anthropic_api_version: ANTHROPIC_VERSION,
      note: "Haiku uses the production request (forced strict gift_ideas tool, adaptive thinking, shared effort and output limit). Sonnet, which cannot force a tool, uses tool_choice=auto with the same strict schema.",
      tool_choice: Object.fromEntries(selectedModels.map((m) => [m.key, m.forceTool ? "tool:gift_ideas" : "auto"])),
      models: Object.fromEntries(selectedModels.map((m) => [m.key, { id: m.id, label: m.label, input_usd_per_million: m.input, output_usd_per_million: m.output }])),
      selected_case_ids: cases.map((c) => c.id),
      results,
    };
    await fs.writeFile(resultFile, JSON.stringify(doc, null, 2));
    await fs.writeFile(path.join(outputDir, "blind-key.json"), JSON.stringify(blindKey, null, 2));
    await fs.writeFile(path.join(outputDir, "review-template.csv"), renderReviewCsv(results, cases, blindKey));
  };

  await save();
  for (const c of cases) {
    const parsed = normaliseInput(c.input);
    if (!parsed.ok) throw new Error(`Invalid benchmark case ${c.id}: ${parsed.error}`);
    const userMessage = productionUserMessage(parsed.value);
    for (const model of selectedModels) {
      const key = `${c.id}:${model.key}`;
      if (completed.has(key)) {
        console.log(`SKIP ${c.id} · ${model.label} (already completed)`);
        continue;
      }
      // Failed pairs are retried when a resumed run is started.
      const previousIndex = results.findIndex((r) => r.case_id === c.id && r.model_key === model.key);
      if (previousIndex >= 0) results.splice(previousIndex, 1);
      console.log(`RUN  ${c.id} · ${c.name} · ${model.label}`);
      const started = Date.now();
      try {
        const response = await callWithRetry(model, userMessage);
        const record = buildResultRecord({
          caseId: c.id, model, response, input: parsed.value,
          blindLabel: blindKey[c.id][model.key], latencyMs: Date.now() - started,
        });
        const flags = record.auto_flags;
        results.push(record);
        completed.add(key);
        const v = record.validation;
        console.log(`${record.status === "truncated" ? "TRUNC" : "DONE "} ${c.id} · stop=${record.stop_reason} · ${v.raw_count} generated / ${v.accepted} accepted / ${v.rejected_count} rejected · ${record.usage?.output_tokens ?? "?"} output tokens · ${record.latency_ms}ms · estimated $${record.estimated_cost_usd.toFixed(6)}${flags.length ? ` · ${flags.length} review flag(s)` : ""}`);
      } catch (error) {
        results.push({ case_id: c.id, model_key: model.key, model_id: model.id, blind_label: blindKey[c.id][model.key], status: "error", latency_ms: Date.now() - started, error: String(error.message || error) });
        console.error(`ERROR ${c.id} · ${model.label}: ${error.message || error}`);
      }
      await save(); // Checkpoint after every response, so interrupted runs can resume.
    }
  }

  const completedRows = results.filter((r) => r.status === "completed" || r.status === "truncated");
  const totalCost = completedRows.reduce((sum, r) => sum + Number(r.estimated_cost_usd || 0), 0);
  const totalInput = completedRows.reduce((sum, r) => sum + Number(r.usage?.input_tokens || 0), 0);
  const totalOutput = completedRows.reduce((sum, r) => sum + Number(r.usage?.output_tokens || 0), 0);
  const maxOutput = Math.max(0, ...completedRows.map((r) => Number(r.usage?.output_tokens || 0)));
  const truncatedCount = results.filter((r) => r.status === "truncated").length;
  console.log(`\nSaved benchmark to: ${outputDir}`);
  console.log(`Completed: ${completedRows.length - truncatedCount}/${planned} | Truncated: ${truncatedCount} | Errors: ${results.filter((r) => r.status === "error").length}`);
  console.log(`Tokens: ${totalInput.toLocaleString()} input / ${totalOutput.toLocaleString()} output (largest single response: ${maxOutput} of ${benchmarkMaxTokens()} allowed)`);
  if (truncatedCount) console.log(`WARNING: ${truncatedCount} response(s) hit the output limit. Raise MAX_OUTPUT_TOKENS before promoting this prompt.`);
  console.log(`Estimated API total: $${totalCost.toFixed(6)} USD (based on returned token usage and published standard rates; excludes taxes, credits and any account-specific pricing).`);
  console.log("Next: review review-template.csv without opening blind-key.json, score each row from 1–5, then run npm run benchmark:score -- <path-to-review-template.csv>.");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`\nBenchmark stopped: ${error.message || error}`);
    process.exitCode = 1;
  });
}
