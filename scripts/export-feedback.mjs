import { writeFile } from "node:fs/promises";

const token = process.env.FEEDBACK_ADMIN_TOKEN;
if (!token || token.length < 32) throw new Error("Set FEEDBACK_ADMIN_TOKEN to the Worker export secret (at least 32 characters).");
const origin = "https://christmasidea.co.uk";
const knowledge = process.argv.includes("--knowledge");
const output = process.argv.slice(2).find((arg) => arg !== "--knowledge");
let after;
let csv = "";
do {
  const response = await fetch(`${origin}/api/${knowledge ? "knowledge" : "feedback"}/export`, {
    method: "POST",
    headers: { Origin: origin, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(after ? { after } : {}),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Feedback export failed (${response.status}).`);
  const text = await response.text();
  csv += csv ? text.slice(text.indexOf("\n") + 1) : text;
  const next = response.headers.get("X-Feedback-Next");
  after = next ? JSON.parse(decodeURIComponent(next)) : null;
} while (after);
await writeFile(output || (knowledge ? "gift-knowledge.csv" : "gift-feedback.csv"), csv);
console.log(`${knowledge ? "Knowledge" : "Feedback"} CSV exported.`);
