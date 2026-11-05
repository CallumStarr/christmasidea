import { readFile } from "node:fs/promises";
import { CATEGORIES } from "../src/constants.js";
import { cellKey, LEARNING_CONTROL, ratingScore, validLearning } from "../src/engine/learning.js";

// This parser accepts the fixed, fully quoted schema produced by export-feedback.mjs.
export function proposePolicy(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.shift() !== "day,event,topic,age,budget,category,policy,position,count") throw new Error("Unexpected feedback CSV schema.");
  const cells = new Map();
  for (const line of lines) {
    const fields = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replaceAll('""', '"'));
    if (fields.length !== 9 || fields.map((v) => `"${v.replaceAll('"', '""')}"`).join(",") !== line) throw new Error("Invalid CSV row.");
    const [day, event, topic, age, budget, category, policy, position, count] = fields;
    const value = { topic, age, budget, category, policy };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !validLearning({ ...value, policy: LEARNING_CONTROL })
      || !/^[a-z0-9.-]{1,40}$/.test(policy) || !/^\d+$/.test(count)
      || !Number.isSafeInteger(Number(count)) || !/^(?:[0-9]|1[01])$/.test(position)) throw new Error("Invalid feedback dimensions.");
    // Do not mix control observations with outcomes produced by a different ranking policy.
    if (policy !== LEARNING_CONTROL || !["shown", "good", "bad"].includes(event)) continue;
    const key = cellKey(value);
    const cell = cells.get(key) || { topic, age, budget, category, shown: 0, good: 0, bad: 0 };
    cell[event] += Number(count);
    cells.set(key, cell);
  }
  return { version: "reviewed-v1", approved: false,
    cells: [...cells.values()].filter((cell) => ratingScore(cell) !== null)
      .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)) };
}

if (process.argv[1]?.endsWith("review-feedback.mjs")) {
  if (!process.argv[2]) throw new Error("Usage: node scripts\\review-feedback.mjs gift-feedback.csv");
  console.log(JSON.stringify(proposePolicy(await readFile(process.argv[2], "utf8")), null, 2));
}
