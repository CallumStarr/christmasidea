# Independent challenge of the 22 findings

## Scope, classifications and evidence

This is a challenge of [the prior register](findings.json#L7-L295), not a claim that the
changes have shipped. The comparison base is Git object
`74a6ddf2b5855710f2a2e762b0805e57645f85c1`; the working tree is intentionally dirty.
`B` links below point to that immutable version. Current-source links point to the
working tree. The register claims 20 `fixed-verified` findings and two operator
actions; all 22 are assessed individually below.

**Verified** means the *specified narrow local behavior* has a relevant passing
regression and corroborating source; it does not mean deployed, comprehensive or
device-tested. **Partially verified** means the original example is supported but
the stated scope, regression or deployment evidence has a material gap.
**Blocked** means closure depends on an operator decision/action. **Not verified**
means evidence is insufficient for the stated claim. **Not applicable** means a
code regression is not the appropriate closure for an external operator action.
The independent assessments are 10 Verified, 10 Partially verified and two Blocked.

Execution evidence is retained outside the repository in the prior session:

- `V` = [`verified-tests.log`](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/verified-tests.log);
  `V:619`, for example, denotes its line 619. The footer at `V:767–772`
  reports 549 passed, zero failed/skipped. Its SHA-256 agrees with
  [verification.json:78–79](verification.json#L78-L79).
- `T-before` = [`turnstile-before.log`](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/turnstile-before.log),
  with three failures at lines 11–14 and 20–57. `W-before` =
  [`guardrails-before.log`](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/guardrails-before.log),
  with three failures at lines 1–7. The former log's hash is recorded in
  [verification.json:106–107](verification.json#L106-L107).
- `A-before` = [`android-lint.log`](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/android-lint.log),
  lines 473–474 and 578; `A-after` =
  [`android-verified.log`](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/android-verified.log),
  lines 421, 515, 528–531. The latter hash is in
  [verification.json:90–91](verification.json#L90-L91).

The then-current inventory's 71 recorded changed-file hashes and all 16 recorded
evidence hashes matched when independently checked, before concurrent Android
review updates. A later check of the expanded inventory matched 76/76 recorded
changed-file hashes and 18/18 evidence-log hashes. These are snapshot checks,
not cryptographic attestations binding a test process to those files or claims
that the final tree is frozen. The original
[487-pass baseline](test-report.md#L10-L14) did not contain these later regression
tests; a passing old suite is not proof that the original defects were absent.
Apart from the retained before logs identified above, no independent execution of
the new tests against the baseline is claimed.

**Historical-manifest provenance:** the Android review subsequently overwrote
the original untracked 71-entry [verification.json](verification.json) with a
later 76-entry snapshot. The original bytes were not separately preserved and
there was no recorded whole-file hash. A candidate was reconstructed by
reversing the logged patch; it has 71 entries, the original recorded length
26,528 bytes and SHA-256
`8c8b69a771a1ed658c8b583cc783ef207991db7063bcdd6b9b56f984258dae99`.
The [candidate](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/verification-original-71-entry-candidate.json)
is retained separately; exact byte identity cannot be independently certified.
Neither it nor the later manifest is an immutable attestation of the final tree.

## Individually challenged register

| Finding and assessment | Before → current source | Exact regression, execution and adequacy |
|---|---|---|
| [SH-001](findings.json#L9-L20) **Verified** | [B: recipient budget](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/recipient.js#L71-L98) skipped `more than`/`over` before recognizing negation. [Current parser](../../src/recipient.js#L48-L73) gives hard ceilings precedence. | [Negated ceilings and floors](../../test/recipient-commerce-constraints.test.js#L28-L40) assert £20 parsing and rejection of a £25 estimate, with genuine-floor counterexamples; `V:619`, rerun passed. [Baseline release parity](../../test/baseline-release.test.js#L31-L75) is not itself a negated-budget regression. Natural language and actual delivered prices remain outside this proof. |
| [SH-002](findings.json#L22-L33) **Partially verified** | [B: product spec](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/validate.js#L26-L43) omitted recipient exclusions. [Current spec](../../src/validate.js#L26-L45), [bounds](../../src/product-constraints.js#L7-L28) and [matcher](../../src/product-matcher.js#L143-L148) carry and enforce them. | [Leather versus paper, overflow, fake product search and receipt tampering](../../test/recipient-commerce-constraints.test.js#L55-L129) assert rejection/acceptance and compatibility; `V:621–624`, rerun passed. [Browser API test](../../test/feedback-receipts.test.js#L174-L189) checks token forwarding (`V:390`). The cited [frontend exclusion flow](../../test/frontend-exclusion-flow.test.js#L130-L179), `V:430`, tests *already-shown titles*, not an end-to-end leather listing. Legacy unsigned/pre-upgrade receipts are deliberately accepted; no live listing or all-language coverage is proved. |
| [SH-003](findings.json#L35-L46) **Verified** | [B: exclusion regex](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/recipient.js#L112-L121) recognized `no` only at sentence boundaries. [Shared parser](../../site/recipient-language.js#L35-L54) also recognizes tested inline clauses. | [Inline `no leather` and harmless/negated phrases](../../test/recipient-commerce-constraints.test.js#L42-L53) test actual curation plus false-positive controls; `V:620`, rerun passed. This is not a comprehensive exclusion/allergen or multilingual parser. |
| [SH-004](findings.json#L48-L59) **Verified** | [B: matcher](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/product-matcher.js#L52-L56) reduced required variants to stem sets. [Current variant matching](../../src/product-matcher.js#L60-L68) retains ordered system/unit tokens. | [UK/US 8, S/M, cm/mm and model X2/X3](../../test/recipient-commerce-constraints.test.js#L131-L140) include both positive and negative cases; `V:625`, rerun passed. They require explicit `requiredVariants`; they do not prove title/query/product identity, for which a new counterexample is recorded below. |
| [SH-005](findings.json#L61-L72) **Partially verified** | [B: importer](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/scripts/import-awin-feed.mjs#L197-L220) had no condition gate. [Current importer](../../scripts/import-awin-feed.mjs#L197-L222) requires consistent explicit `new`; [empty import](../../scripts/import-awin-feed.mjs#L409-L416) aborts. | [Condition matrix and empty-import abort](../../test/awin.test.js#L61-L115), plus [enriched import fixture](../../test/catalogue-enrichment.test.js#L48-L120), have archived passes `V:37–38,109` and were subsequently rerun in the full local suite. They assert SQL contents and no publication/cleanup, with Wrangler unavailable to the abort fixture. Existing remote catalogue generations and merchant conditions remain unverified. |
| [SH-006](findings.json#L74-L85) **Partially verified** | [B: feed-list allowlist](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/scripts/sync-awin-catalogue.mjs#L71-L77) admitted a name alias outside explicit IDs. [Current check](../../scripts/sync-awin-catalogue.mjs#L71-L78) makes the supplied IDs authoritative. | The [nested feed-list test](../../test/awin.test.js#L264-L315) asserts an aliased ID is rejected and an unrestricted joined ID is accepted; `V:44–46`, and it was subsequently rerun in the full local suite. The register's wording that aliases are applied when no IDs are supplied is imprecise: with a null allowlist the current code permits **all joined advertisers**, not only name aliases. Actual account membership is unverified. |
| [SH-007](findings.json#L87-L98) **Verified** | [B: generic offer validation](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/offer-validation.js#L38-L46) truncated IDs at 40 characters. [Current validation](../../src/offer-validation.js#L38-L47) preserves bounded provider IDs before provider validation. | [Two distinct long Awin IDs and an invalid overlong ID](../../test/awin.test.js#L50-L59) check full identity and client validity; `V:36`, independently rerun one test passed. No live Awin attribution was checked. |
| [SH-008](findings.json#L100-L111) **Partially verified** | [B: commercial parser](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/monetization-data.js#L27-L45) only recognized numeric `year-old` forms; [current code](../../site/monetization-data.js#L28-L48) shares age/constraint parsing. | [Five-year-old, aged 5, 5yo and constraints](../../test/recipient-commerce-constraints.test.js#L142-L151) assert no sponsor; [separate inventory test](../../test/monetization.test.js#L158-L167) has a positive demo control. `V:626,536`; rerun passed. The first test lacks a same-fixture positive assertion; an independent benign-adult probe selected that fixture, whereas the tested child/constraint inputs returned null. No live placement was exercised. |
| [SH-009](findings.json#L113-L124) **Partially verified** | [B: entropy](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/scripts/engine-metrics.js#L66-L75) divided by `log(1)`; [current code](../../scripts/engine-metrics.js) returns zero for one strategy and normalizes mixed labels over labelled ideas. | The prior register cited a test that did not cover the single-strategy case; the real regression is [recipient-commerce-constraints](../../test/recipient-commerce-constraints.test.js#L153-L157). A newly discovered mixed-label example originally returned **1.057**; a new [regression](../../test/engine-metrics.test.js) now checks the corrected value and missing-label counts. Neither historical replay contained that mixed case. |
| [SH-010](findings.json#L126-L137) **Partially verified** | [B: Siteverify](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/core.js#L137-L150) bypassed a missing secret and accepted `success` alone. [Current checks](../../src/core.js#L137-L177) and [required setting](../../wrangler.toml#L25-L31) fail closed and check context. | [Security fixtures](../../test/turnstile-security.test.js#L25-L112) and [both widget sources](../../test/turnstile-token.test.js#L10-L75) assert config, host/action, replay and fixed action; `T-before:11–14`, `V:727–742`, rerun passed. The [baseline-mode test](../../test/baseline-release.test.js) originally lacked `CANONICAL_HOST` and made zero Siteverify mock calls; it now supplies a canonical host and asserts one call. Legacy absent/empty actions remain allowed; real production configuration and deployed behavior were not checked. |
| [SH-011](findings.json#L139-L150) **Partially verified** | [B: quality workflow](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/.github/workflows/quality.yml#L11-L22) used `@v4` tags and lacked the added gates. [Current workflow](../../.github/workflows/quality.yml#L11-L25) pins SHAs and lists generation, app and dry-run checks. | [Guardrails](../../test/audit-guardrails.test.js#L7-L30) check SHA *shape*, command strings and permissions; `W-before:1–7`, `V:32–33`, rerun passed. Read-only upstream commit lookups found both pinned SHAs in their respective action repositories. The tests do not establish release-tag provenance, CI execution, action behavior or branch enforcement; changed workflows have not run remotely. |
| [SH-012](findings.json#L152-L163) **Blocked** | CI configuration is not branch protection. The [prior observation](outstanding-risks.md#L7-L10) remains an operator action. | **Not applicable:** no code-fix regression was claimed. A fresh read-only GitHub REST check, with repository `admin=true`, returned `404 Branch not protected`, zero repository rulesets and zero environments. This does not establish organization-level policy or future state. Operator must configure and verify enforceable review/check/bypass policy; nothing was changed. |
| [SH-013](findings.json#L165-L176) **Partially verified** | [B: privacy copy](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/privacy.html#L67) denied a name field and implied one 50-item shortlist; [B: status](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/PROJECT_STATUS.md#L7) claimed 30 identical lists. [Current copy](../../site/privacy.html#L67) and [status](../../PROJECT_STATUS.md#L7) are narrower. | [Privacy guard](../../test/audit-guardrails.test.js#L32-L37) checks named lists, limits and shared copies; `V:34`, rerun passed. [Site privacy tests](../../test/site.test.js#L251-L277), `V:692–693`, address other privacy text, not engine flags, 29/30 parity or all status claims; they were not freshly rerun. The [release parity test](../../test/baseline-release.test.js#L31-L75) covers titles/order, not all content. Legal accuracy and deployed app copies are not established. |
| [SH-014](findings.json#L178-L189) **Verified** | [B: wishlist read](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/wishlists.js#L14-L33) threw on corrupt items, while [B: write](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/wishlists.js#L54-L57) overwrote storage. [Current read/write](../../site/wishlists.js#L41-L86) preserves corrupt originals. | [Byte-preservation, malformed metadata, legacy recovery and finder/guide tests](../../test/frontend-state-regressions.test.js#L45-L95) and [finder/guide behavior](../../test/frontend-state-regressions.test.js#L125-L178) check retained bytes and no writes; `V:439–441,445,449`, rerun passed. Storage and UI are mocked; device deletion and cloud recovery are not covered. |
| [SH-015](findings.json#L191-L202) **Verified** | [B: swipe finish](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/swipe-deck.js#L175-L189) invoked an action after the captured card could change. [Current refresh/finish](../../site/swipe-deck.js#L79-L82) cancels obsolete gestures and [binds finish](../../site/swipe-deck.js#L175-L190) to that card. | [Changed-card, both swipe directions, tap and reappearing card](../../test/swipe-deck.test.js#L237-L267) assert no advance/like, no opened next card and released capture; `V:704–705`, rerun passed. Physical touch/native lifecycle remains untested. |
| [SH-016](findings.json#L204-L215) **Verified** | [B: shared decode](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/monetization-ui.js#L342-L383) lacked invalidation on a new finder and in the stale error path. [Current invalidation](../../site/monetization-ui.js#L320-L323), [decode](../../site/monetization-ui.js#L344-L384) and [finder call](../../site/index.html#L1158-L1161) guard both. | [Delayed success, delayed failure and current decode](../../test/frontend-state-regressions.test.js#L213-L250) check rendered results, notices and current operation; [actual finder event](../../test/frontend-exclusion-flow.test.js#L78-L92) checks the call boundary. `V:423,451–453`, rerun passed; VM/DOM fixtures are not a native lifecycle soak. |
| [SH-017](findings.json#L217-L228) **Verified** | [B: date](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/calendar-reminder.js#L5-L13) used the fourth Friday. [Current date](../../site/calendar-reminder.js#L5-L14) uses the day after the fourth Thursday. | [2000–2100 independent defining-rule loop and rollover](../../test/frontend-state-regressions.test.js#L252-L262) includes five-Friday Novembers; `V:454`, rerun passed. It does not import an ICS into any calendar application. |
| [SH-018](findings.json#L230-L241) **Verified** | [B: two writes](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/wishlists.js#L54-L57) could throw after primary persistence. [Current result](../../site/wishlists.js#L75-L86) distinguishes mirror failure. | [Primary failure versus mirror failure](../../test/frontend-state-regressions.test.js#L97-L108), [finder notice](../../test/frontend-state-regressions.test.js#L139-L146), [guide notice](../../test/frontend-state-regressions.test.js#L181-L187) and [shared save](../../test/frontend-state-regressions.test.js#L240-L250) test persistence and messaging; `V:442,446,450,453`, rerun passed. These are storage/UI mocks. |
| [SH-019](findings.json#L243-L254) **Verified** | [B: UID interpolation](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/calendar-reminder.js#L29-L46) accepted line controls; [current helper](../../site/calendar-reminder.js#L29-L32) rejects them. | [CR/LF, NUL, tab, invalid types, valid escaped Unicode and 75-byte folding](../../test/frontend-state-regressions.test.js#L264-L274) are asserted; `V:455`, rerun passed. This is a direct helper defense, not evidence of an exposed attacker-controlled UI path. |
| [SH-020](findings.json#L256-L267) **Partially verified** | [B: upstream body](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/core.js#L228-L235) read error text and [B: catch](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/src/core.js#L530-L536) logged detail/exception. [Current source](../../src/core.js#L257-L263) cancels the body and [logs fixed text/status](../../src/core.js#L565-L570). | [Synthetic body/exception marker](../../test/api-boundaries.test.js#L95-L111) asserts no marker in responses and exact sanitized logs; [Turnstile warning test](../../test/turnstile-security.test.js#L114-L121) checks its fixed reason. `V:22,738`, rerun passed. Neither asserts the response stream's `cancel` call; the UI storage-error log changes are not covered by a log-capture assertion. No real leak or deployed logger was established. |
| [SH-021](findings.json#L269-L280) **Blocked** | [B: public eBay campaign](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/site/index.html#L40-L44) was empty while [B: Worker campaign](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/wrangler.toml#L52-L54) was nonempty. The [current public value](../../site/index.html#L40-L44) and [Worker value](../../wrangler.toml#L55-L57) still differ. | **Not applicable:** no code-fix regression was claimed. Source divergence is verified, but approval, intended attribution, deployed configuration and any lost revenue are **Not verified**. Commercial/operator intent and permission are required before alignment; no links were purchased through or activated. |
| [SH-022](findings.json#L282-L293) **Partially verified** | [B: base Android theme](https://github.com/CallumStarr/christmasidea/blob/74a6ddf2b5855710f2a2e762b0805e57645f85c1/android/app/src/main/res/values/styles.xml#L12-L18) put an API-27 attribute in base resources. [Current base](../../android/app/src/main/res/values/styles.xml#L12-L19) and [v27 theme](../../android/app/src/main/res/values-v27/styles.xml#L3-L6) separate it. | [Source guard](../../test/audit-guardrails.test.js#L39-L46) passed (`V:35`, rerun). `A-before:473–474,578` records `NewApi` failure; `A-after:421,515,528–531` records build/lint success. The **historical** [lint report](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/android-warning-review-original.txt) line 199 had 0 errors/32 warnings. A concurrent [Android warning review](ANDROID_WARNING_REVIEW.md#L89-L106) subsequently ran assemble/lint/tests: its retained [log](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/android-warning-review-final.log) lines 456, 506, 532 and 534 records success, and its [final lint](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/android-warning-review-final.txt) line 167 says 0 errors/30 warnings. I independently checked those files and test XML showing three passes; I did not rerun Gradle. No API-24/27 device, restore or release-signed build was checked. |

## New actionable observations for the parent

These are additional findings, not extra rows in the prior 22-finding register.
The observations below were made before the subsequent local fixes; their
remediation and remaining limits are explicit.

1. **Benchmark input corruption and false budget reassurance:** all 20 discovery
   inputs contain literal `?` before the intended budget, so current parsing finds
   no cap. The old replay's zero over-budget metric therefore excluded all 20.
   The corrected metric reports 30 assessed and 20 unassessed. Nine
   cases contain 12 shown *match caps* more than 10% above the numbers indicated by
   their evaluation focus. This is not evidence of actual retailer prices. See
   [the measured example and reproduction](BENCHMARK_VALIDITY_REVIEW.md#budget-inputs-invalidate-the-zero-claim).
2. **Product identity counterexample:** current replay of case-31 emits a magnetic
   train-track title with a generic toddler-blocks query; a synthetic listing
   explicitly saying it has no trains or magnetic connections originally scored
   1.0, `high`, accepted. The matcher now rejects this same-term explicit
   contradiction with positive and negative regressions; synonyms, ambiguous
   scope and omission without negation remain unresolved. The candidate itself still survives `curateIdeas`. No live
   offer or production incident is asserted. See
   [the reproduction](BENCHMARK_VALIDITY_REVIEW.md#additional-actionable-observations).
3. **Mixed strategy labels:** the entropy function originally returned 1.057 for
   two differently labelled ideas plus one unlabelled idea; it now normalizes
   over labelled ideas and reports missing labels. A regression was added.
   Neither historical replay exercised this adjacent defect.
4. **Review and test drift:** eight historical paired-review cases have different
   explanations when the template is regenerated today; the scored sheet was not
   re-rated. The baseline-mode Turnstile test does not reach its mock as described
   in SH-010. The test now asserts its mock call, and preparation refuses to
   overwrite existing review artifacts. Independent re-review remains outstanding.

### Targeted engineering exercise (7 November 2026)

5. **Unsigned feedback could poison learning proposals (new):** 60 forged
   tokenless `/api/feedback` requests from one visitor, within its per-visitor
   limits, produced a qualifying `proposePolicy` candidate. Unsigned bodies now
   add no learning counters; a regression reproduces the forged path and a
   mutation check confirmed it fails without the fix. Pre-fix production counts
   may be mixed; learning ranking is disabled and proposals need approval.
6. **Product identity, extended:** in a first probe set, 16 listings that should
   have been rejected (affix, verb and
   inflected negation; packaging, depictions, imitations, adult toy replicas,
   refurbished/pre-owned) were accepted at high confidence. All are now rejected,
   and 10 legitimate controls still pass. Omission and image-only claims remain
   unresolved.
7. **Admin authentication had no failure throttle; HTML lacked a charset; Awin
   feeds had no byte caps:** each is fixed locally with a regression (see
   [the final review](FINAL_ASSURANCE_REVIEW.md#targeted-engineering-exercise-7-november-2026)).
   None is deployed.
8. **SH-021 remains Blocked.** A `todo` test now compares the real committed
   Worker and public campaign values so the mismatch stays visible.

## Checks performed during this challenge

Without producing test artifacts, the following direct Node selector ran **130
tests, 130 passed, zero failed/skipped**, including the relevant synthetic API,
recipient, UI, benchmark and guardrail suites:

```powershell
node --test test\recipient-commerce-constraints.test.js test\feedback-receipts.test.js test\frontend-exclusion-flow.test.js test\engine-metrics.test.js test\turnstile-security.test.js test\turnstile-token.test.js test\api-boundaries.test.js test\audit-guardrails.test.js test\frontend-state-regressions.test.js test\swipe-deck.test.js test\baseline-release.test.js test\monetization.test.js test\benchmark.test.js test\paired-review.test.js
node --test --test-name-pattern='Awin identities retain their full provider-specific length' test\awin.test.js
```

The second command ran one test, passed. At that initial point Awin's
filesystem-writing tests, page generation and Gradle had not been rerun; the
full suite and Android checks were subsequently rerun. Both offline replays and the 24-case dry
selection were run without output paths; details and exact results are in the
[benchmark review](BENCHMARK_VALIDITY_REVIEW.md). No paid-model call, purchase,
deployment, commit or external mutation was made. Local simulated tests do not
establish installed-app or production behavior.
