import { pathToFileURL } from "node:url";

const ORIGIN = "https://christmasidea.co.uk";

export function feedbackIssue(report, repository) {
  const marker = `<!-- gift-feedback-review:${report.id} -->`;
  const lines = [
    marker,
    "Feedback has enough volume for **human review**, not proven statistical significance. No engine changes have been made.",
    "",
    `Snapshot: complete UTC days after ${report.since} through ${report.cutoff.slice(1)}.`,
    ...(report.usage ? [
      "",
      "## Site-wide usage data ready for analysis",
      `Trigger: ${report.usage.new_shown} additional shown cards across the site (threshold ${report.thresholds.shown}); no ratings are required for this usage alert. Counts include all recommendation policies.`,
      "",
      "| Shown | Clicks | Saves | Dismissed | Good | Poor | Self-reported purchases |",
      "|---:|---:|---:|---:|---:|---:|---:|",
      `| ${report.usage.shown} | ${report.usage.click} | ${report.usage.save} | ${report.usage.dismiss} | ${report.usage.good} | ${report.usage.bad} | ${report.usage.bought} |`,
      "",
      "These are rendered-card and interaction counts, not unique visitors, verified viewport impressions or recommendation-quality evidence. Use the CSV for exploratory usage analysis; shown cards alone cannot approve ranking updates.",
    ] : []),
    ...(report.cohorts.length ? [
    "",
    "## Rated cohorts ready for quality review",
    `Trigger: at least ${report.thresholds.shown} shown cards and ${report.thresholds.ratings} explicit ratings per control-policy cohort, and the same amount of fresh evidence since its last rated-cohort alert.`,
    "",
    "| Interest | Age band | Budget band | Category | Shown | Good | Poor | New shown | New ratings |",
    "|---|---|---|---|---:|---:|---:|---:|---:|",
    ...report.cohorts.map((c) => `| ${c.topic} | ${c.age} | ${c.budget} | ${c.category} | ${c.shown} | ${c.good} | ${c.bad} | ${c.new_shown} | ${c.new_ratings} |`),
    ] : []),
    "",
    "## Review steps",
    "- Export the protected CSV locally: set `FEEDBACK_ADMIN_TOKEN` in your environment, then run `node scripts/export-feedback.mjs <output-path.csv>`.",
    "- Run `node scripts/review-feedback.mjs <output-path.csv>` to produce an unapproved proposal.",
    "- Review position bias, repeated ratings, seasonality and recipient suitability. Clicks are not purchases; reported purchases are not verified conversions.",
    "- Run regression checks and a blind paired quality review before approving a versioned policy.",
    `- See [the learning workflow](https://github.com/${repository}/blob/HEAD/docs/gift-intelligence-engine.md#feedback-readiness-notifications) for activation and rollback.`,
    "",
    "Only aggregate summaries are posted here. CSVs, descriptions, gift titles and credentials are not attached. Export promptly: feedback counters roll off after 90 days.",
  ];
  return { title: `Gift engine feedback ready for review - ${report.cutoff.slice(1)} - ${report.id}`, body: lines.join("\n"), marker };
}

export async function notifyFeedback({ env = process.env, fetchImpl = fetch } = {}) {
  const { FEEDBACK_ADMIN_TOKEN, GITHUB_TOKEN, GITHUB_REPOSITORY } = env;
  if (!FEEDBACK_ADMIN_TOKEN || FEEDBACK_ADMIN_TOKEN.length < 32) throw new Error("Set the FEEDBACK_ADMIN_TOKEN Actions secret to the Worker export secret.");
  if (!GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(GITHUB_REPOSITORY || "")) throw new Error("GitHub token and repository are required.");
  const review = async (body) => {
    const response = await fetchImpl(`${ORIGIN}/api/feedback/review`, {
      method: "POST", headers: { Origin: ORIGIN, Authorization: `Bearer ${FEEDBACK_ADMIN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000), redirect: "error",
    });
    if (!response.ok) throw new Error(`Feedback review request failed (${response.status}); notification was not acknowledged.`);
    return response.json();
  };
  const report = await review({ action: "check" });
  if (!report.id || (!report.cohorts.length && !report.usage)) return { notified: false };
  const issue = feedbackIssue(report, GITHUB_REPOSITORY);
  const github = async (path, init = {}) => {
    const response = await fetchImpl(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
      ...init, headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000), redirect: "error",
    });
    if (!response.ok) throw new Error(`GitHub notification failed (${response.status}); notification was not acknowledged.`);
    return response.json();
  };
  // List, rather than search: newly created issues must be visible immediately on delivery retries.
  let existing;
  for (let page = 1; ; page++) {
    const rows = await github(`/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
    existing = rows.find((row) => !row.pull_request && row.body?.includes(issue.marker));
    if (existing || rows.length < 100) break;
  }
  const created = existing || await github("/issues", { method: "POST", body: JSON.stringify({ title: issue.title, body: issue.body }) });
  await review({ action: "ack", id: report.id });
  return { notified: true, issue: created.html_url };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await notifyFeedback();
  console.log(result.notified ? `Feedback review notification delivered: ${result.issue}` : "No new feedback cohorts are ready for review.");
}
