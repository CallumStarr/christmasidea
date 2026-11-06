import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPairedReview, EVALUATION_QUESTION, writePairedReview } from "../scripts/create-paired-review.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "v3.4", "cases.json"), "utf8"));
const baselineCases = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "recipients.json"), "utf8"));
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "baselines", "v3.3-pre-refactor", "benchmark-results.json"), "utf8"));
const current = JSON.parse(fs.readFileSync(path.join(ROOT, "benchmarks", "v3.4", "live-haiku", "benchmark-results.json"), "utf8"));

test("paired review uses the same 30 frozen scenarios, hides the version, and has blank human scores", () => {
  const { csv, key } = buildPairedReview({ cases, baselineCases, baselineResults: baseline.results, currentResults: current.results });
  assert.equal(csv.match(/^case-\d{2},/gm)?.length, 30);
  assert.equal(key.versions && Object.keys(key.versions).length, 30);
  assert.match(csv, /Would these recommendations make you feel that Santa’s Helper understood this recipient and helped you discover gifts you might not have considered\?/);
  assert.doesNotMatch(csv, /v3\.3|v3\.4|Claude Haiku|baseline|current-engine/i);
  assert.match(csv, /recipient_fit_A_1_to_5/);
  assert.match(csv, /product_search_usefulness_B_1_to_5/);
  assert.match(csv, /shortlisted_ideas_A_0_to_8/);
  assert.ok(Object.values(key.versions).some((pair) => pair.A === "v3.3-preserved-baseline"));
  assert.ok(Object.values(key.versions).some((pair) => pair.A === "v3.4-current-engine"));
  const { csv: repeat } = buildPairedReview({ cases, baselineCases, baselineResults: baseline.results, currentResults: current.results });
  assert.equal(repeat, csv, "the blind ordering is reproducible");
});

test("paired review preparation refuses to overwrite an existing sheet or key", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "paired-review-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const result = { csv: "synthetic sheet\n", key: { versions: {} } };
  const paths = writePairedReview(directory, result);
  const originalSheet = fs.readFileSync(paths.output, "utf8");
  const originalKey = fs.readFileSync(paths.keyPath, "utf8");
  assert.throws(() => writePairedReview(directory, result), /Refusing to overwrite/);
  assert.equal(fs.readFileSync(paths.output, "utf8"), originalSheet);
  assert.equal(fs.readFileSync(paths.keyPath, "utf8"), originalKey);

  const keyOnly = path.join(directory, "key-only");
  fs.mkdirSync(keyOnly);
  fs.writeFileSync(path.join(keyOnly, "paired-blind-key.json"), "existing key");
  assert.throws(() => writePairedReview(keyOnly, result), /Refusing to overwrite/);
  assert.equal(fs.existsSync(path.join(keyOnly, "paired-blind-review.csv")), false);
  assert.equal(fs.readFileSync(path.join(keyOnly, "paired-blind-key.json"), "utf8"), "existing key");
});
