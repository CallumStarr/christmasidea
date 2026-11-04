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
