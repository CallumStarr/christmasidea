import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseInput } from "../src/core.js";
import { assessOutput, BENCHMARK_GIFT_TOOL, BENCHMARK_PROTOCOL_VERSION, buildBenchmarkRequest, renderReviewCsv } from "../scripts/run-benchmark.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "recipients.json"), "utf8"));

test("benchmark contains 30 distinct recipient scenarios", () => {
  assert.equal(cases.length, 30);
  assert.equal(new Set(cases.map((c) => c.id)).size, 30);
});

test("all benchmark scenarios pass the production input normaliser", () => {
  for (const scenario of cases) {
    const result = normaliseInput(scenario.input);
    assert.equal(result.ok, true, `${scenario.id}: ${result.error || "invalid input"}`);
  }
});

test("benchmark covers both freeform and guided modes", () => {
  assert.ok(cases.some((c) => c.input.mode === "describe"));
  assert.ok(cases.some((c) => c.input.mode === "guided"));
});

test("automatic assessment flags duplicated and malformed outputs", () => {
  const output = {
    recipient_summary: "A keen coffee fan with an interest in baking.",
    ideas: [
      { title: "Coffee tasting set", why: "A varied sampler for someone exploring coffee.", search_query: "coffee tasting set", category: "Food & treats" },
      { title: "Coffee discovery box", why: "Another way to sample different coffee.", search_query: "coffee tasting set", category: "Food & treats" },
      { title: "A very long explanation", why: Array(40).fill("word").join(" "), search_query: "a", category: "Invalid" },
    ],
  };
  const flags = assessOutput(output, { mode: "describe", description: "Coffee and baking" });
  assert.ok(flags.includes("duplicate_search_query"));
  assert.ok(flags.includes("idea_3_why_over_35_words"));
  assert.ok(flags.includes("idea_3_search_query_not_2_to_6_words"));
  assert.ok(flags.includes("idea_3_invalid_category"));
});

test("automatic assessment flags any candidate count other than ten, including an otherwise valid eight", () => {
  const eight = {
    recipient_summary: "A space-loving child.",
    ideas: Array.from({ length: 8 }, (_, index) => ({
      title: `Space gift ${index}`,
      why: `A thoughtful space gift number ${index}.`,
      search_query: `space gift item ${index}`,
      category: "Books",
    })),
  };
  assert.ok(assessOutput(eight, { mode: "describe", description: "A child likes space" })
    .includes("candidate_count_not_10_generated_8"));
  const ten = { ...eight, ideas: [...eight.ideas, { ...eight.ideas[0], title: "Space gift 8" }, { ...eight.ideas[0], title: "Space gift 9" }] };
  assert.ok(!assessOutput(ten, { mode: "describe", description: "A child likes space" })
    .some((flag) => flag.startsWith("candidate_count_not_10")));
});

test("review CSV reads the visitor-facing query field instead of writing undefined", () => {
  const csv = renderReviewCsv(
    [{
      case_id: "case-07",
      model_key: "haiku",
      status: "completed",
      output: { recipient_summary: "", ideas: [{ title: "Solar model", why: "A model about space.", query: "solar system model" }] },
      raw_output: { ideas: Array(8).fill({ title: "Idea" }) },
      auto_flags: [],
    }],
    [{ id: "case-07", name: "Space recipient", input: { mode: "describe", description: "Likes space" }, evaluation_focus: [] }],
    { "case-07": { haiku: "A" } },
  );
  assert.match(csv, /Product search: solar system model/);
  assert.match(csv, /candidate_count_not_10_generated_8/);
  assert.doesNotMatch(csv, /undefined/);
});



test("Sonnet (which cannot force a tool) uses auto tool choice with the same strict schema", () => {
  const request = buildBenchmarkRequest({ id: "claude-sonnet-5-5", forceTool: false }, "test recipient");
  assert.equal(BENCHMARK_PROTOCOL_VERSION, 4);
  assert.deepEqual(request.tool_choice, { type: "auto" });
  assert.equal(request.tools[0].strict, true);
  assert.equal(request.tools[0].name, "gift_ideas");
  assert.match(request.system, /calling the gift_ideas tool exactly once/);
});

test("strict benchmark schema closes every object and requires every field", () => {
  const check = (schema, location = "root") => {
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false, `${location} must reject extra properties`);
      assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${location} must require all properties`);
      for (const [key, child] of Object.entries(schema.properties)) check(child, `${location}.${key}`);
    }
    if (schema.type === "array") check(schema.items, `${location}[]`);
    assert.equal("maxLength" in schema, false, `${location} must omit unsupported maxLength`);
    assert.equal("maxItems" in schema, false, `${location} must omit unsupported maxItems`);
  };
  check(BENCHMARK_GIFT_TOOL.input_schema);
});
