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

The UI posts `shown`, `click`, `save`, `dismiss`, `more`, `good`, `bad` and `bought` to `POST /api/feedback`. `bought` is explicitly self-reported, not a retailer conversion. Good and poor-match buttons allow one rating per rendered card; purchases are separate. Failed recording is reported in the UI without blocking shopping.

**Stored:** daily aggregate counters keyed by event, strategy, source, discovery flag and position, plus joint `L|` counters connecting event to one controlled interest topic, broad age/budget bands, gift category, policy version and position. There are no per-search or per-user histories. Unknown topics remain `unknown`; these broad labels are not a complete understanding of a recipient. `shown` counts rendered cards, not verified viewport impressions. A daily scheduled Worker invocation also prunes expired usage and feedback buckets.

**Not stored in feedback counters:** raw IP, request text, titles or session ids. The Worker uses a daily-changing IP hash only for short-lived rate-limit counters.

**Retention and limits:** expired daily feedback buckets are deleted by the daily schedule and during normal budget-counter activity; buckets at or beyond the 90-day date cutoff are removed. Each visitor is limited to 40 feedback requests a minute. Cloudflare still processes network/request data to provide the Worker service.

A click is **not** treated as a good gift. The initial implementation is a reviewed category-ranking policy, not model training or a contextual bandit:

1. Collect control-policy feedback. Dismissal immediately hides the idea and prioritises its title in the next request's bounded exclusions, independent of whether feedback storage succeeds. New form submissions/reset clear these temporary exclusions.
2. Export structured totals with the admin-only paginated `POST /api/feedback/export`. Set a random secret of at least 32 characters with `npx wrangler secret put FEEDBACK_ADMIN_TOKEN`. Never place it in browser code, configuration, commits or CSVs.
3. Set the same secret in the local `FEEDBACK_ADMIN_TOKEN` environment variable, then run `node scripts\export-feedback.mjs <output-path.csv>`. This calls production and downloads every page (1,000 daily counters per page), without making paid AI requests. CSVs are analysis data; keep them out of source control and manage/delete exported copies separately from server retention.
4. Run `node scripts\review-feedback.mjs <output-path.csv>`. It prints an **unapproved** policy proposal and leaves source files unchanged. A cell needs at least **200 rendered cards and 30 explicit ratings**, with ratings no greater than shown. Score is `(good - bad) / (good + bad + 20)`; clicks, saves, dismissals and self-reported purchases do not determine its score. Only `control-v1` observations are used, never mixed policy outcomes.
5. Review selection/position bias, seasonality, repeated feedback and abuse, then replay the regression suite and complete a blind paired quality review. The support thresholds are guardrails, **not** proof of statistical significance, unique shoppers or causal improvement. Without propensity logging/randomised traffic, do not claim unbiased offline policy evaluation.
6. Copy reviewed cells into `src/engine/learning-policy.js`, give the policy a new version, and set `approved: true`. Enable `LEARNING_RANKING_ENABLED = "true"` only for an accepted release. Disable the flag to roll back ranking without deleting feedback.

The ranker only swaps disjoint adjacent pairs when their scores differ by more than 0.1. Each idea moves at most one position; it never adds candidates, removes age/budget/owned-item/exclusion guards or changes the selected variety. It runs after validation on model results, catalogue fallback and cache hits. Cached candidates remain unranked, so current policy changes take effect without stale learned ordering. The default flag is off and the shipped policy is unapproved: existing recommendation order is preserved until real evidence has been reviewed.

Counters are rate-limited but client reports are not authenticated conversion evidence and a determined visitor can submit repeated ratings. The admin export is protected by a secret, not publicly accessible. Merchant-specific attribution or verified purchases need a separately authorised affiliate reporting integration; do not infer a purchase from an outbound click. Per-gift-concept learning and real-time bandits remain future work; this first release deliberately learns only broad category preferences in controlled cohorts.

### Feedback readiness notifications

`.github/workflows/feedback-review.yml` checks daily at **04:00 UTC**, or on manual dispatch. This is a GitHub Actions schedule, separate from the Worker's 03:00 UTC storage cleanup. GitHub may delay scheduled runs; scheduling is not an exact delivery-time guarantee.

Notifications mean **ready for human review**, not statistically significant results or automatic model evolution:

- **Usage-analysis alert:** at least **200 shown cards across the whole site**, irrespective of rating volume or recommendation policy. Another usage alert requires **200 additional shown cards after the last acknowledged site cutoff**. This makes small cohorts useful collectively, without claiming sufficient evidence for ranking updates.
- **Rated-cohort alert:** a control-policy interest/age/budget/category cohort has at least **200 shown cards and 30 good/poor-match ratings** in retained, complete UTC days, with ratings no greater than shown. Rated-cohort reminders require **200 fresh shown cards and 30 fresh ratings after that cohort's last acknowledged cutoff**.
- Site and rated-cohort checkpoints are independent: a usage-only alert does not suppress a later quality-review alert. If both qualify together, a single issue contains both sections. Merely checking again, closing an issue or rolling old counters out of retention does not reset either checkpoint.
- Clicks, saves, dismissals and reported purchases appear in usage summaries but do not trigger readiness. Source counters count each shown card once; strategy/position/joint counters are not added to them. Counts include historical source events without learning metadata, which may not appear in the structured CSV. These are rendered-card counts, not unique visitors or verified viewport impressions. Positions are combined, so position bias still needs human assessment.
- Each issue contains at most 50 ready cohorts. Further cohorts are picked up on the next check. Only aggregated cohort labels/counts and export instructions are posted, never CSVs, search text, idea titles, session identifiers or credentials. **Issues have this repository's visibility; in a public repository these summaries are public.**
- The Worker freezes one pending summary until delivery succeeds. The workflow acknowledges it only after finding/creating its matching GitHub issue. Failures leave it pending for retry; the persistent notification ID lets retries reuse an already-created issue, even if it was closed. Workflow concurrency prevents overlapping deliveries.
- Only complete UTC days are acknowledged, preserving events arriving later. Each acknowledged cutoff covers that complete snapshot (for example, 350 new shown cards produces one usage alert and the next needs another 200 after that cutoff). Undelivered summaries expire after 90 days and are pruned during scheduled cleanup. Site and per-cohort cutoff checkpoints remain as small deduplication metadata; they do not contain user histories. Published issues and exported CSVs are separate copies, not deleted by Worker retention.

**One-time setup (required before alerts are active):**

1. Deploy the updated Worker, including `/api/feedback/review` and the existing export endpoint. Both require the same admin bearer secret and allowed site origin. The GitHub token is never sent to the Worker.
2. Set a random `FEEDBACK_ADMIN_TOKEN` of at least 32 characters as a Worker secret with `npx wrangler secret put FEEDBACK_ADMIN_TOKEN`, unless already configured.
3. Put that same value in this repository's **Settings > Secrets and variables > Actions > Secrets** as `FEEDBACK_ADMIN_TOKEN`. Do not put it in an issue, source file, workflow input or URL. The workflow uses GitHub's built-in short-lived token with only `contents: read` and `issues: write`; no personal access token is needed.
4. Commit/push the workflow and related code to the default branch. Enable Actions and Issues for the repository. Set the Actions repository **variable** `FEEDBACK_REVIEW_NOTIFICATIONS_ENABLED` to `true`. Without that explicit opt-in, the job is skipped. Once enabled, missing credentials and delivery failures cause visible failed runs, not success-shaped fallbacks.
5. Run **Actions > Feedback review notifications > Run workflow** to verify setup. Below thresholds the run should report that no new cohorts are ready, without opening a test issue. No paid AI calls are made.
6. Configure GitHub **Watch > Custom > Issues** (or watch all activity) and your GitHub email preferences to receive issue notifications. An issue being created does not itself guarantee an email unless your GitHub notification settings subscribe you.

When an alert arrives, follow the protected CSV export and policy-review steps above. No CSV is attached to email or uploaded to Actions artifacts. The CSV reflects the current retained data at export time; the issue records the frozen readiness snapshot. Export promptly rather than assuming those exact daily rows remain indefinitely.

Set `FEEDBACK_REVIEW_NOTIFICATIONS_ENABLED` to `false` to pause alerts without deleting feedback or changing ranking. Global ranking remains separately controlled by `LEARNING_RANKING_ENABLED` and a reviewed policy; the notification workflow never changes either.

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
