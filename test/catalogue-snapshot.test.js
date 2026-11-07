import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normaliseInput } from "../src/core.js";
import { catalogueFallback } from "../src/catalogue.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

// The snapshot was recorded before the catalogue performance work; any change to fallback output must be deliberate.
test("catalogueFallback output is unchanged for all 50 v3.4 benchmark cases", () => {
  const cases = read("../benchmarks/v3.4/cases.json");
  const snapshot = read("./fixtures/catalogue-fallback-v3.4.json");
  assert.equal(cases.length, 50);
  assert.deepEqual(Object.keys(snapshot), cases.map((item) => item.id));
  for (const item of cases) {
    const parsed = normaliseInput(item.input);
    assert.equal(parsed.ok, true, item.id);
    const result = catalogueFallback(parsed.value);
    const serialised = JSON.stringify(result);
    const expected = snapshot[item.id];
    assert.deepEqual(result.ideas.map((idea) => idea.title), expected.titles, `${item.id}: titles`);
    assert.equal(serialised.length, expected.bytes, `${item.id}: size`);
    assert.equal(createHash("sha256").update(serialised).digest("hex"), expected.sha256, `${item.id}: full output`);
  }
});
