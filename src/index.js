import { DurableObject } from "cloudflare:workers";
import { handleRequest, canonicalRedirect } from "./core.js";

// One global counter object enforces daily AI and product lookup limits. Durable Objects handle one request at a time, so
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

  // Buckets: "D2026-11-02" (day), "M2026-11-02T21:53" (minute), "H2026-11-02T21" (hour), "S2026-11-02T21:53:00" (second).
  buckets() {
    const iso = new Date().toISOString();
    const b = {
      day: `D${iso.slice(0, 10)}`,
      minute: `M${iso.slice(0, 16)}`,
      hour: `H${iso.slice(0, 13)}`,
      second: `S${iso.slice(0, 19)}`,
    };
    this.sql.exec(
      "DELETE FROM usage WHERE (bucket LIKE 'D%' AND bucket < ?) OR (bucket LIKE 'M%' AND bucket < ?) OR (bucket LIKE 'H%' AND bucket < ?) OR (bucket LIKE 'S%' AND bucket < ?)",
      b.day, b.minute, b.hour, b.second
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

  // Reserves bounded per-second, hourly, daily and per-minute capacity for product searches.
  async takeProducts(ipHash, n) {
    const b = this.buckets();
    const hourLimit = Number(this.env.PRODUCT_SEARCH_HOURLY_LIMIT) || 120;
    const secondLimit = Number(this.env.PRODUCT_SEARCH_PER_SECOND_LIMIT) || 1;
    const ipDayLimit = Number(this.env.PRODUCT_SEARCH_PER_VISITOR_DAILY_LIMIT) || 32;
    const ipMinuteLimit = Number(this.env.PRODUCT_SEARCH_PER_VISITOR_MINUTE_LIMIT) || 16;
    const requestCount = Math.max(0, Math.min(16, Math.floor(Number(n) || 0)));
    const leftGlobal = hourLimit - this.count(b.hour, "product:__global__");
    const leftSecond = secondLimit - this.count(b.second, "product:__global__");
    const leftDay = ipDayLimit - this.count(b.day, `product:${ipHash}`);
    const leftVisitor = ipMinuteLimit - this.count(b.minute, `product:${ipHash}`);
    const allowed = Math.max(0, Math.min(requestCount, leftGlobal, leftSecond, leftDay, leftVisitor));
    if (allowed > 0) {
      this.add(b.hour, "product:__global__", allowed);
      this.add(b.second, "product:__global__", allowed);
      this.add(b.day, `product:${ipHash}`, allowed);
      this.add(b.minute, `product:${ipHash}`, allowed);
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
    "img-src 'self' data: https://m.media-amazon.com https://images-eu.ssl-images-amazon.com",
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
        productBudget: { take: (ipHash, n) => stub.takeProducts(ipHash, n) },
        cache: typeof caches !== "undefined" ? caches.default : null,
        waitUntil: (p) => ctx.waitUntil(p),
      });
      return withHeaders(res, SECURITY_HEADERS);
    }

    const res = await env.ASSETS.fetch(request);
    return withHeaders(res, SECURITY_HEADERS);
  },
};
