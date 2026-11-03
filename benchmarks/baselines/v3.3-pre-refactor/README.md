# v3.3 Haiku pre-refactor baseline

Reference quality record for recommendation prompt v3.3 (Claude Haiku 5.5, 30 cases).
The v3.3 request path (`prompt.js`, `core.js`, `validate.js`, `recipient.js`, `catalogue.js`, `run-benchmark.js`)
is unchanged by the Phase 0 provider refactor, so this is a valid pre-refactor baseline.

| Criterion | Score /5 |
|---|---|
| Weighted subjective score | 4.133 |
| Recipient fit | 4.633 |
| Budget fit | 3.633 |
| Variety | 3.833 |
| Originality | 3.300 |
| Constraints / age safety | 4.300 |
| Product search usefulness | 3.867 |
| Recipient summary accuracy | 4.933 |

Estimated API cost: $0.057606.

## Limitations

- Scored by one external AI reviewer, not a human gift buyer.
- One model only, so this is not an A/B comparison.
- Scores are subjective and not statistically validated.
- Budget fit and product-search usefulness were judged from the recommendation wording, not live retailer prices or listings.
- Cases are synthetic.
- Use it as a repeatable reference for future changes, not as proof of statistically significant performance.

## Files

`benchmark-results.json` (raw run), `blind-key.json` (unblinding key, metadata only),
`review-template.csv`, `review-template-completed.csv` (reviewer scores, unaltered),
`haiku-v3.3-unblinded-case-review.csv`, `score-summary.json`.
The scorer's CSV column `amazon_search_usefulness_1_to_5` is the product-search criterion.
