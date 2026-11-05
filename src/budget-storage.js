export function seedProductDailyUsage(sql) {
  sql.exec(
    "INSERT INTO usage (bucket, k, n) SELECT bucket, 'product:__global__', SUM(n) FROM usage WHERE bucket LIKE 'D%' AND k LIKE 'product:%' AND k <> 'product:__global__' GROUP BY bucket ON CONFLICT(bucket, k) DO NOTHING"
  );
}

export function reserveProductSearches(counter, env, ipHash, n) {
  const b = counter.buckets();
  const dailyLimit = Number(env.PRODUCT_SEARCH_DAILY_LIMIT) || 4000;
  const hourLimit = Number(env.PRODUCT_SEARCH_HOURLY_LIMIT) || 1000;
  const secondLimit = Number(env.PRODUCT_SEARCH_PER_SECOND_LIMIT) || 32;
  const ipDayLimit = Number(env.PRODUCT_SEARCH_PER_VISITOR_DAILY_LIMIT) || 240;
  const ipMinuteLimit = Number(env.PRODUCT_SEARCH_PER_VISITOR_MINUTE_LIMIT) || 64;
  const requestCount = Math.max(0, Math.min(16, Math.floor(Number(n) || 0)));
  const allowances = [
    [b.day, "product:__global__", dailyLimit],
    [b.hour, "product:__global__", hourLimit],
    [b.second, "product:__global__", secondLimit],
    [b.day, `product:${ipHash}`, ipDayLimit],
    [b.minute, `product:${ipHash}`, ipMinuteLimit],
  ];
  const allowed = Math.max(0, Math.min(requestCount,
    ...allowances.map(([bucket, key, limit]) => limit - counter.count(bucket, key))));
  if (allowed > 0) {
    for (const [bucket, key] of allowances) counter.add(bucket, key, allowed);
  }
  return allowed;
}

export function pruneUsageBuckets(sql, now = new Date()) {
  const iso = now.toISOString();
  const buckets = {
    day: `D${iso.slice(0, 10)}`,
    minute: `M${iso.slice(0, 16)}`,
    hour: `H${iso.slice(0, 13)}`,
    second: `S${iso.slice(0, 19)}`,
  };
  const feedbackCutoff = `F${new Date(now.getTime() - 90 * 86400_000).toISOString().slice(0, 10)}`;
  sql.exec(
    "DELETE FROM usage WHERE (bucket LIKE 'D%' AND bucket < ?) OR (bucket LIKE 'M%' AND bucket < ?) OR (bucket LIKE 'H%' AND bucket < ?) OR (bucket LIKE 'S%' AND bucket < ?) OR (bucket LIKE 'F%' AND bucket <= ?)",
    buckets.day, buckets.minute, buckets.hour, buckets.second, feedbackCutoff,
  );
  return buckets;
}

export function scheduleBudgetPrune(env, ctx) {
  const stub = env.BUDGET.get(env.BUDGET.idFromName("global"));
  ctx.waitUntil(stub.prune());
}
