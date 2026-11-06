import test from "node:test";
import assert from "node:assert/strict";
import { listMetrics, summarise, summariseCompletion, validateBenchmarkData } from "../scripts/engine-metrics.js";

const input = { mode: "describe", description: "My daughter is 12 and loves astronomy and model rockets. Budget £30." };

test("quality metrics identify near-duplicates and repeated interests without implying human quality", () => {
  const metrics = listMetrics([
    { title: "Astronomy star map", concept: "star map", query: "astronomy star map", category: "Books", strategy: "core-interest" },
    { title: "Astronomy star map poster", concept: "star map poster", query: "astronomy star map poster", category: "Books", strategy: "core-interest" },
    { title: "Model rocket kit", concept: "rocket kit", query: "model rocket kit", category: "Hobbies & crafts", strategy: "adjacent-driver" },
  ], input);
  assert.ok(metrics.near_duplicate_pairs >= 1);
  assert.ok(metrics.repeated_interest_excess >= 1);
  assert.ok(metrics.strategy_balance > 0 && metrics.strategy_balance <= 1);
  assert.equal(metrics.match_cap_over_budget, null);
});

test("strategy balance is unavailable for historical ideas without strategy labels", () => {
  const metrics = listMetrics([{ title: "An original gift idea", category: "Home" }], input);
  assert.equal(metrics.strategy_balance, null);
  assert.equal(metrics.strategy_labels_present, 0);
  assert.equal(metrics.strategy_labels_missing, 1);
});

test("strategy balance normalizes only known labels and reports missing labels", () => {
  const metrics = listMetrics([
    { title: "First idea", strategy: "one" },
    { title: "Second idea", strategy: "two" },
    { title: "Third idea" },
  ], input);
  assert.equal(metrics.strategy_balance, 1);
  assert.equal(metrics.strategy_labels_present, 2);
  assert.equal(metrics.strategy_labels_missing, 1);
});

test("missing or malformed budgets are unassessed, not zero violations", () => {
  const ideas = [{ title: "An idea", productSpec: { maxPriceGbp: 40 } }];
  const assessed = listMetrics(ideas, input);
  const unassessed = listMetrics(ideas, { mode: "describe", description: "My friend loves travel. Budget ?20." });
  assert.equal(assessed.match_cap_over_budget, 1);
  assert.equal(unassessed.match_cap_over_budget, null);
  const combined = summarise([assessed, unassessed]);
  assert.equal(combined.total_match_cap_over_budget, 1);
  assert.equal(combined.budget_assessed_cases, 1);
  assert.equal(combined.budget_partially_assessed_cases, 0);
  assert.equal(combined.budget_unassessed_cases, 1);
  assert.equal(summarise([unassessed]).total_match_cap_over_budget, null);
});

test("missing or malformed idea caps are reported rather than counted as affordable", () => {
  const partial = listMetrics([
    { title: "Known cap", productSpec: { maxPriceGbp: 40 } },
    { title: "Missing cap" },
    { title: "Invalid cap", productSpec: { maxPriceGbp: "20" } },
  ], input);
  assert.equal(partial.match_cap_over_budget, 1);
  assert.equal(partial.budget_assessment, "partial");
  assert.equal(partial.match_caps_assessed, 1);
  assert.equal(partial.match_caps_unassessed, 2);
  const missing = listMetrics([{ title: "No cap" }], input);
  const empty = listMetrics([], input);
  assert.equal(missing.match_cap_over_budget, null);
  assert.equal(empty.match_cap_over_budget, null);
  const summary = summarise([partial, missing, empty]);
  assert.equal(summary.total_match_cap_over_budget, 1);
  assert.equal(summary.budget_assessed_cases, 0);
  assert.equal(summary.budget_partially_assessed_cases, 1);
  assert.equal(summary.budget_unassessed_cases, 2);
  assert.equal(summary.match_caps_assessed, 1);
  assert.equal(summary.match_caps_unassessed, 3);
});

test("completion summary uses reported truncation flags, not completed-only statuses", () => {
  assert.deepEqual(summariseCompletion([
    { status: "completed", truncated: true },
    { status: "completed", truncated: false },
    { status: "completed" },
  ]), {
    truncated: 1,
    truncation_unknown: 1,
    sample_scope: "completed results only; failed or missing attempts are excluded",
  });
});

function fixture() {
  const cases = [
    { id: "one", set: "original", input: { mode: "describe", description: "Gardening" } },
    { id: "two", set: "new", input: { mode: "describe", description: "Astronomy" } },
  ];
  const results = cases.map((c) => ({
    case_id: c.id,
    status: "completed",
    raw_output: { ideas: [] },
    output: { ideas: [] },
  }));
  return {
    cases,
    data: { selected_case_ids: ["one", "two"], results },
  };
}

test("benchmark integrity accepts the complete expected set and supports subset comparisons", () => {
  const { cases, data } = fixture();
  assert.equal(validateBenchmarkData(data, cases).size, 2);
  const subsetData = {
    ...data,
    selected_case_ids: ["one"],
    results: [data.results[0]],
  };
  assert.deepEqual([...validateBenchmarkData(subsetData, cases, {
    caseSet: "original",
    expectedCases: 1,
  }).keys()], ["one"]);
});

test("benchmark integrity rejects missing, duplicate, malformed, incomplete, and output-less cases", () => {
  const { cases, data } = fixture();
  const invalidCases = [
    [{ ...data, results: data.results.slice(0, 1) }, cases],
    [{ ...data, results: [data.results[0], data.results[0]] }, cases],
    [{ ...data, selected_case_ids: ["one"] }, cases],
    [{ ...data, results: [{ ...data.results[0], status: "truncated" }, data.results[1]] }, cases],
    [{ ...data, results: [{ ...data.results[0], raw_output: null }, data.results[1]] }, cases],
    [{ ...data, results: [{ ...data.results[0], output: null }, data.results[1]] }, cases],
    [data, [...cases, cases[0]]],
    [data, [{ ...cases[0], input: null }, cases[1]]],
    [data, [{ ...cases[0], input: { mode: "describe", description: "" } }, cases[1]]],
  ];
  for (const [invalidData, invalidCaseRows] of invalidCases) {
    assert.throws(() => validateBenchmarkData(invalidData, invalidCaseRows));
  }
});

test("replay requires raw output but does not depend on stored-generation output", () => {
  const { cases, data } = fixture();
  const replayData = structuredClone(data);
  replayData.results.forEach((result) => { delete result.output; });
  assert.equal(validateBenchmarkData(replayData, cases, { replay: true }).size, 2);
});
