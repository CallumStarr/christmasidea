export function initialiseFeedbackReceipts(sql) {
  sql.exec("CREATE TABLE IF NOT EXISTS feedback_receipts (id TEXT NOT NULL, event TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY (id, event))");
  sql.exec("CREATE INDEX IF NOT EXISTS feedback_receipts_expiry ON feedback_receipts (expires)");
}

export function pruneFeedbackReceipts(sql, now = Date.now()) {
  sql.exec("DELETE FROM feedback_receipts WHERE expires <= ?", now);
}

// Called inside the Durable Object's synchronous transaction: markers and counters commit together.
export function recordVerifiedFeedback(sql, records, bucket, add, now = Date.now()) {
  if (!Array.isArray(records) || !records.length || records.length > 12) throw new Error("Invalid verified feedback batch.");
  if (records.some((record) => record.expires <= now)) return { ok: false, reason: "expired" };
  let recorded = 0;
  for (const record of records) {
    const mark = (event) => {
      const exists = sql.exec("SELECT id FROM feedback_receipts WHERE id = ? AND event = ?", record.id, event).toArray().length > 0;
      if (exists) return false;
      sql.exec("INSERT INTO feedback_receipts (id, event, expires) VALUES (?, ?, ?)", record.id, event, record.expires);
      return true;
    };
    // An explicit interaction is evidence of rendering too; this also handles out-of-order network delivery.
    const firstShown = mark("shown");
    if (firstShown) for (const key of record.shownKeys) add(bucket, key);
    if (record.event === "shown") { if (firstShown) recorded++; continue; }
    if (mark(["good", "bad"].includes(record.event) ? "rating" : record.event)) {
      for (const key of record.keys) add(bucket, key);
      recorded++;
    }
  }
  return { ok: true, accepted: recorded };
}
