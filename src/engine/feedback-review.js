import { CATEGORIES } from "../constants.js";
import { cellKey, LEARNING_CONTROL, MIN_RATINGS, MIN_SHOWN, ratingScore, validLearning } from "./learning.js";
import { FEEDBACK_RETENTION_DAYS } from "./feedback.js";

export function initialiseFeedbackReview(sql) {
  sql.exec("CREATE TABLE IF NOT EXISTS feedback_review_checkpoint (cell TEXT PRIMARY KEY, cutoff TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS feedback_review_pending (slot INTEGER PRIMARY KEY CHECK (slot = 1), payload TEXT NOT NULL)");
}

export function pruneFeedbackReview(sql, now = new Date()) {
  const oldest = `F${new Date(now.getTime() - FEEDBACK_RETENTION_DAYS * 86400_000).toISOString().slice(0, 10)}`;
  sql.exec("DELETE FROM feedback_review_pending WHERE json_extract(payload, '$.cutoff') <= ?", oldest);
}

export function prepareFeedbackReview(sql, now = new Date()) {
  const today = `F${now.toISOString().slice(0, 10)}`;
  const oldest = `F${new Date(now.getTime() - FEEDBACK_RETENTION_DAYS * 86400_000).toISOString().slice(0, 10)}`;
  const cutoff = `F${new Date(now.getTime() - 86400_000).toISOString().slice(0, 10)}`;
  const pending = sql.exec("SELECT payload FROM feedback_review_pending WHERE slot = 1").toArray()[0];
  if (pending) {
    const report = JSON.parse(pending.payload);
    if (report.cutoff > oldest) return report;
    sql.exec("DELETE FROM feedback_review_pending WHERE slot = 1");
  }
  const checkpoints = new Map(sql.exec("SELECT cell, cutoff FROM feedback_review_checkpoint").toArray().map((r) => [r.cell, r.cutoff]));
  const cells = new Map();
  // Only complete UTC days are included, so acknowledgement cannot discard later events from that day.
  for (const row of sql.exec("SELECT bucket, k, n FROM usage WHERE bucket > ? AND bucket < ? AND k LIKE 'L|%' ORDER BY bucket, k", oldest, today)) {
    const [prefix, event, topic, age, budget, category, policy, position, extra] = row.k.split("|");
    const value = { topic, age, budget, category: CATEGORIES[Number(category)], policy };
    if (prefix !== "L" || extra !== undefined || !/^(?:[0-9]|1[01])$/.test(position)
      || !validLearning(value) || policy !== LEARNING_CONTROL || !["shown", "good", "bad"].includes(event)) continue;
    const key = cellKey(value);
    const cell = cells.get(key) || { key, ...value, shown: 0, good: 0, bad: 0,
      new_shown: 0, new_ratings: 0, last_notified_through: checkpoints.get(key) || null };
    cell[event] += row.n;
    if (row.bucket > (cell.last_notified_through || "")) {
      if (event === "shown") cell.new_shown += row.n;
      else cell.new_ratings += row.n;
    }
    cells.set(key, cell);
  }
  const cohorts = [...cells.values()].filter((c) => ratingScore(c) !== null
    && c.new_shown >= MIN_SHOWN && c.new_ratings >= MIN_RATINGS)
    .sort((a, b) => a.key.localeCompare(b.key)).slice(0, 50);
  const report = { id: cohorts.length ? crypto.randomUUID() : null, cutoff,
    since: oldest.slice(1), thresholds: { shown: MIN_SHOWN, ratings: MIN_RATINGS }, cohorts };
  if (report.id) sql.exec("INSERT INTO feedback_review_pending (slot, payload) VALUES (1, ?)", JSON.stringify(report));
  return report;
}

export function acknowledgeFeedbackReview(sql, id) {
  const row = sql.exec("SELECT payload FROM feedback_review_pending WHERE slot = 1").toArray()[0];
  if (!row) return { ok: true, acknowledged: false };
  const report = JSON.parse(row.payload);
  if (report.id !== id) return { ok: false, error: "The pending notification has changed. Check again before acknowledging." };
  for (const cohort of report.cohorts) {
    sql.exec("INSERT INTO feedback_review_checkpoint (cell, cutoff) VALUES (?, ?) ON CONFLICT(cell) DO UPDATE SET cutoff = MAX(cutoff, excluded.cutoff)", cohort.key, report.cutoff);
  }
  sql.exec("DELETE FROM feedback_review_pending WHERE slot = 1");
  return { ok: true, acknowledged: true };
}
