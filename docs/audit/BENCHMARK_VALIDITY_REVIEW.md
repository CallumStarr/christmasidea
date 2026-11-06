# Offline benchmark validity review

## Bottom line

| Claim | Assessment | What the evidence actually supports |
|---|---|---|
| Both historical result files can be replayed offline | **Verified**, narrowly | Current `runEngine` accepted the frozen raw-result sets and produced the numbers below without a model call. This is a replay of saved responses, not a new generation or a historical-run attestation. |
| Zero budget-cap violations for all 50 v3.4 cases | **Not verified** | All 20 discovery inputs have `?` instead of a recognized currency marker, so their parsed budget is null. The previous metric misleadingly returned zero; the corrected metric reports 30 assessed and 20 unassessed. No actual product or delivery prices were evaluated. |
| Experimental replay represents the production release | **Not verified** | Production configuration selects baseline prompt/original-order curation; both replay arms go through the experimental engine. The reviewed paired sheet instead uses stored v3.3 ideas versus experimental v3.4 replay. |
| The 28–2 paired-sheet preference is a population or multi-reviewer result | **Not verified** | The preserved sheet does encode 28 baseline and two v3.4 preferences, but no reviewer identities, independence, blinding compliance or rater count. Eight v3.4 explanations now differ from the current regenerated sheet. |
| The new 24 audit cases demonstrate quality | **Not applicable** | Selection and input-normalization tests passed; there are no generated results or reviewer scores. Independence from development exposure has not been established. |
| Production readiness, real-world age safety or live affordability | **Blocked** | Requires independent evaluation and, where applicable, operator-approved live/deployed checks. This review did not make model calls, purchases, deployments or external mutations. |

The [22-finding challenge](FINDINGS_CHALLENGE.md) contains the detailed regression
assessment. The data below distinguishes the initial independent inspection
from later local fixes. Frozen inputs, scored sheets and raw outputs were not
changed.

## Frozen inputs and provenance

| Artifact | Evidence | SHA-256, independently checked |
|---|---|---|
| [Original 30 cases](../../benchmarks/recipients.json) | IDs and inputs are shared by the first 30 v3.4 cases. | `dd96f54a9280b2a9d54e514797c4e89e502e8c6ed2640b5706b84013b8a246b7` |
| [50-case v3.4 set](../../benchmarks/v3.4/cases.json) | 30 original plus 20 discovery cases; its `?` budgets matter below. | `58a3169d0515e83fb2d1ccc2bb3a8fb84e052e420a64e13fac1af26f05c987a2` |
| [v3.3 results](../../benchmarks/baselines/v3.3-pre-refactor/benchmark-results.json#L1-L24) | Metadata: 2026-11-03 22:44:30Z, `gift-curator-v3.3`, validator-v4, protocol 4. | `4ed06deff00826fc9cc092c0216196f532cf2c4c09334426429cdb73df8d5699` |
| [v3.4 results](../../benchmarks/v3.4/live-haiku/benchmark-results.json#L1-L26) | Metadata: 2026-11-04 00:13:10Z, `gift-intelligence-v4.0`, validator-v5, engine-v1, protocol 5. | `4863c43a3b0e1bd690dbc86e22a0a1f40df0c71d1d431fb040d5bddf507df97c` |
| [Completed paired sheet](../../benchmarks/v3.4/paired-blind-review-scored.csv) | One completed 30-case sheet; A/B mapping is [separately stored](../../benchmarks/v3.4/paired-blind-key.json). | `0f8818db7266f3c678883ad76733f2f948d673a9e63bc4fae93d9b979015e0b6` |

These five tracked files match their Git blobs at audited baseline
`74a6ddf2b5855710f2a2e762b0805e57645f85c1`. The result metadata says Haiku,
adaptive thinking, low effort and 4,500 maximum output tokens. Both files store
raw outputs, stored curated outputs and usage/cost estimates, but not an exact
sent-message transcript or input hash. File identity at the audited commit is not
proof of what bytes a past remote model received or how its training data was
constructed. For example, the frozen [case-31 output](../../benchmarks/v3.4/live-haiku/benchmark-results.json#L22313-L22320)
summarizes “about £40” even though its current replay input says `?40`; historical
request bytes cannot be reconstructed with certainty from that summary.

## Exact pipelines: release, generation and replay

1. **Production-selected code path, not exercised live here.** The repository's
   [`RECOMMENDATION_MODE = "baseline-v3.3"`](../../wrangler.toml#L30-L40) selects
   the frozen baseline prompt and original-order `curateIdeas` path with current
   validation ([request](../../src/core.js#L240-L254),
   [curation](../../src/core.js#L555-L565)). Routes can also return knowledge,
   cache or fallback responses ([core](../../src/core.js#L490-L542)); an offline
   result does not cover those live paths. The
   [release regression](../../test/baseline-release.test.js#L31-L75) checks exact
   **title/order** lists for 29 frozen cases and the documented case-12 correction,
   not full prose, price, query, listing or deployed-configuration parity.
2. **Historical generation and current benchmark runner.** The preserved
   metadata identifies the historical prompts/settings above; it does not prove a
   newly generated result. The current [runner](../../scripts/run-benchmark.js#L29-L64)
   normalizes inputs and builds a v4 request with graph hints and a strict tool,
   then [curates with `runEngine`](../../scripts/run-benchmark.js#L203-L226).
   Live execution requires both `--live` and `--confirm-cost` and credentials;
   it writes results, key and review templates
   ([runner](../../scripts/run-benchmark.js#L287-L399)). The no-network dry path
   returns **before** normalizing each case. Its 24/24 selection therefore is
   not itself input validation; the separate
   [24-case test](../../test/recipient-commerce-constraints.test.js#L159-L168)
   does check `normaliseInput(...).ok` and unique identities. That normalization
   check does not prove semantic budget parsing.
3. **Offline replay.** [`validateBenchmarkData`](../../scripts/engine-metrics.js#L114-L165)
   requires the expected IDs/count, normalizable case shapes, one completed result
   per ID and a `raw_output.ideas` array; it does not validate the array's quality
   or require it to be nonempty ([empty-array fixture](../../test/engine-metrics.test.js#L23-L50)).
   [`--replay`](../../scripts/engine-metrics.js#L167-L207) normalizes the current
   case file and sends the saved raw output through the **current experimental**
   engine, then computes deterministic metrics. It writes JSON only if `--json`
   is supplied. The v3.3 replay uses the 30-case subset of the v3.4 case file,
   whose first 30 inputs match the original case file.
4. **Historical paired review.** [`buildPairedReview`](../../scripts/create-paired-review.js#L56-L113)
   pairs the *stored* v3.3 curated ideas, not a current production request or
   baseline curation, against v3.4 raw output replayed through the engine that
   was current when that CSV was created. It displays the recipient request,
   evaluation focus, titles, explanations and search queries; it does not show
   verified product prices, availability or delivery. The key and ordering are
   derived from a fixed hash/seed, not independently concealed randomization.
   The [unpaired scorer](../../scripts/score-benchmark.js#L6-L14) uses seven
   weighted 1–5 criteria on a different review format; those weighted scores are
   not the paired-sheet preference counts.

## Replays actually performed

Both commands below ran successfully with no output path or network generation:

```powershell
node scripts\engine-metrics.js --results=benchmarks\baselines\v3.3-pre-refactor\benchmark-results.json --case-set=v3.3-original --expected-cases=30 --replay
node scripts\engine-metrics.js --results=benchmarks\v3.4\live-haiku\benchmark-results.json --expected-cases=50 --replay
```

| Current replay output | v3.3 raw, original 30 | v3.4 raw, all 50 | v3.4 raw, same original 30 |
|---|---:|---:|---:|
| Mean ideas shown | 7.9 | 8 | 8 |
| Mean textual/category ILD | .953 | .958 | .961 |
| Mean direct/literal share | .517 | .473 | .450 |
| Mean anchored connections | 7.567 | 7.880 | 7.833 |
| Match caps >110% **assessed parsed** budget | 0 | 0* | 0 |
| Budget-assessed / partially assessed / unassessed cases | 30 / 0 / 0 | 30 / 0 / 20 | 30 / 0 / 0 |
| Lexical near-duplicate pairs | 0 | 0 | 0 |
| Mean strategy balance | .776 | .926 | .928 |
| Mean categories | 4.933 | 4.660 | 4.567 |
| Cases with fewer than eight | 3 | 0 | 0 |
| Stored original generation estimate, USD | .057606 | .104119 | not separately reported here |

`*` Twenty discovery cases in the 50-case total had no parsed maximum, so the zero
does not cover them; the discovery-only total is `null`, not zero. The
50-versus-30 columns are different populations, not a
controlled treatment comparison. Even the shared-30 replay compares two frozen
generations routed through today's experimental engine, not two production
releases, repeat generations or independent users.

The previously saved [v3.3 replay snapshot](../../benchmarks/v3.4/v3.3-baseline-replayed.metrics.json#L6-L16)
has mean categories **4.967**, versus **4.933** on the fresh replay, and uses
`total_over_budget` rather than the current `total_match_cap_over_budget` key.
Those are historical artifacts with different code/schema; do not overwrite or
silently equate them. The retained prior
[v3.3 replay log](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/replay-v33.log)
and [v3.4 replay log](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/replay-v34.log)
lines 3–20 agree with the corresponding fresh case counts, ILD and category
means; their recorded [hashes](verification.json#L126-L131) match the retained
files. The saved dollar amounts are historical estimates, not this review's
spend or verified invoices. The previous truncation counter counted only
`status === "truncated"` after the validator had already rejected non-completed
results, making zero structurally selected. The corrected counter uses each
completed result's `truncated` flag and reports unknown flags. Both saved
replays report zero flagged and zero unknown **among completed results only**;
failed or missing attempts remain excluded.

## Budget inputs invalidate the zero claim

The case-31 [description and focus](../../benchmarks/v3.4/cases.json#L478-L491)
say `?40` / `Max ?40`; the case-set [README](../../benchmarks/v3.4/README.md#L13-L14)
describes that example as £40. Cases [45](../../benchmarks/v3.4/cases.json#L688-L699)
and [50](../../benchmarks/v3.4/cases.json#L762-L773) similarly say `?25` and
`?10`. An independent current replay found **20/20** discovery cases had
`deriveRecipient(...).budget.max === null`; **30/30** shared original cases had
a parsed maximum. The previous metric returned zero when there was no budget;
the [corrected metric](../../scripts/engine-metrics.js) marks it unassessed and
reports fully, partially and unassessed cases. It also counts assessed and
unassessed idea-level caps: missing, non-numeric or non-positive caps are not
silently treated as affordable. A further
[regression](../../test/engine-metrics.test.js) covers partial and empty lists.

Assuming the numeric focus values are intended GBP ceilings, the *current replay
under those unchanged malformed inputs* contains 12 displayed
`productSpec.maxPriceGbp` values above 110% of those amounts, across nine cases:
32, 39, 42, 43, 44, 45, 47, 48 and 50. For case-45, the inferred £25 ceiling
coexists with match caps £90 for an instant-print camera and £40 for a pasta set;
case-50's inferred £10 ceiling coexists with £40 for a hand-crank coffee grinder
and £30 each for a cushion and watercolour set. **These are matching caps, not
observed product prices**; intended GBP is inferred from the UK context and
focus, not recorded as a parsed value. Replacing `?` with `£` in memory changes
parsing and can change the selected list, so those 12 are not claimed as the
output of a corrected replay.

This no-write reproduction counts the unchanged cases and exposes the affected
caps; it sends no data outside the process:

```powershell
@'
import fs from "node:fs";
import { normaliseInput, runEngine } from "./src/core.js";
import { deriveRecipient } from "./src/recipient.js";
const cases = JSON.parse(fs.readFileSync("benchmarks\\v3.4\\cases.json", "utf8"));
const data = JSON.parse(fs.readFileSync("benchmarks\\v3.4\\live-haiku\\benchmark-results.json", "utf8"));
let missing = 0, capCount = 0, caseCount = 0;
for (const c of cases.slice(30)) {
  const input = normaliseInput(c.input).value;
  if (deriveRecipient(input).budget.max === null) missing++;
  const intended = Number(c.evaluation_focus.join(" ").match(/\?(\d+(?:\.\d+)?)/)[1]);
  const result = data.results.find(r => r.case_id === c.id);
  const ideas = runEngine(result.raw_output, input, { truncated: result.truncated }).ideas;
  const caps = ideas.filter(i => Number(i.productSpec?.maxPriceGbp) > intended * 1.1);
  if (caps.length) { caseCount++; capCount += caps.length; }
}
console.log({ missing, caseCount, capCount });
'@ | node --input-type=module
```

Expected output: `{ missing: 20, caseCount: 9, capCount: 12 }`. Preserve the old
inputs/results as historical evidence; a corrected, hashed and versioned case set
and new evaluation require their own approval. The existing outputs do not
record the exact historical request text, so this finding is about the
**current replay**, not an assertion that the historical live model necessarily
saw the corrupted marker.

## Reviewer methodology, contamination and limits

The [paired template and key](../../benchmarks/v3.4/README.md#L37-L43) were
constructed deterministically. The completed CSV has 30 unique cases, 630 valid
numeric fields (nine paired criteria, two shortlist counts and confidence per
case), 30 valid preferences and 30 notes. Key mapping gives baseline 28 wins,
v3.4 two wins, no ties; v3.4 was A in 16 cases and baseline A in 14. These
descriptives agree with the [saved summary](../../benchmarks/v3.4/README.md#L69-L95).
They are a warning against asserting that v3.4 is better, not proof of broad
user preference.

The sheet does not encode reviewer identities, how many people contributed,
whether anyone was human, conflicts of interest, training or whether the
reviewer had access to the adjacent key. The README calls the review “human”
and “one reviewer” while also saying identity and independent-rater count are
not encoded; the latter uncertainty is the supportable conclusion. The earlier
[v3.3 unpaired review](../../benchmarks/baselines/v3.3-pre-refactor/README.md#L20-L26)
explicitly states one external AI reviewer. The v3.4 50-case unpaired sheet has
unknown reviewer provenance ([README](../../benchmarks/v3.4/README.md#L101-L120));
its score is neither paired nor comparable evidence of a human improvement.
Independent CSV checks found 30 unique baseline rows with 210 valid ratings,
weighted mean **4.133**, and 50 unique v3.4 rows with 350 valid ratings,
weighted mean **4.014**; both match their saved
[baseline](../../benchmarks/baselines/v3.3-pre-refactor/score-summary.json#L1-L18)
and [v3.4](../../benchmarks/v3.4/live-haiku/score-summary.json#L1-L18) summaries,
with no blind-label/key mismatches and notes present on every row. Different
cases and unknown/different reviewers preclude treating their difference as a
controlled system effect.

There is a concrete **staleness** problem. Regenerating the paired CSV *in memory*
with today's engine leaves titles, order and queries unchanged but changes v3.4 explanations
in **8/30** cases: 03, 12, 14, 15, 18, 22, 27 and 28. For example, the
[preserved sheet](../../benchmarks/v3.4/paired-blind-review.csv#L1282-L1285)
says a terrarium “needs little looking after”; the
[current graph text](../../src/engine/interest-graph.js#L233) asks the reader to
check plants, light, ventilation and watering. The sheet predates the graph
change: Git records the sheet at
[`e1d7e31`](https://github.com/CallumStarr/christmasidea/commit/e1d7e31c743d032844e455ed584e7a9b141fc037)
(2026-11-04 14:38Z) and graph update at
[`e371ac1`](https://github.com/CallumStarr/christmasidea/commit/e371ac1f14922a0abbf42b1030e9a027651b1c0a)
(23:00Z), both before the audited baseline. The 28–2 result rates the saved
historical text, **not** today's regenerated explanations. The
[paired-review test](../../test/paired-review.test.js#L14-L27) checks IDs,
labels and determinism, but neither compares the generated sheet with the saved
one nor asserts score cells are blank despite the test name.

The same synthetic cases are embedded in development/regression workflows, and
the reproducible key resides next to the sheets. This establishes possible
development/reviewer exposure, not that any specific reviewer saw the key or
that a model trained on the cases. A fixed seed does not prove concealment.
Thirty selected synthetic recipients, a single frozen generation per arm and
unknown review provenance cannot characterize buyer behavior, model variability,
inter-rater reliability or significance for a target population. Any Wilson
interval for 28/30 is conditional on a binomial/independence model not established
here.

## What the automatic metrics can and cannot say

- **Relevance and suitability:** Direct-interest share and the presence of a
  stated anchor are lexical/graph diagnostics, not evidence that the explanation
  is appropriate, useful or factually supported. A direct-interest gift is not
  inherently worse than an adjacent one.
- **Budget and age:** A product match cap is not a retailer price, stock state,
  tax or delivery-inclusive total. Missing budgets are now reported as
  “unassessed,” not zero. No independent age-safety measure or hazard review
  is produced by `listMetrics`.
- **Diversity and originality:** ILD, strategy entropy, category counts and
  Jaccard near-duplicates ([implementation](../../scripts/engine-metrics.js#L43-L90))
  are proxies: similar wording can be different ideas, and semantic duplicates
  can evade a stem threshold. Neither semantic diversity nor originality follows
  from a numeric proxy.
- **Formatting and factuality:** The runner's [flags](../../scripts/run-benchmark.js#L108-L148)
  check selected schema, lengths, categories, repeated text and title warnings;
  they do not prove product identity, truthful claims, affordability or relevance.
  Checking that a phrase occurs in the request does not verify claims about
  components, suitability or real product availability.
- **Independence and selection:** A completed-only replay discards attempted
  failures by design; corrected output explicitly states that failed or
  missing attempts are excluded, but does not score those attempts. The new
  [24 audit cases](../../benchmarks/audit-2026/README.md#L1-L9)
  have no generated outcomes; dry selection is not a prospective holdout result.

## Additional actionable observations

### Product title/query/offer mismatch

Frozen [case-31](../../benchmarks/v3.4/live-haiku/benchmark-results.json#L22317-L22320)
contains title `Wooden magnetic train-track building kit`, concept `building
blocks for tracks`, and query `large construction blocks for toddlers`.
The [validator](../../src/validate.js#L263-L270) accepts shared stems or a
recognized concept relation, and the [matcher](../../src/product-matcher.js#L130-L148)
uses the shorter concept/query and explicit `requiredFeatures`/`requiredVariants`.
With the budget marker corrected *only in memory*, a synthetic GBP20 in-stock
new listing titled `Large construction building blocks for tracks for toddlers`
and described as `Blocks for drawing racetrack layouts; no trains or magnetic
connections.` was **originally** accepted with
`{"matchScore":1,"confidence":"high","accepted":true,"reasons":[]}`. The same
v4 raw candidate also survives baseline `curateIdeas`; production generation of
this candidate and any actual retailer offer are **not established**.
The [matcher](../../src/product-matcher.js) now rejects selected explicit
negations that share normalized terms with the title or required features.
The [regressions](../../test/product.test.js) cover negative and positive
examples. Synonyms, paraphrases, ambiguous negation scope and a listing that
merely omits an attribute remain unresolved identity limitations.
The following probe now demonstrates rejection rather than the old acceptance:

```powershell
@'
import fs from "node:fs";
import { normaliseInput, runEngine, curateIdeas } from "./src/core.js";
import { scoreProductMatch } from "./src/product-matcher.js";
const cases = JSON.parse(fs.readFileSync("benchmarks\\v3.4\\cases.json", "utf8"));
const data = JSON.parse(fs.readFileSync("benchmarks\\v3.4\\live-haiku\\benchmark-results.json", "utf8"));
const c = cases.find(x => x.id === "case-31");
const input = normaliseInput({ ...c.input, description: c.input.description.replace("?", String.fromCharCode(163)) }).value;
const r = data.results.find(x => x.case_id === c.id);
const idea = runEngine(r.raw_output, input, { truncated: r.truncated }).ideas.find(x => x.title === "Wooden magnetic train-track building kit");
const listing = { title: "Large construction building blocks for tracks for toddlers",
  description: "Blocks for drawing racetrack layouts; no trains or magnetic connections.",
  condition: "NEW", availability: "IN_STOCK", price: { amount: 20, currency: "GBP" } };
console.log(scoreProductMatch(idea, listing));
console.log("baseline curation accepts candidate:", curateIdeas(r.raw_output, input).ideas.some(x => x.title === idea.title));
'@ | node --input-type=module
```

Further title/concept/query and offer-identity assessment is needed before
relying on a high-confidence product match. This counterexample is distinct
from the correctly fixed explicit-size variants in SH-004.

### Strategy entropy with missing labels

The previous `listMetrics` divided each observed label count by *all* ideas
even when some lacked a label. For three ideas with strategies `one`, `two` and
missing, it returned **1.057**, although normalized entropy should be at most
one. The [corrected implementation](../../scripts/engine-metrics.js) divides by
the labelled count and reports missing labels; this no-write probe now returns
**1**:

```powershell
@'
import { listMetrics } from "./scripts/engine-metrics.js";
const ideas = [{ title: "one", strategy: "one" }, { title: "two", strategy: "two" }, { title: "three" }];
console.log(listMetrics(ideas, { mode: "describe", description: "My friend loves travel." }).strategy_balance);
'@ | node --input-type=module
```

The existing [single-strategy test](../../test/recipient-commerce-constraints.test.js#L153-L157)
covers the original NaN fix; a new [mixed-label regression](../../test/engine-metrics.test.js)
covers the above-one defect and missing counts. No such mixed-label list or
above-one balance was found in the two current replays, so their reported means
are not claimed to be affected by this specific defect.

The [preparation script](../../scripts/create-paired-review.js) now refuses to
overwrite an existing paired sheet or key and accepts an explicit fresh
`--output-dir`. A local regression and an actual default-command refusal
confirmed that the original blind template and key remain unchanged. The
separate scored sheet was not rewritten.

## Proposed blinded, independent, pre-registered evaluation

This is a plan, **not authorization to run paid calls, contact reviewers, change
production, expose private data or query retailers**.

1. **Pre-register and freeze.** Before generating or seeing scores, identify the
   target use and population, primary/secondary endpoints, statistical model,
   sample size, stratification, stop rules, missing-data policy and release
   decision. Freeze and hash each system's actual request builder, prompt,
   schema, model/version, parameters, validator, engine, case inputs, product
   fixtures and review rubric. Compare the real baseline path with the
   experimental path under controlled identical model/settings where possible;
   do not label two model choices in the existing v4-only runner “two systems.”
   Maintain an immutable run manifest and append-only correction record.
2. **Create an independent holdout.** An evaluator not involved in tuning should
   construct at least 200 unique, balanced cases, finalizing sample size from
   an independent pilot and a pre-specified power/precision calculation. Avoid
   all 74 existing scenarios and near variants; document provenance, secure
   access and exposure checks. Include sparse/rich, varied budgets, negated
   budgets, already-owned items, exclusions, age bands and interests; include
   deliberately malformed/ambiguous `?` budgets with expected
   `unassessed`/clarification behavior. Any real case must have documented
   consent, de-identification and separate data-sharing approval. Record
   pre-agreed ground truth rather than assuming input normalization found it.
3. **Blind and balance.** A separate custodian generates an unpredictable
   per-case/per-reviewer A/B assignment and presentation order, strips labels,
   IDs and identifiable prompts, and keeps the key and generation logs inaccessible
   until all independent ratings are locked. Ask reviewers to disclose prior
   exposure and guess the arm, record blinding breaches and pre-specify handling.
   Use at least two trained independent raters per pair; preferably three, or
   two plus a third adjudicator. Calibrate on separate training cases and prevent
   discussion until independent submissions are frozen.
4. **Score each dimension separately with anchored rubrics.** For every idea
   rate recipient relevance and specificity, suitability for stated interests,
   ownership/exclusions and age, originality without rewarding irrelevant
   novelty, meaningful list diversity/semantic duplication, search identity,
   clear formatting and factuality of the title, explanation and summary.
   Flag harmful/unsupported assumptions, with **unknown/not assessable** distinct
   from pass. Rate shortlist-worthiness, whole-list helpfulness and A/B/tie/neither;
   permit a safe shortfall rather than rewarding padding. Have an appropriate
   safety reviewer independently evaluate child-age hazards and hard exclusions.
5. **Verify budgets and factual claims independently.** Compare parser output
   with the pre-registered ground truth and report parsed/unparsed denominators.
   Check actual offer identity, new condition, availability, currency and
   item-plus-delivery cost against timestamped, consented/authorized evidence or
   realistic deterministic fixtures; if not observable, mark affordability and
   availability unassessed. No purchase is needed. Separately fact-check product
   attributes and claims with recorded sources and contradictions, not by
   looking for the request's words in the answer.
6. **Pre-specify actionable gates.** As a proposed starting rule, prohibit
   promotion if any independently verified critical age/exclusion, offer-identity
   or hard delivered-budget failure occurs in the evaluated sample; zero
   observed failures is still not proof of zero population risk. For a primary
   1–5 relevance outcome, require an experimental-minus-baseline mean gain of
   at least 0.20 and a case-cluster 95% confidence interval excluding zero.
   Pre-register a diversity non-inferiority margin (for example −0.10 on a 1–5
   rubric), factuality and format thresholds, plus handling of the multiple
   co-primary gates *before* results. An inconclusive interval, unacceptable
   missingness or unassessed hard gate means no quality-promotion conclusion.
7. **Analyze at the correct unit.** Report all per-arm and paired case outcomes,
   ties/neither, shortfalls, failed/truncated generations, unknowns, strata,
   uncertainty and disagreements. Calculate pairwise agreement/weighted kappa
   or another pre-registered ordinal agreement measure; adjudicate only after
   recording independent ratings, and publish both. Use case-cluster bootstrap
   or another justified paired method, including rater and repeated-generation
   variability rather than treating ideas from one case as independent.
   Pre-register multiple-comparison handling. Use more than one generation per
   case when the approved budget supports it; report variance rather than
   treating a single draw as model behavior.
8. **Estimate and obtain separate cost approval.** Before any live call, quote
   current provider prices, model/settings, projected input/output tokens,
   retries, taxes and a maximum total spend with contingency. For 24 cases and
   two systems, 48 is only the number of primary case-system calls: the
   [runner retries up to three attempts](../../scripts/run-benchmark.js#L267-L279);
   a future two-system harness using the same policy could reach **144 attempts**
   in one pass, and resumed failures could exceed that. A transport failure can
   incur charge without recorded usage.
   `--confirm-cost` is not an enforced dollar limit, and the current runner does
   not implement the production baseline arm. Require an independently enforced
   spend/attempt ceiling and explicit operator approval of the ceiling and
   fresh output location before any new generation. Preserve all old inputs,
   outputs, reviews and snapshots.
