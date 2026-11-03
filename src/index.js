import { DurableObject } from "cloudflare:workers";
import { handleRequest, canonicalRedirect } from "./core.js";

// One global counter object enforces the daily AI budget, per-visitor limits and
// the hourly photo budget. Durable Objects handle one request at a time, so
// check-and-increment is race free.
export class BudgetCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS usage (bucket TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (bucket, k))"
    );
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

  // Buckets: "D2026-11-02" (day), "M2026-11-02T21:53" (minute), "H2026-11-02T21" (hour).
  buckets() {
    const iso = new Date().toISOString();
    const b = { day: `D${iso.slice(0, 10)}`, minute: `M${iso.slice(0, 16)}`, hour: `H${iso.slice(0, 13)}` };
    this.sql.exec(
      "DELETE FROM usage WHERE (bucket LIKE 'D%' AND bucket < ?) OR (bucket LIKE 'M%' AND bucket < ?) OR (bucket LIKE 'H%' AND bucket < ?)",
      b.day, b.minute, b.hour
    );
    return b;
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

  // Returns how many of `n` Pexels lookups may go ahead right now.
  async takePhotos(ipHash, n) {
    const b = this.buckets();
    const hourLimit = Number(this.env.PHOTO_HOURLY_LIMIT) || 180;
    const ipMinuteLimit = Number(this.env.PHOTO_PER_VISITOR_MINUTE_LIMIT) || 30;
    const leftGlobal = hourLimit - this.count(b.hour, "photo:__global__");
    const leftVisitor = ipMinuteLimit - this.count(b.minute, `photo:${ipHash}`);
    const allowed = Math.max(0, Math.min(n, leftGlobal, leftVisitor));
    if (allowed > 0) {
      this.add(b.hour, "photo:__global__", allowed);
      this.add(b.minute, `photo:${ipHash}`, allowed);
    }
    return allowed;
  }
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
  // Pages use inline scripts and styles, so 'unsafe-inline' is needed until they are moved to hashed files.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://images.pexels.com",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

function withHeaders(res, extra) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const redirect = canonicalRedirect(request, env);
    if (redirect) return redirect;

    if (url.pathname.startsWith("/api/")) {
      const stub = env.BUDGET.get(env.BUDGET.idFromName("global"));
      const res = await handleRequest(request, env, {
        fetch: (...args) => fetch(...args),
        budget: { consume: (ipHash) => stub.consume(ipHash) },
        photoBudget: { take: (ipHash, n) => stub.takePhotos(ipHash, n) },
        cache: typeof caches !== "undefined" ? caches.default : null,
        waitUntil: (p) => ctx.waitUntil(p),
      });
      return withHeaders(res, SECURITY_HEADERS);
    }

    const res = await env.ASSETS.fetch(request);
    return withHeaders(res, SECURITY_HEADERS);
  },
};
