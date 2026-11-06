# Gift Intelligence Engine (gift-engine-v1)

Santa's Helper used to send one Claude prompt and show what came back. The engine makes Claude **one component** of a
recommendation pipeline. Claude reads the shopper's words and proposes candidates. Deterministic, tested code then decides
what is shown, in what order, and why.

**Release selection:** the production configuration selects `baseline-v3.3`, retaining its frozen prompt
and original-order curation with current safety validation. The graph/retrieval/ranking pipeline below
is experimental, not the selected production recommendation path.

- Engine: `gift-engine-v1` · Ranker: `ranker-v1` · Prompt: `gift-intelligence-v4.0` (v3.3 frozen in `src/prompts/`)
- The default AI path still makes **one LLM call per uncached search**. A separately approved, fresh knowledge library can now bypass that call for supported requests; the shipped library is unapproved and empty.
- Accepted retailer offers additionally use the shared [cold-start product evidence ranker](product-evidence-ranking.md).
  This separate layer adds reviewed external evidence and safety exclusions without changing baseline idea generation.
  The linked research review covers further improvements that do not require first-party live feedback.

## Pipeline

### Shared recipient safeguards

The backend and commercial frontend reuse `site/recipient-language.js` for supported English age
and exclusion forms. Negated ceilings such as “no more than £20” remain hard caps; genuine floors
such as “no less than £20” do not become ceilings. Comma/conjunction “no leather” exclusions are
recognized alongside sentence-start exclusions. This is bounded deterministic language support,
not comprehensive multilingual understanding.

Validator-v7 derives product exclusions from recipient context, not model-authored specifications.
Up to 16 phrases of 80 characters travel in `productSpec.excludedTerms`; overflow marks
`constraintsIncomplete` and product matching abstains instead of dropping constraints.
Sponsorship uses the shared age/constraint parser and any returned minor age bands.

### Experimental recommendation flow

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
| Workers AI embeddings + Vectorize | **Designed, not enabled** | The Awin feed catalogue now provides a real product index, but its full-text search plus the existing strict matcher should be measured before adding an embedding service. Revisit only if the populated index shows a retrieval gap. |
| Amazon Creators API | Conditional (existing) | The provider is wired in but remains off in production until account access and permitted use are confirmed. |
| eBay Browse API | Conditional (existing) | The provider is wired in and configured independently, subject to production credentials, campaign approval and per-account limits. |
| Awin product feeds | Conditional (new) | Feed ingestion, D1 full-text retrieval and retailer-specific offer validation are implemented. They remain off until a D1 binding and fresh approved feeds are configured; see [Awin product catalogue](awin-product-catalogue.md). |
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

Counters are rate-limited but client reports are not authenticated conversion evidence. Current clients return signed card receipts; repeated events and conflicting ratings for the same receipt are deduplicated. Legacy category totals still accept unsigned reports and are not trusted reuse evidence. A determined visitor can obtain additional legitimate receipts: this is not proof of unique humans. The admin export is protected by a secret, not publicly accessible. Merchant-specific attribution or verified purchases need a separately authorised affiliate reporting integration; do not infer a purchase from an outbound click. Concept-level evidence and reviewed reuse are described below; real-time bandits remain future work.

## Reviewed concept memory and API-free reuse

This is a structured knowledge library, **not a document of people's descriptions** and not training Claude. It separates
model proposals, human feedback and approved knowledge. Data accumulation alone never proves that a gift worked.
The existing baseline release remains the normal AI path.

### What evolves

- `concepts.js` maps a displayed idea onto the controlled graph vocabulary: exact canonical title/query, or stem
  similarity of at least .8 with a .1 margin over the runner-up. Ambiguous and unfamiliar concepts remain unmapped.
  Conflicting exact title/query identities are rejected; a single exact field also requires at least .5 overlap with
  the other non-empty field. An exact query must not attribute feedback from an unrelated title.
  Query-derived keys survive insertions into the position-numbered graph; every observation also carries the graph version.
- `learning.js` attaches only that controlled key/version to existing cohort metadata. The existing web and mobile feedback
  transport carries it without sending descriptions, generated explanations, names or arbitrary new titles.
- `feedback.js` adds daily **verified `V|` counters** for concept, topic, age/budget bands, category, ranking policy and position,
  separately for shown/click/save/dismiss/good/bad/bought events. They use the existing Durable Object database and
  **90-day retention**; no D1 database, paid embeddings, additional model call or new service is needed.
- `feedback-receipts.js` signs controlled server-produced metadata and an opaque SHA-256 product-contract digest using domain-separated HMAC-SHA256 with the
  existing Worker-only `IP_SALT`. Each card has an independent random ID, a signature and a **24-hour expiry**; receipts
  contain no recipient text, titles, user identifier or IP. They are freshly minted after cache reads, never shared
  inside cached responses, and also cover catalogue fallbacks and photo-first replacements. Rotating the secret invalidates
  outstanding receipts. Signing is not encryption: the controlled labels are readable.
- New clients also forward that receipt to `/api/products`. The server verifies its signature, expiry and
  digest before product lookup, binding normalized identity, features, variants, age, budget and exclusions.
  These receipts are not sent to retailers, and product text is not added to feedback storage.
  Unsigned older clients and pre-upgrade receipts remain compatible; omitting the receipt follows the legacy
  path and cannot prove server-issued constraints. This is incremental integrity protection, not a signed-plan
  requirement or a replacement for endpoint usage limits.
- Verification ignores browser changes to concept/cohort/source/policy. Display position remains a validated **browser
  report**, because photo selection can compact or reorder the issued candidates; signing does not verify viewport exposure.
  An explicit interaction establishes one shown-card observation if the shown request has not arrived yet.
- `feedback-storage.js` commits replay markers and counters in one synchronous SQLite transaction. One card can contribute
  each event only once, and `good`/`bad` share a single rating slot. Duplicate retries succeed without incrementing counts.
  Failed writes roll back markers too. Only random receipt IDs, event slots and expiry are stored in the indexed replay
  table, never their cohort, IP or text; expired markers are removed during ordinary activity and the daily schedule.
- The signed endpoint accepts bounded 16 KB bodies and up to 12 items. Both category and concept counters are retained.
  Unsigned legacy reports still support old clients' category/usage counters but **cannot create verified concept evidence**.
  Old `K|` counters are neither exported as verified evidence nor accepted by current proposals. The CSV schema carries
  `evidence = signed-card-v1`; an approved policy must explicitly declare this evidence scheme.
- Concept evidence is collected only for **exactly one recognised topic and no recognised traits**. Multi-interest or
  trait-influenced descriptions still receive normal AI recommendations and category feedback, but their results cannot be
  relabelled as evidence for one topic. This reduces coverage deliberately until a reviewed multi-topic representation exists.
- `review-knowledge.mjs` proposes reusable cohort/concept pairs from the **last 60 complete UTC days**, control-policy
  observations only, with at least **200 shown cards, 30 explicit good/bad ratings**, and a **Wilson lower bound >= .6**
  using z=1.96. Ratings must not exceed shown cards. The last rating must be within 30 days.
  Clicks, saves, dismissals and self-reported purchases do not qualify a concept.
- The proposal retains position-level counts for inspection, rejects duplicate CSV rows and invalid dimensions, excludes
  current/future days and other graph/policy versions, and always sets `approved: false`. It does not write policy code.
  Wilson is a conservative prioritisation heuristic here, **not a valid confidence guarantee about independent shoppers**:
  counts can include multiple legitimate cards from one person, exposure bias and malicious input.

This deliberately learns only concepts already in the reviewed vocabulary. It does **not** automatically retain or promote
novel model-generated text. To expand the vocabulary, curate new generic physical-gift concepts in `interest-graph.js`,
review their audience/budget/facet mappings, bump `GRAPH_VERSION`, test and deploy. Old-version evidence is excluded
until reviewed/migrated separately. No sensitive recipient text should be copied into the graph or policy.

### Activation and rollback

1. Deploy these changes to begin concept-level collection. Existing caches gain current concept metadata when served.
   The shipped `knowledge-policy.js` is empty/unapproved; normal AI results and ordering are unchanged.
2. With the existing admin secret configured, export locally:

   ```powershell
   node scripts\export-feedback.mjs gift-knowledge.csv --knowledge
   node scripts\review-knowledge.mjs gift-knowledge.csv
   node scripts\evaluate-knowledge.mjs
   ```

   This uses the admin-only paginated `POST /api/knowledge/export` and existing `X-Feedback-Next` cursor convention.
   The concept cursor now uses `V|`; the category export remains unchanged. Old concept CSV headers are rejected rather
   than silently mixing unverified evidence. Keep exported files private and delete them when no longer needed;
   the default CSV filenames are ignored by Git. Server retention does not delete local exports.
3. Inspect the proposal and position counts; investigate repeated feedback, bias and seasonal changes. Complete the
   deterministic tests/replays and a **blind paired review against the selected baseline**, including unusual interests,
   children, tight budgets, owned/avoided gifts and repeat-search exclusions. Do not copy synthetic test evidence.
4. Copy accepted cells into `knowledge-policy.js`, preserve the graph/cutoff/expiry, give the policy a new version, and
   set `approved: true` only for an accepted release. Never extend expiry merely to keep reuse running.
   The release flag `KNOWLEDGE_REUSE_ENABLED = "true"` still requires an approved, valid policy.
5. Disable that flag to roll back reuse immediately on the next deployment. An expired policy automatically abstains.
   Category ranking has its separate approval/flag and is not enabled by concept collection.

### Request-time quality and privacy gates

The router checks Turnstile first, then attempts reuse **before consuming AI allowance or calling Claude**, including
when no Anthropic key is configured. Successful reuse is separately rate-limited with the existing per-visitor day/minute
limits and does not consume the global paid-AI budget. The policy must match the graph and expire within 30 days of its
evidence cutoff (inclusive of the following day); future, stale or invalid dates are rejected.

Known age (4+) and budget are required. The initial recogniser accepts only requests composed of **one recognised interest,
no recognised traits**, and a narrow set of ordinary relationship/age/budget words. Unknown words, names, nuanced requirements, non-recognised
languages, owned items and dislikes cause abstention rather than being ignored. It is intentionally conservative, not a
general natural-language confidence estimator. More requests can bypass Claude as supported cohorts/concepts accumulate;
unsupported long-tail requests still need Claude.

Only reviewed concepts for the exact topic/age/budget cohort and recent rating date enter the pool. Age and strict concept
price-cap checks run before the **existing validator, exclusions, ranker, MMR and grounded explanation pipeline**.
Unreviewed graph backups are disabled for this route. Reuse requires **8 surviving ideas, at least 3 categories, a grounded
connection for every card, and direct selected-concept coverage of every detected non-trait interest**. Otherwise the normal
AI/cache/fallback path runs. Existing variety-cap relaxation is preserved; three categories is the additional library gate.
Gift prices are estimates, not verified offers: the existing live product matcher still checks current retailer listings.

The API labels results `source: "knowledge"` with the policy version; individual cards truthfully remain graph-sourced.
Feedback from this route uses the knowledge-policy version, **not control-v1**, preventing it from feeding its own approval
evidence. The UI explains that no new AI call was needed and pauses automatic prefetch for this finite library.
Photo-first replacement candidates retain the existing validated catalogue behavior; they are not claimed to be reviewed
library selections, and they inherit the knowledge-policy feedback label to prevent control-evidence contamination.

### Readiness and production observability

`assessKnowledge` returns bounded reason codes, shared by runtime routing and the offline evaluator: disabled, unapproved,
invalid policy, graph mismatch, stale policy, unsupported profile, insufficient evidence, validation shortfall, ungrounded
explanations, insufficient diversity, missing interest coverage or reused. Enabled production requests log only the reason
and controlled policy version, never request text or a recipient model.

```powershell
node scripts\evaluate-knowledge.mjs
# Optional custom cases and a JSON policy:
node scripts\evaluate-knowledge.mjs cases.json policy.json
```

The evaluator never approves policies or makes paid API calls. It reports exact bypass/abstention counts, reasons and
case-set slices, plus existing structural metrics for reused lists. Inputs must be valid and case IDs unique. It does
not output descriptions or recommended titles. An unapproved shipped policy correctly reports **zero bypass**, not a
success-shaped demonstration made from synthetic ratings. Keep proposals unapproved until human quality review; use
an explicitly approved evaluation copy only when assessing a reviewed candidate policy. These structural reports are
not prediction accuracy, user satisfaction, conversion uplift or a substitute for an experiment.

The current deployment remains a small-site Worker with one shared Durable Object. This work does not establish
high-traffic capacity, independent-human sampling, native-device quality or top-company-equivalent relevance.
Production launch still needs real traffic monitoring, end-to-end device checks, an accepted blind paired review and a
later held-out/appropriately randomised quality evaluation. Do not remove abstention or fabricate support to raise bypass.

### Research decisions and evaluation (6 November 2026)

Primary/official sources were checked directly; this is a staged engineering design, not a claim of state-of-the-art quality.

| Method / evidence | Decision and implementation consequence |
|---|---|
| [Google: candidate generation, scoring and re-ranking](https://developers.google.com/machine-learning/recommendation/overview) and [freshness/diversity guidance](https://developers.google.com/machine-learning/recommendation/dnn/re-ranking) | Keep retrieval separate from final eligibility/diversity. Reuse passes through the existing graph/BM25/MMR system rather than replaying another shopper's explanation. Add fresh-evidence expiry and category/interest coverage gates. |
| [NIST: Wilson interval](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm) | Use the lower bound rather than raw approval percentage when proposing concepts. Minimum support and human review remain mandatory; dependent/biased feedback invalidates a literal confidence interpretation. |
| [Schnabel et al., ICML 2016: Recommendations as Treatments](https://arxiv.org/abs/1602.05352) | Separate policy versions and retain position strata. Do not claim unbiased uplift from observational counts, pool treatment outcomes into control, or optimise purchases inferred from clicks. |
| [Ji et al., TOIS: data leakage in offline evaluation](https://arxiv.org/abs/2010.11060) | Complete-day cutoffs and recent windows are enforced. For acceptance, train/propose before a fixed cutoff and evaluate on later held-out evidence; never shuffle future observations into the policy being evaluated. |
| [Li et al., WWW 2010: contextual bandits](https://arxiv.org/abs/1003.0146) | Defer automatic exploration until sufficient traffic, a defined quality reward, an approved experiment, action probabilities and randomised logging exist. The paper's click lift in news is not evidence of gift suitability. |
| [Google: negative examples and representation folding](https://developers.google.com/machine-learning/recommendation/dnn/training) | Preserve explicit poor-match feedback, not just successes. Defer collaborative filtering/two-tower training: there is no suitable consented user-item history, and sparse gift traffic makes cold start important. Never treat unshown gifts as negative ratings. |
| [Shumailov et al.: recursive generated-data training](https://arxiv.org/abs/2305.17493) | Model suggestions are proposals, not ground truth. Require human feedback and reviewed vocabulary, keep human evidence distinct, and prevent reuse-policy observations from self-promoting. This paper concerns generative training; it is motivation, not proof this deterministic library would suffer model collapse. |
| [ICO: data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/) | No raw-description archive, persistent user profile or model-output document. Controlled aggregates, bounded retention, authenticated exports and updated privacy notice instead. |

Before enabling an approved library, measure the **actual API-bypass fraction**, abstention/shortfall rates, latency and
cost per successful search; concept-mapping coverage can be estimated by comparing K-shown counts with L-shown counts.
Assess explicit rating outcomes by policy/position and broad age/budget/topic cohorts, plus ILD, direct-interest coverage,
budget failures, duplicate concepts and human paired preference. Do not count rendered cards as viewport impressions or
unique recipients, and do not infer causal improvement from higher engagement.
Existing benchmark replays are API-free structural regression checks, not a learned-quality evaluation.
Verified affiliate conversion ingestion, embeddings over an authorised catalogue, and a randomised holdout remain
separate follow-ups requiring evidence/access or experimental approval; none is silently enabled here.

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
