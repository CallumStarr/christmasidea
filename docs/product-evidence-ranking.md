# Cold-start product evidence and recommendation research

Research and implementation review: 6 November 2026.

## What can improve before first-party feedback?

Substantially more than just collecting likes. A gift has at least three different properties:

1. **Suitability:** does it meet this recipient's explicit needs and constraints?
2. **Product evidence:** how well does this exact model perform under a documented, relevant test?
3. **Offer quality:** can this retailer supply the right variant, new, within budget, with known delivery?

There is no objective total ordering of all gifts. A technically excellent coffee grinder can be a poor gift for
someone who does not drink coffee. Price, popularity, a known brand, commission, review volume and a polished feed
description do not establish intrinsic quality. Category-specific measurements can establish narrower facts;
combining them into a utility score still introduces preference judgments.

This review covers major practical research avenues, not a claim that every possible research direction has been
exhausted or that a globally optimal system has been built.

## Implemented in this change

The shared Worker product pipeline now:

- Applies the existing hard identity, relevance, condition, availability, variant, recipient and budget gates
  **before** evidence can affect ordering. A price must be known if either supported budget-cap field is supplied.
  When both caps exist, the smaller applies. Required variants retain short identifiers and bound sequences:
  `UK 8` cannot match `US 8 UK 6`, and `30 cm` cannot match `30 mm`.
- Applies bounded, server-derived recipient exclusions to listing titles and descriptions before ranking.
  Excess/malformed exclusion payloads abstain. Issued-card receipts bind the normalized product contract
  for current clients; unsigned legacy requests remain supported and are not authenticated gift plans.
  Lexical matches cannot establish complete ingredient, compatibility or safety verification.
- Ranks accepted candidates across providers instead of choosing the first registered retailer.
- Preserves the existing preference for a checked product image. Quality evidence cannot buy a way past this
  intentional photo-first compatibility rule.
- Supports reviewed external evidence matched to a canonical product identity **and an exact comparison scope**.
  It does not learn a model's quality from text similarity to a different model.
- Keeps missing measurements neutral and explicitly reports `quality_unassessed`; expired assessments are ignored
  with `expired_evidence_ignored`. No synthetic product evidence is shipped.
- Supports persistent, reviewed exact-identity recall/withdrawal exclusions. These also apply to product-detail
  cache hits. An exclusion does not automatically expire and silently reintroduce a recalled product.
- Compares delivery-inclusive GBP totals only inside an identical, checksum-valid GTIN group. It does not boost
  unrelated cheap products. These are the best totals in the retrieved pool, **not a market-wide cheapest claim**.
- Avoids repeatedly adding Awin delivery when an already-normalized offer is revalidated.
- Retains retrieved alternatives and uses augmenting-path assignment to maximise filled cards without placing
  one canonical product on two cards in a single product request. Secondary merchant offers cannot steal a
  product already assigned to another card. This is maximum coverage, not maximum global preference utility.
- Attaches versioned, inspectable ranking diagnostics to returned offers. These are heuristic decision features,
  not calibrated purchase probabilities, safety certifications or consumer-facing independent quality grades.

The public `products` and optional multi-provider `offers` shapes remain compatible. Older clients may ignore the
additional `ranking` and `priceIncludesDelivery` fields. Existing provider cache/retention rules remain unchanged;
rankings are recomputed from validated offers, not persisted as trusted scores in the product cache.

All changes are in the shared backend: website, Android and iOS API requests use the same implementation after a
Worker deployment. No frontend or native-source update is required for these additive fields. No deployment or
native distribution is performed by this change.

### Deliberate limitations

Offer identity relies on provider data; a valid GTIN checksum is not proof that a seller supplied the correct
barcode. Full model, pack size, region, edition and variant resolution still needs source verification.
Legacy clients and separate frontend product batches can encounter the same product across requests;
the existing browser listing-ID deduplication remains, but there is no cross-request GTIN uniqueness guarantee.
No new user identifier or cross-request tracking is introduced to solve that.

The subsequent [actual catalogue enrichment audit](awin-product-catalogue.md#actual-enrichment-audit-6-november-2026)
now withholds Awin GTINs reused across conflicting pack/unit-size signatures and preserves bounded
retailer-asserted model/MPN/warranty facts. These claims are kept separate from independent assessments.
It also documents a real, OGL-attributed public-safety screening and the remaining source-licensing decisions.

The engine does not scrape reviews, purchase a testing licence, query a recall service, infer legal compliance,
or claim that absence from its exclusion registry establishes safety. Batch-limited recalls must not be blindly
expanded to an entire model: a reviewer must establish whether the offered stock is affected, or explicitly
choose a conservative whole-model exclusion.

## Evidence contract

The checked-in `src/engine/product-evidence-policy.js` is empty. Add only facts we have permission to use,
after review of identity, ownership, independence, methodology, dates, scale and permitted retention.
This is a trusted server-side manifest, never browser-supplied scores or an automatically approved feed.
Invalid records fail explicitly instead of silently turning into successful assessments.

Canonical keys are `gtin:` followed by a checksum-valid zero-padded 14-digit GTIN, or canonical `amazon:`,
`ebay:` or `awin:` listing keys. GTIN evidence can transfer across retailer offers for the exact same product;
listing evidence cannot. Both identity forms are checked for exclusions.

An independent-test assessment has this shape (illustrative, **not a real assessment**):

```json
{
  "key": "amazon:B000000002",
  "scope": "coffee grinder",
  "criterion": "performance",
  "kind": "independent-test",
  "value": 0.9,
  "reviewed": true,
  "permission": "permitted",
  "sourceGroup": "example-testing-publisher",
  "sourceUrl": "https://lab.example/review/grinder",
  "methodologyUrl": "https://lab.example/methods/grinders",
  "observedAt": "2026-11-01T00:00:00Z",
  "expiresAt": "2026-12-01T00:00:00Z"
}
```

`scope` must equal the normalized idea concept, or title if no concept exists. Only whitespace/case normalization
is applied. Do not mix different test rubrics under the same scope. `value` is a reviewed 0..1 transformation
under the linked category-specific methodology: the software cannot verify that an operator chose a fair scale.
Tests may be retained for at most 365 days from observation; expiry can be shorter.

Criteria and fixed heuristic weights:

| Criterion | Weight | Required interpretation |
|---|---:|---|
| Performance | .30 | Independently measured effectiveness for the intended product task |
| Usability | .20 | Documented independent usability/accessibility assessment |
| Durability | .20 | Documented testing, not an unsupported marketing longevity claim |
| Repairability | .15 | Independently assessed repairability under a stated rubric |
| Product reviews | .15 | Licensed product-specific review aggregate, never seller feedback |

These are conservative initial engineering choices, **not experimentally optimal weights**. Unobserved criteria
stay at .5 with zero evidence coverage; remaining weights are not inflated to hide missing evidence.

For `criterion: "reviews"` use `kind: "product-reviews"`, numeric `average` on the 1..5 scale and a positive
integer `count` instead of `value`. Reviews expire within 90 days. The normalized mean is shrunk toward .5 with
a heuristic prior strength of 20; effective review volume saturates at 1,000. This tempers one-review five-star
scores and runaway popularity, but does **not** make correlated, incentivised or fraudulent reviews trustworthy.
It is not a binomial Wilson confidence bound: an average star rating is not a success/failure sample.

Only the latest observation per criterion and `sourceGroup` is used. Records for the same product, scope,
criterion, ownership group and observation time cannot be duplicated. Assign syndicated/related publishers
the same ownership group. Different groups are not proof of statistical independence.

Final utility is:

```text
matchScore + 0.04 * (qualityScore - 0.5)
```

Thus external quality evidence can adjust utility by at most +/- .02, never override hard constraints.
Photos remain the first ordering tier. Within an exact GTIN group, a known total is preferred to an unknown
delivery total, then the lower known total. There is no price-based comparison across unrelated products.
Stable provider/listing identity breaks otherwise equal ties; commission and programme registration order
are not utility features.

Safety exclusions have `key`, `reason` (`recall` or `withdrawal`), `reviewed: true`, an authoritative HTTPS
`sourceUrl`, and a non-future `checkedAt`. Verify the source is authoritative: HTTPS alone does not establish
authority. Remove an exclusion only after explicit review of the corrective action and affected identity.

## Offline evaluation without collecting shopper feedback

```powershell
node scripts/evaluate-products.mjs .\private-feeds\product-cases.json
node scripts/evaluate-products.mjs .\private-feeds\product-cases.json .\private-feeds\evidence-policy.json
```

Input is a nonempty array of `{id, idea, products, relevance?}`. `idea` uses the existing product-request
contract. `products` are normalized provider offers from permitted exports; this offline tool does not contact
providers or independently authenticate affiliate links, stock, source claims or permissions.

Optional `relevance` maps canonical product keys to integer grades 0..3. Every supplied candidate must be
judged if judgments are provided. Include independently judged relevant identities missing from the candidate
pool to measure retrieval misses. Do not export descriptions or licensed data beyond their permitted retention.

Reports include exact match coverage, evidence coverage, ranked product identities, nDCG@5 and recall@5
(when judgments exist). Equivalent GTIN offers count as one product. Unjudged cases yield `null` relevance
metrics, not fabricated perfect scores. Cases are independent evaluation questions, not cards in one shopping
session. `qualityClaim` is always false: relevance labels can be biased and structural tests do not establish
recipient satisfaction.

Create a held-out, expert-judged product pool spanning interests, ages, strict budgets, unknown prices, damaged
feeds, accessories, wrong variants, unsupported needs, duplicate offers and weak/no evidence. Blind the source
and ranking order during judgment. Separate model families and syndicated evidence across development/test
partitions; splitting only retailer listing IDs leaks the same underlying product. Check slices, not just averages.
Compare relevance-only versus evidence-aware ranking; test different reasonable weight/prior settings before
increasing the evidence influence. These reviews need expert time, not live traffic.

Tests additionally enumerate all 512 three-card/three-product candidate graphs and verify maximum allocation
coverage against brute force, alongside constraint, expiry, shrinkage, collision and deterministic-order tests.
This is an algorithmic correctness result, not a product-quality benchmark.

## Research avenues and current decisions

| Avenue | Can help without first-party outcomes? | Current decision and next requirement |
|---|---|---|
| Candidate generation / scoring / reranking separation | Yes | Already implemented; preserve hard constraints as separate gates, not soft score penalties. [1] |
| Content-based and knowledge-based cold start | Yes | Existing recipient graph, lexical retrieval and controlled concepts. Curated expert edges and alias coverage can grow without training clicks. [2] |
| Hybrid retrieval and RRF | Yes | Existing graph/BM25 fusion for concepts; Awin has FTS. Evaluate product synonyms and dense retrieval on expert-labelled catalogue queries before adding embedding infrastructure. [3] |
| Product identity / variants / duplicates | Yes | Existing GTIN validation plus new collision backfilling; retain model/pack/region checks. Manufacturer identifiers are preferable to guessed title equivalence. [4] |
| Independent lab tests | Yes, with permission | New evidence contract supports them. Acquire licensed facts and map tests to the exact model/rubric; do not copy copyrighted reviews or invent measurements. |
| Review reliability | Partly | New shrinkage, volume cap and ownership-group deduplication; no scraping or unverified aggregate ingestion. Source-side verification and fraud checks still required. CMA guidance matters even before our own users rate anything. [5] |
| Safety / recalls | Yes, incompletely | New exact-identity exclusion gates. Public OPSS alerts are useful leads; the regulator's PSD is not an unrestricted, complete public catalogue. Absence of an alert is not certification. [6][7] |
| Durability, energy and repairability | Yes, for covered categories | Evidence schema accepts reviewed normalized measurements. EPREL/official labels can supply model-level facts where applicable; UK applicability, licensing and category coverage must be checked. Never extend one category's score to all gifts. [8] |
| Connected-product support lifetime | Yes | UK guidance requires publication of minimum security-update periods for covered products. A future adapter can record dated manufacturer support facts; no automatic compliance or vulnerability verdict is inferred here. [9] |
| Value and total ownership cost | Partly | New exact-product landed-price comparison and Awin idempotence fix. Consumables, subscriptions, batteries and repair costs need explicit, sourced product facts; "cheap" is not "good". |
| Delivery confidence / gift deadline | Yes, with current offer data | Stock/offer freshness checks already exist. Postcode-specific promises and personalised-item lead times need provider-supported estimates and new input/UX; do not invent Christmas delivery guarantees. |
| Compatibility / age / accessibility | Yes, with authoritative specifications | Existing required-feature, variant and recipient gates remain. Add explicit structured manufacturer facts only with trustworthy model-level fields; keyword presence cannot prove clinical or accessibility suitability. |
| Diversity / novelty / aspect coverage | Yes, structurally | Existing deterministic MMR and coverage quotas. Broadening variety must not promote irrelevant products; audit list-level coverage and generic-gift saturation. [1] |
| Preference elicitation / conversational clarification | Yes | Existing guided questionnaire is a foundation. Information-gain questions need validated attributes and deliberate UX testing; do not silently infer medical, financial or other sensitive traits. |
| Expert-labelled ranking and constraint tests | Yes | New offline graded nDCG/recall scorer and exhaustive small-graph allocation tests; real expert judgments can precede launch. [10] |
| Uncertainty / abstention / counterfactual checks | Yes | Missing evidence is visible; unsupported knowledge reuse already abstains. Tests cover commission invariance and input-order invariance. A heuristic score is not a calibrated probability. |
| Provenance / freshness / licensing / privacy | Yes | New reviewed evidence dates, scopes and ownership; existing source-specific offer retention and no raw-description learning remain. No automatic cross-provider long-term catalogue from restricted APIs. [11] |
| Learning-to-rank / collaborative filtering / bandits | Not reliably without suitable labels/outcomes | Expert labels can support an initial ranking model later. Causal uplift, propensity correction and personalised outcome optimization still require appropriately collected evidence; synthetic labels cannot prove uplift. |
| Operational quality | Yes | Existing request budgets, bounded query fallbacks, cache validation and provider failure isolation preserved. Add production latency/error/abstention dashboards through the normal observability setup; local builds are not load testing. |

## Primary / official sources checked

1. [Google: recommendation-system stages](https://developers.google.com/machine-learning/recommendation/overview/types).
2. [Google: content-based filtering](https://developers.google.com/machine-learning/recommendation/content-based/basics).
3. [Cormack, Clarke and Buettcher: Reciprocal Rank Fusion, SIGIR 2009](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf).
4. [Schema.org Product](https://schema.org/Product): separates identifiers, offers and aggregate ratings. A schema
   declaration is not independent verification. Existing GTIN checks implement the check-digit invariant, not a
   claim of access to or verification against the GS1 registration database.
5. [CMA: Fake reviews, guidance CMA208](https://www.gov.uk/government/publications/fake-reviews).
6. [OPSS: Product recalls and alerts](https://www.gov.uk/guidance/product-recalls-and-alerts).
7. [Product Safety Database: how to use the PSD](https://www.product-safety-database.service.gov.uk/help/about):
   product records and notifications are distinct; a product record alone is not a safety finding.
8. [European Commission: smartphones and tablets](https://energy-efficient-products.ec.europa.eu/product-list/smartphones-and-tablets_en)
   and [EPREL public register](https://eprel.ec.europa.eu/screen/home). EPREL's site is client-rendered; no automated
   ingestion or model-specific rating was verified in this work.
9. [UK consumer connectable product security guidance](https://www.gov.uk/guidance/regulations-consumer-connectable-product-security).
10. [Jarvelin and Kekalainen: Cumulated Gain-based Evaluation of IR Techniques, author-university publication record](https://researchportal.tuni.fi/en/publications/cumulated-gain-based-evaluation-of-ir-techniques/).
11. [Amazon Associates policies](https://affiliate-program.amazon.com/help/operating/policies) and
    [eBay Browse API overview](https://edp.ebay.com/develop/api/buy/browse_api). Actual UK programme permissions,
    current API contracts and each advertiser's terms govern ingestion/display/retention. A review of these pages
    is not legal advice or authorization to reuse third-party material.

Search-engine summaries sometimes returned dead or redirected documentation URLs. The references above use
directly checked official/author-hosted pages; unavailable field-specific eBay documentation was not treated as
proof that search responses contain product reviews. Seller feedback is not ingested as product-quality evidence.
