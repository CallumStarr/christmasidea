# Final independent assurance review

**Assessment date: 6 November 2026; updated 7 November 2026 after a targeted
engineering exercise (see below). Release decision: not ready for an
unqualified production or store release.** This is a bounded technical
assessment, not a guarantee of security, WCAG conformance, legal compliance
or commercial approval. The remediations are local and uncommitted; deployed
and installed versions have not been established.

Release gates are platform-specific. A website/Worker release depends on the
security, Cloudflare runtime, eBay, recovery, accessibility and privacy gates
below; it does not have to wait for iOS tooling. The Android and iOS app
releases additionally require signed builds and device testing on their own
platforms. None of these platform releases is currently cleared.

## Evidence package and definitions

The original [audit package](README.md), [architecture and feature register](architecture.md),
[findings](findings.json), [test report](test-report.md) and
[WCAG matrix](wcag-matrix.csv) remain available. This independent challenge
adds:

| Deliverable | What it contains |
|---|---|
| [Findings challenge](FINDINGS_CHALLENGE.md) | Each original finding, its baseline, regression, actual execution and remaining gap. |
| [ASVS review](ASVS_ASSURANCE_REVIEW.md) and [345-row matrix](ASVS_VERIFIED_MATRIX.csv) | Requirement-level applicability, level, evidence method, outcome, limitations and N/A reason. |
| [MASVS/MASTG matrix](MASVS_MASTG_MATRIX.md) | All 24 current mobile controls, source/APK evidence and device-based tests still needed. |
| [Android warning review](ANDROID_WARNING_REVIEW.md) | Every original warning, source, impact, disposition and post-change comparison. |
| [Accessibility manual log](ACCESSIBILITY_MANUAL_TESTS.md) | Actual local keyboard/browser observations, inconclusive tests and all 48 criteria needing manual review. |
| [Disaster recovery validation](DISASTER_RECOVERY_VALIDATION.md) | Disposable drills, limitations and an operator recovery runbook. |
| [Benchmark validity review](BENCHMARK_VALIDITY_REVIEW.md) | Replay methodology, malformed inputs, historical review limitations and a prospective blinded protocol. |
| [External verification register](EXTERNAL_VERIFICATION_REGISTER.md) | Account-dependent controls, concrete branch rules and safe eBay decision procedure. |
| [Final challenge inventory](FINAL_CHALLENGE_INVENTORY.json) | Final Git status and file hashes; the inventory does not hash itself. |

**Verified** means the stated narrow behavior has sufficient local evidence,
not that the entire control is certified. **Partially verified** means useful
evidence exists but scope or execution is incomplete. **Not verified** means
the claim has not been established. **Blocked** means necessary access,
equipment, approval or specialist evidence is unavailable. **Not applicable**
is conditional on the assessed architecture and must be reconsidered if it
changes. A source inspection is not a dynamic test.

## Repository state and evidence provenance

The original read-only baseline was a clean `main` at
`74a6ddf2b5855710f2a2e762b0805e57645f85c1`, with upstream `origin/main`.
The same HEAD and advertised remote `main` were reconfirmed during this
challenge. The challenge began on the intentionally dirty post-remediation
tree, not a clean checkout. The final inventory records every modified,
staged and non-ignored untracked file and its hash; ignored build outputs
are not represented as version-controlled changes. The original
[inventory](00-repository-inventory.md) records broader repository and
generated-file scope.

At the start of the challenge, all 71 changed-file hashes and 16 evidence
hashes in the prior manifest matched. Subsequently, the Android reviewer
overwrote the untracked historical [verification.json](verification.json)
with a later 76-entry snapshot. That overwrite should not have occurred.
All 71 original entries were reconstructed by reversing the recorded patch;
the candidate is valid JSON, 26,528 bytes, SHA-256
`8c8b69a771a1ed658c8b583cc783ef207991db7063bcdd6b9b56f984258dae99`,
and is [retained in the session](file:///C:/Users/callu/.copilot/session-state/aaf716de-e241-4533-a4cb-5885b5a13891/files/verification-original-71-entry-candidate.json).
The original whole-file hash was not recorded, so exact byte identity cannot
be independently certified. The later manifest and reconstructed candidate
are snapshots, not attestations of the final tree. Session evidence files
should be archived separately if this report must be portable.

## Original findings reconciled

The original register contains **22 unique findings**: **2 P1, 15 P2 and
5 P3**. It records **20 `fixed-verified`** and **2
`operator-action-required`**. Those priorities are project priorities, not
CVSS scores. No original finding was removed from the preserved register.

The independent, narrower reassessment is **10 Verified, 10 Partially
verified and 2 Blocked**. The [individual assessment](FINDINGS_CHALLENGE.md)
identifies the actual regression for each finding and explains where the prior
citation was incomplete or where local tests do not establish deployment,
device behavior or full scope. In particular, a passing test on the current
tree does not by itself prove it failed on the original baseline. The
preserved before-logs demonstrate only the specific red cases they contain.
The two blocked actions are SH-012, branch protection, and SH-021, eBay
campaign alignment; neither has been silently closed.

## ASVS 5.0.0: verified scope, not certification

All **345** official requirement IDs, levels and exact-description hashes were
checked against the authoritative OWASP 5.0.0 CSV, SHA-256
`6124dba176dc563f66363a11ae0c47f9b86b8a4a84c66a793670bd196ed86cd5`.
The matrix uses the first required level, with cumulative L2 including L1.

| Scope | Total | Verified | Partially verified | Not verified | Blocked | Not applicable | Applicable |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cumulative L1 | 70 | 4 | 28 | 10 | 6 | 22 | 48 |
| Cumulative L2 | 253 | 4 | 79 | 44 | 36 | 90 | 163 |
| All levels | 345 | 4 | 92 | 82 | 57 | 110 | 235 |

Across all levels, 50 rows cite automated local tests or scripted probes
alongside manual source inspection, 128 cite manual source/document review
only, 57 identify unavailable external evidence, and 110 are applicability
inspections. Manual source inspection is not a hands-on manual security test.
These are evidence-method labels, not 50 comprehensive control passes.
At least **82 applicable rows are Not verified and 57 are Blocked**; a
Partially verified row can also lack a complete dynamic test. Every N/A
has a specific reason. Five of seven previous Pass claims were downgraded,
and 11 previous N/A decisions were challenged. The latest local fixes
provide partial evidence for one formerly untested L3 error-handling row;
they do not establish L1, L2 or L3 conformance. The targeted exercise
promoted only V13.4.1 (Verified, on a read-only production probe) and V5.2.1
(Partially verified); with 4 of 48 applicable L1 rows Verified, there is still
**no evidence of ASVS L1 or L2 conformance**.

## Additional findings and local closure

| Observation before this challenge | Local change and regression | Residual limitation / owner |
|---|---|---|
| Twenty malformed discovery budgets and missing idea caps were counted as zero violations; missing-label entropy could exceed one; the completed-only truncation count was structurally zero. | [Metrics](../../scripts/engine-metrics.js) now report fully/partially/unassessed budgets, assessed and missing caps, and label counts, normalize entropy over labelled ideas and count actual truncation flags. [Regression tests](../../test/engine-metrics.test.js) pass. | No real prices or independent age-safety assessment; failed/missing attempts remain excluded. **AI/benchmark owner.** |
| A synthetic listing explicitly denying trains and magnetic connections was accepted for a magnetic train-track idea. | [Matcher](../../src/product-matcher.js) rejects the demonstrated same-term contradiction. Positive and negative [tests](../../test/product.test.js) include a non-contradictory negation followed by positive details. The targeted exercise extended this; see below. | Omitted attributes, image-only claims and arbitrary natural-language scope remain unresolved; no real listing incident was shown. **Commerce engineering owner.** |
| The baseline-mode Turnstile regression never reached its mock. | [Test](../../test/baseline-release.test.js) supplies the canonical host and requires exactly one Siteverify call. | Production widget, secret and account configuration remain blocked. **Security/operator.** |
| Canonical redirects bypassed the application's header wrapper. | [Worker handler](../../src/worker-fetch.js) now wraps redirects and preserves the native verification-frame exception; [tests](../../test/worker-boundaries.test.js) check actual local responses. | Deployed and platform-generated responses, strict CSP and subdomain HSTS are not established. **Security/SRE.** |
| Credentialed upstream calls followed redirects by default; a synthetic Node 307 forwarded a custom header across ports. | Anthropic, Turnstile, Amazon and eBay Worker requests use a shared [redirect guard](../../src/upstream-fetch.js): `redirect: "manual"` plus rejection of any 3xx/opaque-redirect response, mapped to each caller's existing network-failure handling. A [workerd regression](../../test/workerd-redirects.test.js) runs the bundled modules in local workerd (compatibility date `2026-10-01`): 301, 302, 303, 307 and 308 for all six credentialed calls (30 credential-bearing redirects) reached **zero** destinations, and ordinary success responses for all six still worked. A [Node regression](../../test/credential-redirects.test.js) and a source guard also pass. The Node-only benchmark/export scripts keep `redirect: "error"`, which Node supports. | Local workerd is not the Cloudflare edge; real provider endpoints, an attacker-controlled redirect and an actual leak were not exercised. A staged smoke test of each enabled provider is still required before deployment. **Security/integration owner.** |
| **Audit-introduced regression (found after the challenge report, before any commit or deployment):** the earlier redirect remediation used `redirect: "error"` in Worker code. Local workerd throws `TypeError: Invalid redirect value…` for that mode before any request is sent, so deploying it would have failed every Turnstile, Anthropic, Amazon and eBay call. The Node-only regression could not detect this. | Replaced with the guard above. A negative control (temporarily restoring `"error"`) makes the workerd regression fail; the fixed code passes. | Shows that Node-only tests are insufficient for Worker-runtime behavior. Other runtime differences have not been exhaustively assessed. **Security/integration owner.** |
| An injected feedback storage failure escaped the outer handler. | A last-resort boundary logs a sanitized area/error type and returns a generic, non-cacheable 500; storage and asset failures are [tested](../../test/worker-boundaries.test.js). | Sanitized logs deliberately omit exception details, which may limit forensics; process-level and deployed failures remain untested. **SRE/security.** |
| Preparing a new paired review could overwrite the original blind template and key used to interpret the scored sheet. | [Preparation](../../scripts/create-paired-review.js) now refuses existing files and accepts a fresh output directory; its [regression](../../test/paired-review.test.js) and an actual default-command refusal preserved both historical artifacts. | Eight saved explanations differ from current regeneration; independent reviewer identity, count and blinding remain unverified. **AI evaluation owner.** |
| Awin's feed key appears in an HTTPS URL path. | The existing script rejects feed-list redirects and sanitizes request errors. [Awin's own documentation](https://help.awin.com/developers/docs/product-feed-list-download) documents this path-based credential. Source inspection of [the sync script](../../scripts/sync-awin-catalogue.mjs) found that every thrown or logged message is a fixed string or numeric status, only `error.message` is printed, product-feed URLs are passed to the importer as local file paths, and the key is removed from the importer's environment. | A non-URL alternative was not established; upstream/proxy logs, GitHub Actions runner diagnostics and account retention remain unknown. Source inspection is not a dynamic log audit. No real key disclosure was demonstrated. **Integration/security owner.** |
| Full local D1 export failed on an FTS5 virtual table. | A selective synthetic data export, migration and restore reproduced a catalogue row and FTS hit. | This is not a full or remote backup; the actual account recovery path is blocked. **SRE/operator.** |
| The public eBay campaign is empty while the repository Worker has a campaign. | A [synthetic regression](../../test/ebay.test.js) demonstrates that the client rejects the tracked offer and photo-first selection can show no ideas. A [configuration-alignment test](../../test/ebay-config-alignment.test.js) now reads the committed `wrangler.toml` and `site/index.html` values and is recorded as a `todo` (expected failure) until the operator aligns them. No account or configuration was changed. | Actual deployed incidence and campaign approval are unknown. This is a release-blocking operator decision, not merely an attribution discrepancy. **Commercial owner/operator.** |

## Targeted engineering exercise (7 November 2026)

After the operator's review, six priorities were examined. Each has an explicit
disposition; "fixed" means a local, uncommitted, undeployed change with a
regression that was shown to fail when the fix is removed (mutation check).

| Priority | Work and evidence | Disposition |
|---|---|---|
| 1. Cloudflare runtime redirect handling | All six credentialed Worker `fetch()` calls use `fetchWithoutRedirect` (`redirect: "manual"` plus 3xx/opaque rejection). The workerd regression covers 301/302/303/307/308 for each call and successful responses (details above). | **Partially verified**: local workerd only; a staged edge smoke test is required before deployment. |
| 2. Applicable ASVS L1/L2 gaps | **Admin brute force (V6.3.1):** [core](../../src/core.js) now checks a per-IP-hash failure budget before comparing the admin bearer and records each mismatch in the [Durable Object](../../src/index.js) (`ADMIN_AUTH_HOURLY_FAILURE_LIMIT`, default 10/hour). A [workerd test](../../test/workerd-admin-auth.test.js) observed 10×401, then 429 even with the correct token from that IP, and 200 from another IP. **Feed resource limits (V5.2.1):** [sync](../../scripts/sync-awin-catalogue.mjs) caps the feed list (32 MiB) and each feed (2 GiB default); the [importer](../../scripts/import-awin-feed.mjs) caps field length and fields per row; [tests](../../test/awin-feed-limits.test.js) use oversized synthetic input. **Charset (V4.1.1):** a read-only production probe found HTML served as `text/html` with no charset; the [Worker](../../src/worker-fetch.js) now adds `charset=utf-8` to textual asset types that lack one, with a [regression](../../test/worker-boundaries.test.js). **VCS exposure (V13.4.1):** production returned 404 for `/.git/HEAD`, `/.git/config`, `/.env`, `/wrangler.toml` and `/package.json`. | **Partially verified.** Two ASVS rows were promoted (above). The admin throttle is bypassable by IP rotation, so token entropy stays primary; HSTS still lacks `includeSubDomains` (an L2 operator decision); many applicable rows remain unverified or blocked. |
| 3. Product identity and recommendation integrity | 28 adversarial and control probes against the matcher. **Before:** 16 incorrect listings were accepted at high confidence: synonym/inflected negation ("No magnets"), affix negation ("non-magnetic", "magnet-free"), verb negation ("lacks", "excluding"), packaging ("box only", "empty box", "instruction manual"), depictions ("Poster of"), imitations ("Felco-style", "inspired by", "alternative to"), toy replicas for adults, and refurbished/pre-owned titles. **After:** all are rejected (`title_identity_contradicted` or `listing_not_the_requested_item`). Ten false-positive controls still pass (for example "hands-free", "non-stick", "BPA-free", "retro-style", requested posters/toys, children's toy sets). [Tests](../../test/product.test.js) pin both sets. | **Partially verified.** Keyword rules cannot establish semantic identity: omitted attributes are still accepted, other paraphrases and languages are untested, and misleading listing images cannot be assessed from text. Real-listing sampling is needed. Recommendation quality remains **Not verified** pending the blinded human evaluation. |
| 4. eBay campaign configuration | Re-confirmed: [wrangler.toml](../../wrangler.toml) sets `EBAY_CAMPAIGN_ID = "5339240592"` with eBay discovery enabled; the public [site config](../../site/index.html) has `EBAY_CAMPAIGN_ID: ""`. The browser rejects every tracked eBay offer. A [todo test](../../test/ebay-config-alignment.test.js) keeps this visible against the real committed values. | **Blocked (operator decision).** No identifier was invented or changed. |
| 5. Feedback and knowledge-system integrity | **New finding, fixed locally:** 60 forged, unsigned legacy `/api/feedback` requests from one visitor (within its 40/min and 600/day limits) created a qualifying `proposePolicy` learning candidate. [Feedback keys](../../src/engine/feedback.js) now emit learning (`L|`) counters only for receipt-verified cards; coarse counters remain. Knowledge (`V|`) evidence already required receipts. [Tests](../../test/feedback-receipts.test.js) cover the forged-proposal path and confirm that verified cards still contribute. | **Partially verified.** Production may hold up to 90 days of mixed signed and unsigned learning counts. Learning ranking is disabled (`LEARNING_RANKING_ENABLED = "false"`) and policies require operator approval; any proposal should use only data collected after deployment. A receipt holder can still rate their own genuinely shown cards. |
| 6. Recovery and production configuration | A read-only production probe (GET only) showed CSP, HSTS (one year, no `includeSubDomains`), `X-Frame-Options: DENY`, `nosniff`, Referrer- and Permissions-Policy matching local [Worker headers](../../src/worker-fetch.js); `/api/health` returns only `{"ok":true}`. The local recovery drill was rerun and its text output is unchanged. | **Partially verified.** Account-side routes, WAF, secrets, remote D1/Durable Object backups and real rollbacks remain **Blocked** without operator access. |

During full-suite validation, the admin-throttle change broke an existing
storage-failure test because its mock stub lacked the new method; the request
failed closed with a 500. The mock was updated so the test again exercises the
storage failure it was written for.

## Mobile, Android and accessibility

**Mobile security: Partially verified overall.** The
[MASVS/MASTG matrix](MASVS_MASTG_MATRIX.md) covers STORAGE, CRYPTO, AUTH,
NETWORK, PLATFORM, CODE, RESILIENCE and PRIVACY. The prior Android debug APK
and compiled manifest were inspected; a debug build is not a release or
device test. The launcher is exported; other inspected providers and browser
activity are non-exported, and the exported AndroidX receiver requires
`android.permission.DUMP`. Android's legacy WebView bridge and iOS native
message-handler frame boundaries require controlled device tests; no exploit
was demonstrated. An actual signed APK/AAB or IPA, Xcode build, entitlements,
release privacy manifests, device storage/backup and store submissions remain
unverified or blocked.

**Android warnings: Partially verified.** All **32** original lint warnings
are individually accounted for. Two were corrected without suppression:
manifest permission order and explicit cloud-backup rules. The rebuilt debug
app passed lint with **0 errors and 30 remaining warnings**, and three native
unit tests passed. OEM device-to-device transfer behavior and the privacy
policy decision remain untested. The remaining warning dispositions, including
launcher branding and dynamic resource caveats, are in the
[warning register](ANDROID_WARNING_REVIEW.md).

**Accessibility: Partially verified, not WCAG conformant by assertion.**
The existing 55-row matrix has 28 Partial, 20 Not tested and 7 N/A; all 48
potentially applicable criteria need manual review. Local automation observed
skip navigation, focus entry/restoration, a trapped dialog, form error
association, a synthetic live status, a swipe alternative, one contrast pair
and reduced motion. Escape was inconclusive; viewport widths were not actual
200%/400% zoom tests. NVDA, VoiceOver, TalkBack, real native devices and
disabled participants were unavailable. See the [manual log](ACCESSIBILITY_MANUAL_TESTS.md).

## Recovery and recommendation assurance

**Recovery: Partially verified locally; production recovery Blocked.**
Isolated workerd switched real baseline/current Worker and HTML versions,
preserved a synthetic Durable Object quota across restarts, propagated a
simulated scheduled failure, and exercised mocked credential recovery. A
selective D1 restore and an intentionally failed synthetic migration behaved
as recorded in the [drill](DISASTER_RECOVERY_VALIDATION.md). This is not a
Cloudflare rollback, remote backup, cron retry guarantee, secret-manager
restore or measured RPO/RTO. Static assets and Worker code share a release;
D1 and Durable Object state do not automatically roll back with it.

**Recommendation quality: Not verified for release superiority.** Both
offline replays reprocess saved raw model outputs through today's
experimental engine; neither is a fresh generation nor a production-baseline
comparison. V3.3 replayed 30 cases; V3.4 replayed 50, of which only 30 had
assessable parsed budgets. The saved 28–2 preference cannot establish
independent reviewers or blinding. The
[evaluation plan](BENCHMARK_VALIDITY_REVIEW.md) specifies prospective frozen
inputs, independent blinded reviewers and ratings of relevance, suitability,
budget integrity, originality, diversity and factual accuracy. No paid call
was made and the production recommendation selection was not changed.

## Final local validation

| Check | Result and scope |
|---|---|
| `npm test` | **574 tests: 573 passed, 0 failed, 0 skipped, 1 todo** on the final source/test snapshot, including the workerd redirect and admin-throttle regressions. The todo is the deliberate eBay configuration-alignment expectation (blocked operator decision). Earlier runs: 564 passed before the targeted exercise; an earlier post-refactor run had three failing source-location assertions, which were updated to test actual responses before the full suite was rerun. |
| Offline replays | V3.3: 30/30 complete, 30 budgets and 237 idea caps assessed. V3.4: 50/50 complete, 30 budgets/240 caps assessed and 20 budgets/160 caps unassessed; discovery-only violation total is `null`. No model call. Outputs are byte-identical before and after the redirect fix. |
| `npx --no-install wrangler deploy --dry-run` | Passed, 329.39 KiB upload / 95.10 KiB gzip; **no deployment**. A dry-run bundles code but does not execute upstream fetches, so it could not detect the redirect-mode regression. |
| `node scripts\audit-recovery.mjs <new-empty-directory>` | Passed the synthetic local exercises described above, including the expected local full-export failure and selective restore. |
| Android debug build, lint and unit tests | Passed after the Android changes; 0 lint errors, 30 warnings and three unit tests. Shared web assets matched both native copies and the rebuilt APK at that snapshot. |
| iOS build, installed devices and assistive technology | **Blocked**, not inferred from synchronized assets. |

Evidence logs are retained in the session. Targeted-exercise SHA-256:
`targeted-full-tests.log` `e47e712ecc8ad3eecb89165ded24338ef6a6ae3d6960bff73c09e735a9598eb7`;
`assurance-final-replay-v33-v4.json` and `-v34-v4.json` are byte-identical to the
`-v3` hashes below; `assurance-final-worker-dry-run-v4.log`
`dc20c07e6488928529924c1f0e3371b975f5b86f51174d499f1b076fce20bd99`;
`assurance-final-recovery-v4.log` `c94b1298f800349207166bfefa3880a974af351eeffc605201c347489bcd9470`
(same text as `-v3`, written as UTF-16LE); `assurance-final-diffcheck-v4.log`
`d33f9259d9fc8b4a8545a985d3c1c4599d21fcf60005dba0700b20f970f58ecd` (line-ending
warnings only; exit 0); `targeted-prod-probe.log`
`4f91b36fa8a7edd14f3eb35337fd4bf119cd6e5ebb37cd97e3ceebdbb4a0b49e`.
Previous SHA-256:
`assurance-final-suite-v3.log` `77a8738f73eaa422fff7ab65fdc49bead2f7186d41496cfecd4f71c8a335f20b`;
`assurance-postfix-tests.log` (the intermediate three-failure run)
`f0f01293a61977eac4b2c6809fd75af72ff38ba7dde7aaea06b432782500d258`;
`assurance-final-replay-v33-v3.json` `4b97f113fe1df0946cec9a50cb16f3b73834014a67a16274c1d2424f4222b521`;
`assurance-final-replay-v34-v3.json` `05d518356f5a7d867b774eef8ed56a5c6f3e90a5877083112e4e32d4caeb742a`;
`assurance-final-worker-dry-run-v3.log` `62d6cad6afaabafaee6fe945c474d4824b5e9cd9696ed60e1668190f20da5a84`;
`assurance-final-recovery-v3.log` `d2eb27187788f96fa0ff7c7022856ad1401e9819a4e20c667c3ecf13cdd4209d`
(identical to the pre-fix run; the drill's output is deterministic);
`android-warning-review-final.log` `789e31f217297fb385662776e1c8023cac2d8a2d60da9a4304758fa68e2b9b3e`.
The superseded `-v2` logs (562 tests) are retained in the session.
These hashes identify logs, not independently signed build provenance.

## Release gates and accountable owners

The [external register](EXTERNAL_VERIFICATION_REGISTER.md) distinguishes
repository configuration from independently verified account settings.
Outstanding actions are grouped below; the linked matrices and registers
retain requirement- and warning-level details.

1. **Repository administrator:** configure and verify a `main` ruleset with
   PRs, the exact `test-and-replay` Actions check, up-to-date branches, no
   force push/deletion and a narrowly audited break-glass bypass. Require an
   independent approval when a second maintainer exists; do not make
   scheduled-only Awin or feedback jobs required PR checks.
2. **Commercial owner/operator:** privately verify the actual eBay account's
   authorized campaign and decide between approved aligned tracking or
   untracked Worker offers. The repository Worker currently sets campaign
   `5339240592`; the public `GIFT_CONFIG.EBAY_CAMPAIGN_ID` is empty. Test the
   chosen configuration in an authorized staging/sandbox flow without a
   purchase. Verify Amazon, Awin, CJ, Skimlinks and each advertiser's current
   permissions, licences, disclosures and agreements before relying on them.
3. **Security/engineering:** work through applicable L1/L2 ASVS rows that are
   partial, unverified or blocked. Admin throttling, unsigned-feedback learning
   poisoning, feed caps and the asset charset are now fixed locally, but need
   deployment and recheck. Decide on HSTS `includeSubDomains` and a Cloudflare WAF
   rule for admin paths; review legacy (tokenless) feedback retirement, CSP and
   full failure/logging coverage. Before deploying this tree, run an approved
   staging smoke test of Turnstile, Anthropic and each enabled provider on the
   real Workers runtime (local workerd passed; the edge was not exercised).
   Sample real listings to assess product-identity matching for omitted,
   ambiguous or image-only attributes and further paraphrases.
4. **SRE/operator:** verify Cloudflare routes, WAF, bindings, deployed headers,
   production secret presence/entropy/rotation and Turnstile settings privately.
   Establish and rehearse remote D1 and Durable Object recovery, secret
   restoration, scheduled-job alerts/retry, RPO/RTO, capacity, provider
   outages, cancellation and monitoring in an approved isolated environment.
5. **Mobile/release owner and mobile security tester:** build and inspect
   signed Android and iOS releases, privacy manifests, entitlements, store
   declarations and applicable MASTG tests; exercise real devices, native
   bridge/frame boundaries, deep links, network/storage and backup. The
   product/privacy owner must decide Android device-transfer policy and
   review the remaining warning/branding decisions.
6. **Accessibility specialist/product owner:** test NVDA, VoiceOver and
   TalkBack, physical keyboard Escape, all dialogs/forms/status updates,
   touch alternatives, actual zoom/reflow, contrast and reduced motion;
   include disabled participants and record criterion-level outcomes.
7. **AI/product evaluation owner:** repair or replace malformed evaluation
   inputs prospectively, preserve historical artifacts, obtain approval for
   any paid live calls, then run the blinded independent protocol and report
   uncertainty, failures and missingness without changing production mode.
8. **Privacy/legal owner:** assess UK GDPR/PECR, children's/online-safety
   scope, shared-cache and local-storage retention/deletion, consent or
   objection, third-party processing agreements and merchant contracts with
   qualified advice. Documentation alone is not legal compliance.
9. **Supply-chain and product owners:** verify signed release provenance and
   native/JS dependency inventories; assess the remaining memory-soak,
   calendar/share, indexing, conversion and support evidence in the
   [outstanding risk register](outstanding-risks.md).
10. **Audit owner:** retain the reconstructed manifest candidate and the
    separate final inventory; if an independent original copy exists, compare
    it before claiming byte-for-byte recovery. Archive session logs for
    reproducibility.

No production deployment, commit, push, purchase, paid model call, secret
rotation, integration activation, store publication or external account
change was performed. These gates are outstanding; the existence of this
report does not close them.
