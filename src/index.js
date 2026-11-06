import { DurableObject } from "cloudflare:workers";
import { fetchWorker } from "./worker-fetch.js";
import {
  pruneUsageBuckets, releaseAdminAuthAttempt, reserveAdminAuthAttempt, reserveProductSearches, scheduleBudgetPrune,
  seedProductDailyUsage,
} from "./budget-storage.js";
import { acknowledgeFeedbackReview, initialiseFeedbackReview, prepareFeedbackReview, pruneFeedbackReview } from "./engine/feedback-review.js";
import { initialiseFeedbackReceipts, pruneFeedbackReceipts, recordVerifiedFeedback } from "./engine/feedback-storage.js";

// One global counter object enforces daily AI and product lookup limits. Durable Objects handle one request at a time, so
// check-and-increment is race free.
export class BudgetCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS usage (bucket TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (bucket, k))"
    );
    seedProductDailyUsage(this.sql);
    initialiseFeedbackReview(this.sql);
    initialiseFeedbackReceipts(this.sql);
  }

  count(bucket, k) {
    const row = this.sql.exec("SELECT n FROM usage WHERE bucket = ? AND k = ?", bucket, k).toArray()[0];
    return row ? row.n : 0;
  }

  add(bucket, k, by = 1) {
    this.sql.exec(
      "INSERT INTO usage (bucket, k, n) VALUES (?, ?, ?) ON CONFLICT(bucket, k) DO UPDATE SET n = n + ?",
      bucket, k, by, by
    );
  }

  // Buckets: "D2026-11-02" (day), "M2026-11-02T21:53" (minute), "H2026-11-02T21" (hour), "S2026-11-02T21:53:00" (second).
  buckets() {
    const buckets = pruneUsageBuckets(this.sql);
    pruneFeedbackReview(this.sql);
    pruneFeedbackReceipts(this.sql);
    return buckets;
  }

  async prune() {
    this.buckets();
    return true;
  }

  async consume(ipHash) {
    const b = this.buckets();
    const globalLimit = Number(this.env.DAILY_AI_LIMIT) || 1500;
    const ipDayLimit = Number(this.env.PER_VISITOR_DAILY_LIMIT) || 15;
    const ipMinuteLimit = Number(this.env.PER_VISITOR_MINUTE_LIMIT) || 4;

    if (this.count(b.minute, `ai:${ipHash}`) >= ipMinuteLimit) return { ok: false, reason: "burst" };
    if (this.count(b.day, "ai:__global__") >= globalLimit) return { ok: false, reason: "daily" };
    if (this.count(b.day, `ai:${ipHash}`) >= ipDayLimit) return { ok: false, reason: "visitor" };

    this.add(b.day, "ai:__global__");
    this.add(b.day, `ai:${ipHash}`);
    this.add(b.minute, `ai:${ipHash}`);
    return { ok: true };
  }

  async takeKnowledge(ipHash) {
    const b = this.buckets();
    if (this.count(b.minute, `knowledge:${ipHash}`) >= (Number(this.env.PER_VISITOR_MINUTE_LIMIT) || 4)
      || this.count(b.day, `knowledge:${ipHash}`) >= (Number(this.env.PER_VISITOR_DAILY_LIMIT) || 15)) return { ok: false };
    this.add(b.minute, `knowledge:${ipHash}`);
    this.add(b.day, `knowledge:${ipHash}`);
    return { ok: true };
  }

  // Reserves bounded per-second, hourly, daily and per-minute capacity for product searches.
  async takeProducts(ipHash, n) {
    return reserveProductSearches(this, this.env, ipHash, n);
  }

  // Failed admin-token attempts per visitor hash per UTC hour. No global ceiling, so others cannot lock the operator out.
  async reserveAdminAuth(ipHash) {
    return reserveAdminAuthAttempt(this, this.env, ipHash);
  }

  async releaseAdminAuth(ipHash, bucket) {
    return releaseAdminAuthAttempt(this.sql, ipHash, bucket);
  }

  // Feedback counts live in "F2026-11-02" buckets for 90 days; per-visitor rate limiting uses the short minute bucket.
  async recordFeedback(ipHash, keys, records) {
    const b = this.buckets();
    const minuteLimit = Number(this.env.FEEDBACK_PER_VISITOR_MINUTE_LIMIT) || 40;
    const dailyLimit = Number(this.env.FEEDBACK_PER_VISITOR_DAILY_LIMIT) || 600;
    if (this.count(b.minute, `fb:${ipHash}`) >= minuteLimit
      || this.count(b.day, `fb:${ipHash}`) >= dailyLimit) return { ok: false };
    this.add(b.minute, `fb:${ipHash}`);
    this.add(b.day, `fb:${ipHash}`);
    const day = `F${b.day.slice(1)}`;
    if (records) return this.ctx.storage.transactionSync(() => recordVerifiedFeedback(
      this.sql, records, day, (bucket, key) => this.add(bucket, key),
    ));
    for (const k of keys.slice(0, 80)) this.add(day, k);
    return { ok: true };
  }

  async exportFeedback(after, kind = "L") {
    this.buckets();
    if (!["L", "V"].includes(kind)) throw new Error("Invalid feedback export kind.");
    const rows = this.sql.exec(
      "SELECT bucket, k, n FROM usage WHERE bucket LIKE 'F%' AND k LIKE ? AND (bucket > ? OR (bucket = ? AND k > ?)) ORDER BY bucket, k LIMIT 1001",
      `${kind}|%`, after?.bucket || "", after?.bucket || "", after?.key || ""
    ).toArray();
    const page = rows.slice(0, 1000);
    const last = page.at(-1);
    return { rows: page, next: rows.length > 1000 ? { bucket: last.bucket, key: last.k } : null };
  }

  async reviewFeedback(action, id) {
    this.buckets();
    return this.ctx.storage.transactionSync(() => action === "ack"
      ? acknowledgeFeedbackReview(this.sql, id)
      : prepareFeedbackReview(this.sql));
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    scheduleBudgetPrune(env, ctx);
  },
  fetch: fetchWorker,
};
