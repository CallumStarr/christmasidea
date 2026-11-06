// Fixed synthetic requests only: the monitor credential cannot bypass bot checks for arbitrary prompts.
export const FINDER_MONITOR_CASES = [
  { mode: "describe", description: "An adult who enjoys gardening and growing vegetables. Budget GBP 30." },
  { mode: "guided", relation: "friend", age: "30s-40s", budget: "30-50", interests: "reading and history" },
  { mode: "describe", description: "A 6-year-old who loves trains, drawing and building. Budget GBP 30." },
];
