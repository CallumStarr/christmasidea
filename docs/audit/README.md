# Santa's Helper: audit and hardening report

**6 November 2026 | independent, bounded technical assessment | not a security,
accessibility or legal certification**

> **Independent challenge and latest release assessment:**
> [FINAL_ASSURANCE_REVIEW.md](FINAL_ASSURANCE_REVIEW.md). The original
> findings, test totals and evidence below describe the earlier audit snapshot;
> the challenge reassesses every finding, identifies further limitations and
> records subsequent local changes and validation.

Baseline: `main` at `74a6ddf2b5855710f2a2e762b0805e57645f85c1`, matching
advertised remote main with a clean starting tree. Changes in this package are
local and uncommitted. **Nothing was deployed, pushed, purchased or activated.**
No paid model evaluations, production database writes, secret rotations or
external account-setting changes were performed.

## Executive judgement

The codebase is **materially hardened, but full-platform launch assurance remains
partial**. Existing tests missed real budget, product-constraint, storage, race,
calendar and native compatibility defects. Twenty of 22 recorded findings now
have source fixes and local verification. Two require an operator decision or
external configuration. Additional unverified risks are explicitly tracked rather
than treated as passing.

The strongest evidence is deterministic API/commerce/feedback testing, real local
Durable Object quota concurrency, shared-browser functional checks, generated
asset preparation and an Android debug build/lint. The weakest evidence concerns
actual iOS/device behavior, manual accessibility, provider/account contracts,
privacy/legal decisions, production recovery/capacity and new human-rated AI
quality. Do not promote the experimental recommender on this audit's evidence.

### Principal results

- Original full suite: **487 passed**. Final suite: **549 passed**; requested
  frontend/native/commercial selector: **99 passed**.
- Worker production dry-run: **323.13 KiB / 93.43 KiB gzip**; no deployment.
- Both offline benchmark replays passed. Added 24 difficult scenarios (74 distinct
  scenarios total), **not** 24 newly evaluated live model outputs.
- Android debug compilation, lint and unit task passed; **0 lint errors,
  30 warnings**, three native unit tests. Both native asset bundles synced.
  iOS compilation/distribution remains blocked by unavailable Mac/Xcode.
- Local SQLite-backed workerd tests held AI and product reservations at their
  configured caps under 10/50/100 concurrent callers.
- 18 public pages had no detected overflow at three widths. Automated axe scans
  found no violations but had incomplete contrast checks; this is **not WCAG AA
  conformance**.
- Available-history and worktree Gitleaks scans found no matches; npm audit
  reported zero advisories. Neither result proves secrets or vulnerabilities absent.

## Deliverables

| Deliverable | Evidence |
|---|---|
| A. Executive assessment and gates | This report |
| B. Exact inventory and architecture/data flow | [Inventory](00-repository-inventory.md), [architecture and feature register](architecture.md) |
| C. Audit/control matrix | [Framework matrix](audit-matrix.md), [345 ASVS IDs](asvs-matrix.csv), [WCAG criteria matrix](wcag-matrix.csv) |
| D. Findings register | [Findings](findings.md), [machine-readable evidence](findings.json) |
| E. Privacy/compliance assessment | [Privacy and technical compliance](privacy-compliance.md) |
| F. AI and benchmark evaluation | [AI quality](ai-quality.md), [additional scenarios](../../benchmarks/audit-2026/README.md) |
| G. Mobile/platform parity | [Website, Android and iOS](mobile.md), [individual Android warning review](ANDROID_WARNING_REVIEW.md) |
| H. Commerce, SEO and asset integrity | [Commercial integrity](commercial-integrity.md) |
| I. Performance, reliability and costs | [Performance/reliability](performance-reliability.md) |
| J. Reproducible verification | [Test report](test-report.md), [local load harness](../../scripts/audit-load.mjs) |
| K. Implemented remediation | [Remediation and release notes](remediation.md) |
| L. Outstanding risks/access limits | [Risk register](outstanding-risks.md) |
| M. Prioritised next actions | [Roadmap](roadmap.md) |

The [lock-derived component inventory](lock-inventory.cdx.json) supplements supply
chain review; it is not a signed build SBOM or native transitive dependency audit.
The [verification manifest](verification.json) is a later Android-review
snapshot, not the preserved original or the final challenge inventory. Its
overwrite and reconstructed-candidate limitation are documented in the
[final assurance review](FINAL_ASSURANCE_REVIEW.md); see the separate
[final challenge inventory](FINAL_CHALLENGE_INVENTORY.json) for the later tree.
These reports are outside the static asset directory. They are **not confidential**
if committed to the public repository.

## Acceptance gates: deliberately not all green

| Gate | Result | Why |
|---|---|---|
| Establish state and preserve existing work | Pass | Clean baseline recorded; no reset, commit, deploy or external mutation |
| Confirmed in-scope code defects fixed/regressed | Pass within recorded scope | 20 fixes; 2 operator findings remain open |
| Core API, quotas, token and product controls | Partial | Extensive local negatives; deployed configuration and full ASVS L2 not certified |
| Reproducible shared build/test checks | Pass locally | 549 tests, generation, sync, replays, dry-run; new CI has not run remotely |
| All platforms independently verified | Partial | Android debug passes; iOS and physical devices outstanding |
| AI safety and superior recommendation quality | Partial | Deterministic repairs, unchanged baseline winner; no new live/human evaluation |
| Accessibility and user journeys | Partial | Browser flows/responsiveness/axe; no assistive-tech or complete manual audit |
| Privacy, child safety and legal compliance | Requires specialist/operator | Legal bases, contracts, storage objections, audience/scope not determined |
| Affiliate approval and commercial outcomes | Requires external evidence | Accounts, licensing, conversions and campaign alignment unverified |
| Production resilience and performance SLOs | Not established | One lab navigation and isolated quotas; no RUM percentiles or restore drill |
| Secrets, release governance and supply chain | Partial | Redacted scans/pins; secret entropy and branch protection remain unresolved |
| Released to website and installed apps | Not performed | Explicitly excluded from audit authority |

The absence of a confirmed critical exploit is not evidence of complete security.
The matrices retain **Not tested**, **Partial** and **Requires external access**
where justified; a passing test is never substituted for a broader certification.
