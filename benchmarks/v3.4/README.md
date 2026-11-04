# Benchmark v3.4: gift intelligence engine

`cases.json` holds 50 cases:

| Set | Cases | Purpose |
|---|---|---|
| `v3.3-original` | case-01 to case-30 | The original 30 v3.3 cases, unchanged, so results compare directly with the frozen baseline in `../baselines/v3.3-pre-refactor/`, which must not be modified. |
| `v3.4-discovery` | case-31 to case-50 | New cases that need adjacent thinking: "already has everything", saturated interests (case-31: a 5-year-old obsessed with trains who already owns loads of train sets, £40), several interests to combine, vague descriptions, tight budgets, and dislikes. |

## Commands

```powershell
# Live run (costs about $0.002 per case with Haiku 5.5; needs ANTHROPIC_API_KEY in the environment)
node scripts/run-benchmark.js --live --confirm-cost --models=haiku --cases-file=benchmarks/v3.4/cases.json --output=benchmarks/v3.4/live-haiku

# Structural metrics, as stored or replayed through the current engine (free, offline)
node scripts/engine-metrics.js --results=benchmarks/v3.4/live-haiku/benchmark-results.json --json=benchmarks/v3.4/live-haiku.metrics.json
node scripts/engine-metrics.js --results=benchmarks/baselines/v3.3-pre-refactor/benchmark-results.json --replay --json=benchmarks/v3.4/v3.3-baseline-replayed.metrics.json

# Blind human review
npm run benchmark:score
```

`--replay` feeds each stored raw Claude response through today's engine. This isolates what the engine adds from what
the prompt adds.

## Results

| Metric (mean per case) | v3.3 as stored | v3.3 replayed through engine | v3.4 live (50) | v3.4 live, original 30 | v3.4 live, discovery 20 |
|---|---|---|---|---|---|
| Ideas shown | 7.9 | 7.9 | 8.0 | 8.0 | 8.0 |
| Intra-list diversity (ILD, higher is more varied) | 0.924 | 0.953 | 0.958 | 0.961 | 0.953 |
| Literal share (ideas that are the stated interest itself) | 0.554 | 0.517 | 0.473 | 0.450 | 0.506 |
| Discovery ideas (adjacent, explained) | 0 | 2.33 | 2.64 | 2.73 | 2.50 |
| Ideas with a connection grounded in the shopper's words | 0 | 7.57 | 7.88 | 7.83 | 7.95 |
| Distinct categories | 4.07 | 4.97 | 4.66 | 4.57 | 4.80 |
| Cases with fewer than 8 ideas | 3 / 30 | 3 / 30 | 0 / 50 | 0 / 30 | 0 / 20 |
| Ideas over budget (more than 1.1×) | 0 | 0 | 0 | 0 | 0 |
| Truncated responses | 0 | 0 | 0 | 0 | 0 |
| Total cost | $0.058 | n/a | $0.104 | n/a | n/a |

All v3.4 columns use the final engine replayed over the live run (`live-haiku.replayed-final-engine.metrics.json`).
The stored output from the time of the run is in `live-haiku.metrics.json`.

**These are structural metrics, not quality scores.** They show the engine does what it was built to do: more varied,
less literal lists that explain themselves, stay in budget and fill all eight slots. They cannot say whether a gift is
*good*. That needs the blind review: `live-haiku/review-template.csv` and `blind-key.json` are ready for
`npm run benchmark:score`, and no human scores have been recorded yet.
