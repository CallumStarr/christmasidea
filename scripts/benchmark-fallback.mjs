// Times catalogueFallback over the 50 v3.4 benchmark cases. Usage: node scripts/benchmark-fallback.mjs [rounds]
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { normaliseInput } from "../src/core.js";
import { catalogueFallback } from "../src/catalogue.js";

const cases = JSON.parse(readFileSync(new URL("../benchmarks/v3.4/cases.json", import.meta.url), "utf8"));
const inputs = cases.map((item) => {
  const parsed = normaliseInput(item.input);
  if (!parsed.ok) throw new Error(`${item.id}: ${parsed.error}`);
  return parsed.value;
});
const rounds = Math.max(1, Number(process.argv[2]) || 20);

const coldStart = performance.now();
catalogueFallback(inputs[0]);
const cold = performance.now() - coldStart;
for (let i = 0; i < 3; i++) for (const input of inputs) catalogueFallback(input);

const samples = [];
for (let round = 0; round < rounds; round++) {
  for (const input of inputs) {
    const start = performance.now();
    catalogueFallback(input);
    samples.push(performance.now() - start);
  }
}
samples.sort((a, b) => a - b);
const at = (q) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))];
const ms = (value) => `${value.toFixed(2)} ms`;
console.log(`catalogueFallback over ${inputs.length} cases x ${rounds} rounds (${samples.length} warm calls)`);
console.log(`first call: ${ms(cold)}`);
console.log(`median: ${ms(at(0.5))}  p90: ${ms(at(0.9))}  max: ${ms(samples.at(-1))}`);
