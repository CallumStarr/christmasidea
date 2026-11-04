# Gift Intelligence Engine (gift-engine-v1)

Santa's Helper used to send one Claude prompt and show what came back. The engine makes Claude **one component** of a
recommendation pipeline. Claude reads the shopper's words and proposes candidates. Deterministic, tested code then decides
what is shown, in what order, and why.

- Engine: `gift-engine-v1` · Ranker: `ranker-v1` · Prompt: `gift-intelligence-v4.0` (v3.3 frozen in `src/prompts/`)
- Still **one LLM call per uncached search**. Everything else runs in-process in the Worker in a few milliseconds.

## Pipeline

```
 shopper text / form
        │
        ▼
 ┌──────────────────────┐  stated facts (quoted)   ┌───────────────────────────┐
 │ 1. Understand        │─────────────────────────▶│ interest graph            │
 │ recipient-model.js   │  interests, traits,      │ 53 interests · 27 facets  │
 │ + recipient.js       │  owned, avoid, budget    │ 103 gift concepts         │
 └─────────┬────────────┘                          └────────────┬──────────────┘
           │ prompt hints (non-instructional)                   │ facet weights
           ▼                                                    ▼
 ┌──────────────────────┐   12 candidates   ┌──────────────────────────────────┐
 │ 2. Claude (Haiku)    │──────────────────▶│ 3. Retrieve (retrieval.js)       │
 │ profile + discovery  │                   │ BM25 + graph ranker → RRF (k=60) │
 │ directions + ideas   │                   │ graph concepts as backups        │
 └──────────────────────┘                   └────────────────┬─────────────────┘
                                                             ▼
                                ┌────────────────────────────────────────────────┐
                                │ 4. Validate & score (validate.js, ranking.js)  │
                                │ safety, owned/avoid, budget, gift-type gate     │
                                │ grounding · fit · prior · novelty · specificity │
                                │ · budget fit                                     │
                                └────────────────┬───────────────────────────────┘
                                                 ▼
                                ┌────────────────────────────────────────────────┐
                                │ 5. Diversify: MMR (λ 0.7) + coverage + caps     │
                                │ → 8 shown                                        │
                                └────────────────┬───────────────────────────────┘
                                                 ▼
                                ┌────────────────────────────────────────────────┐
                                │ 6. Explain (explain.js): connection quoted from │
                                │ the shopper's own words; discovery flag         │
                                └────────────────┬───────────────────────────────┘
                                                 ▼
                    optional product lookup (product-identity.js: one listing per card)
                                                 ▼
                              UI → anonymous feedback counters (feedback.js)
```

If Claude fails or times out, `engineFallback` runs the same pipeline on graph and catalogue candidates only, so the
shopper still gets a reasoned list.

## Components

| Module | Responsibility |
|---|---|
| `src/engine/recipient-model.js` | Builds the recipient model. **Stated** facts (interests, traits, owned items, dislikes, budget) each carry the exact words they came from. **Inferred** motivations come from the graph and are labelled as inferences. |
| `src/engine/interest-graph.js` | A curated, versioned graph of interest → motivation facet → gift concept. For example, trains → movement, mechanics, construction, journeys, imaginative play, collecting. It also holds an audience model (child/teen/adult), the "is this literally the same interest?" test and trait detection. |
| `src/engine/retrieval.js` | Hybrid retrieval. BM25 (k1 1.2, b 0.75) over concept text, plus a graph ranker that scores facet overlap. The two are fused with Reciprocal Rank Fusion, and every candidate keeps its provenance. Eligibility covers age, budget and exclusions. |
| `src/engine/ranking.js` | Scores six objectives separately and combines them with fixed weights: grounding .25, interest fit .20, model prior .20, novelty .15, specificity .10, budget fit .10. Greedy MMR then picks the list, with a coverage bonus for unserved interests and facets. Caps per list: 3 per category, 2 per product type, 3 per strategy, 3 graph backups, and 3 literal ideas for an interest the shopper says is already well stocked. The caps relax in a fixed order; the backup cap never relaxes. |
| `src/engine/explain.js` | Gives each card a connection that quotes the shopper: direct, cross (two stated interests, both verified) or adjacent (the interest plus the motivation it follows). Negative phrases such as "already has" or "hates" are never used as reasons. |
| `src/engine/gift-types.js` | Gate that keeps live gifts to physical products. |
| `src/engine/product-identity.js` | GTIN/ASIN normalisation and a canonical product key. It assigns each listing to at most one card, so product and affiliate link always refer to the same listing. |
| `src/engine/sources.js` | Registry of every source with its status (live, conditional, designed, evaluated or rejected), what it may provide, its trust level and its cost. |
| `src/engine/feedback.js` | Turns UI events into enumerated counter keys only. |
| `src/engine/index.js` | Defines `understand`, `runEngine` and `engineFallback`, and records diagnostics: kinds, scores, discovery shown and connections shown. |

## Technology decisions

| Technology | Decision | Why |
|---|---|---|
| Interest/motivation knowledge graph | **Selected** | Captures *why* someone likes something, so adjacent ideas are explainable and testable. It costs nothing at runtime, unlike an LLM-built graph. |
| BM25 + graph ranker + RRF | **Selected** | Works without training data. RRF beats individual rankers (Cormack et al. 2009). |
| Deterministic multi-objective ranking + MMR | **Selected** | Carraro & Bridge found LLM diversity re-ranking inferior to greedy re-rankers on the cost/quality trade-off. MMR is cheap, stable and unit-testable. |
| xQuAD-style aspect coverage | **Selected (lightweight)** | Implemented as the MMR coverage bonus over stated interests and motivation facets. |
| DPP diversity | Evaluated, deferred | Better in theory, but with 8 items from about 15 candidates it adds complexity without a measurable gain over MMR. |
| Workers AI embeddings + Vectorize | **Designed, not enabled** | Cheap: bge-small costs $0.0202/M tokens, and the Vectorize free tier covers 30M queried dimensions a month. It only pays off with a real product catalogue to search. Today's candidates come from Claude and a 103-concept graph, where BM25 + graph retrieval suffices. It is the next step once product feeds land. |
| Amazon Creators API | Conditional (existing) | The only authorised product source wired in. Access needs 10 qualifying sales in 30 days. It stays off in production (`PRODUCT_DISCOVERY_ENABLED=false`). |
| eBay Browse API, Awin, CJ, Rakuten | Evaluated | Possible future feeds. Each needs approval per programme or advertiser. They are recorded in the source registry. |
| Trend/popularity signals | Not built | No authorised timestamped data source is connected. The engine and prompt **must not** claim anything is "trending". |
| LLM re-ranking, LLM-built knowledge graph | Rejected | Adds cost and latency per search, and is non-deterministic. |
| Contextual bandit (LinUCB, Li et al. 2010) | Designed | See below. |

## Learning from feedback

The UI posts `shown`, `click`, `save`, `dismiss` and `more` to `POST /api/feedback`.

**Stored:** only daily aggregate counters keyed by event, strategy, source, discovery flag and position. A daily scheduled Worker invocation also prunes expired usage and feedback buckets.

**Not stored in feedback counters:** raw IP, request text, titles or session ids. The Worker uses a daily-changing IP hash only for short-lived rate-limit counters.

**Retention and limits:** expired daily feedback buckets are deleted by the daily schedule and during normal budget-counter activity; buckets at or beyond the 90-day date cutoff are removed. Each visitor is limited to 40 feedback requests a minute. Cloudflare still processes network/request data to provide the Worker service.

A click is **not** treated as a good gift. The counters feed offline evaluation, and they will not change live ranking until:

1. purchase-quality signals exist, such as affiliate conversions;
2. there is enough volume per strategy arm for confidence bounds to mean anything;
3. an offline replay evaluation (Li et al. 2010) shows the new policy beats the current one.

Once those hold, LinUCB would choose the *strategy mix*, not individual products. Its context would be audience, budget band and the interest facets.

## Cost and performance

- Prompt v4 asks for a profile, discovery directions and 12 candidates in a single call.
- Live benchmark (50 cases, Haiku 5.5): **$0.104 total**, about $0.0021 per search. The largest response used 3,376 of 4,500 output tokens, and no response was truncated.
- Engine CPU time is a few milliseconds per search.

## Privacy and safety

- Shopper text never leaves the Worker except in the single Claude call, which is unchanged from before.
- Recipient hints are passed to Claude as quoted data, never as instructions. Unit tests cover prompt-injection text.
- Claude's ideas are untrusted. Each must quote the shopper's words to be grounded, and must pass the safety, owned-item, avoid, budget and gift-type checks.
- Feedback is aggregate-only, as described above.

## Measuring it

See [`benchmarks/v3.4/README.md`](../benchmarks/v3.4/README.md). Structural metrics include ILD, literal share,
grounded connections, product match-cap budget checks, near-duplicate pairs, repeated interests and strategy balance.
They show selected properties of the output, not whether ideas are good; that needs blind human review.

## References

- Carbonell & Goldstein (1998), *The use of MMR, diversity-based reranking…*, SIGIR. doi:10.1145/290941.291025
- Santos, Macdonald & Ounis (2010), *Explicit search result diversification through sub-queries* (xQuAD), ECIR.
- Chen, Zhang & Zhou (2018), *Fast greedy MAP inference for DPP…*, NeurIPS. arXiv:1709.05135
- Cormack, Clarke & Büttcher (2009), *Reciprocal rank fusion…*, SIGIR. doi:10.1145/1571941.1572114
- Li, Chu, Langford & Schapire (2010), *A contextual-bandit approach to personalized news article recommendation*, WWW. arXiv:1003.0146
- Carraro & Bridge (2024), *Enhancing recommendation diversity by re-ranking with large language models*, ACM TORS.
  doi:10.1145/3700604, arXiv:2401.11506. (It is in ACM TORS, not ScienceDirect.)
- Cloudflare Workers AI, Vectorize, D1 and KV pricing and limits pages (developers.cloudflare.com), checked during development.
