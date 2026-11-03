# ChristmasIdea — completed blind evaluation

**Evaluation method:** all 60 recommendation sets were scored before model identities were resolved. The review CSV retained Model A/Model B labels. After scoring, identities were derived using the benchmark runner’s documented deterministic per-case `stableBlindLabel` function; the blind key itself was not opened.

## Overall result

| Model | Weighted mean (/5) | Equivalent (/100) |
|---|---:|---:|
| Claude Haiku 5.5 | 4.445 | 88.9 |
| Claude Sonnet 5.5 | 4.497 | 89.9 |

Paired results: Haiku wins 12 cases; Sonnet wins 14; 4 are tied.
Sonnet’s average lead: +0.052 points out of 5 (+1.0 points out of 100).

**Interpretation:** the mean difference is below 0.15/5, the benchmark scorer’s threshold for treating a difference as meaningful. This is effectively a quality tie, not evidence that Sonnet is reliably better.

## Criterion averages

| Criterion | Haiku | Sonnet |
|---|---:|---:|
| Recipient fit (25%) | 4.90 | 4.87 |
| Budget fit (15%) | 4.13 | 4.13 |
| Variety (15%) | 4.40 | 4.50 |
| Originality (10%) | 3.53 | 3.63 |
| Constraints / age safety (15%) | 4.40 | 4.57 |
| Amazon search usefulness (10%) | 4.50 | 4.47 |
| Summary accuracy (10%) | 4.77 | 4.90 |

### What the scores suggest

- Haiku scored slightly higher for recipient fit and Amazon-search usefulness.
- Sonnet scored slightly higher for variety, originality, constraints/age safety and summary accuracy.
- Budget-fit scores were identical. In any case, no actual product prices were checked.
- Average idea counts were 7.97 for Haiku and 8.00 for Sonnet; Haiku returned seven ideas for one recipient rather than eight.

## Cases requiring prompt improvements

- **Beginner climber:** both models proposed finger-strength training equipment for a new climber; one also proposed a crash pad in an indoor-bouldering scenario. The prompt should avoid safety-critical climbing equipment and training aids for beginners unless the user explicitly asks and suitability can be established.
- **Four-year-old:** Model B included story cubes/dice despite the instruction to avoid many small loose pieces. Strengthen explicit small-parts filtering.
- **New baby:** add stronger age-specific caution and require exact intended age/use to be checked before recommending baby items. Do not imply a product is safe solely from a generic description.
- **Unknown neighbour:** both models assumed preferences with scented/personal-care gifts; default to genuinely neutral, non-fragrance suggestions when preferences are unknown.
- **Gardening and astronomy:** one model suggested a hori-hori knife despite the recipient already owning basic tools; favour the astronomy gap and avoid unnecessary sharp-tool recommendations.

## Recommendation

**Keep Haiku 5.5 as the production default for now.** The benchmark does not show a meaningful quality gain from Sonnet, while the configured token rates make Sonnet approximately 20 times more expensive per token. Sonnet may still be useful later as an optional premium path for complex recipient descriptions, but that has not been demonstrated by this test.

## Important limitations

This is a single AI evaluator’s review of 30 synthetic scenarios, not real-user research. Gift prices, live availability, product quality, safety certifications, Amazon search-result relevance and affiliate link destinations were not present in the CSV and therefore were not verified. The budget/search ratings are judgements of idea plausibility and query wording only.

Files: `christmasidea-blind-evaluation-completed.csv` preserves blind labels and includes all ratings and per-row weighted scores. `christmasidea-unblinded-evaluation.csv` adds the resolved model identity for audit.
