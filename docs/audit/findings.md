# Findings register

Baseline: `74a6ddf2b5855710f2a2e762b0805e57645f85c1`.
**20 fixed and locally verified; 2 operator actions outstanding; none deployed.**
The [JSON register](findings.json) records each reproduction, original result,
impact, exact source files, regression tests, platform scope and limitation.

P1/P2/P3 are engineering priorities, not vulnerability scores. In particular,
budget, sizing, storage and calendar correctness findings are not represented as
remote exploits. No CVSS was assigned without a defensible attack model.

| ID | Priority | Finding | Outcome |
|---|---|---|---|
| SH-001 | P1 | Negated budget ceilings treated as floors | Fixed; counterexamples and baseline regressions |
| SH-002 | P1 | Product enrichment lost exclusions | Fixed; hard bounded constraints and additive receipt integrity |
| SH-003 | P2 | Inline no exclusions missed | Fixed; shared parsing |
| SH-004 | P2 | Variant size-system/unit identifiers lost | Fixed; explicit conflicts reject |
| SH-005 | P2 | Awin new-condition claims without evidence | Fixed importer; old data still needs validated refresh |
| SH-006 | P2 | Awin ID allowlist widened by aliases | Fixed; explicit IDs authoritative |
| SH-007 | P2 | Awin valid product ID truncation | Fixed; provider-specific identity retained |
| SH-008 | P2 | Commercial child-age parser differed | Fixed; shared parser, dormant placements stay dormant |
| SH-009 | P3 | Single-strategy entropy NaN | Fixed; finite zero, replays passed |
| SH-010 | P2 | Turnstile config/context enforcement gap | Fixed; required deployment fails closed, legacy action compatibility retained |
| SH-011 | P3 | Mutable actions and missing build gates | Fixed source; remote execution outstanding |
| SH-012 | P2 | No main protection/rulesets | **Operator action required** |
| SH-013 | P3 | Status/privacy documentation contradictions | Corrected and generated/synced |
| SH-014 | P2 | Corrupt wishlist overwrite/data loss | Fixed; original bytes preserved, recovery notice |
| SH-015 | P2 | Swipe completion affects changed card | Fixed; captured-card identity/cancellation |
| SH-016 | P2 | Stale share decode replaces new finder | Fixed; revision invalidation |
| SH-017 | P2 | Wrong Black Friday in some years | Fixed; 101-year regression |
| SH-018 | P3 | Partial save persistence misreported | Fixed; primary versus compatibility result separated |
| SH-019 | P3 | Optional calendar UID line injection | Fixed defence-in-depth; no exposed UI attacker path established |
| SH-020 | P2 | Arbitrary upstream diagnostics logged | Fixed; synthetic data-marker regression |
| SH-021 | P2 | eBay public/Worker campaign divergence | **Operator approval/intent required**, not silently enabled |
| SH-022 | P2 | API27 navigation attribute in API24 resources | Fixed; Android build/lint/unit task pass |

## Security review summary

These are conditional control gaps/defence-in-depth findings, **not confirmed
critical/high remote compromise**. Confidence is confidence in the described
code behavior, not an estimate that exploitation occurred. Lines refer to the
remediated source. Broader security verification remains partial.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | [core.js](../../src/core.js#L137) | 137-180 | SH-010: conditional Turnstile fail-open/context gap, now hardened | 9/10 |
| 2 | 🟡 MEDIUM | [core.js](../../src/core.js#L569) | 569 | SH-020: conditional request-derived data exposure through upstream error logs, now sanitized | 9/10 |
| 3 | ⚪ LOW | [calendar-reminder.js](../../site/calendar-reminder.js#L29) | 29-32 | SH-019: optional UID line injection in helper; no attacker-controlled UI path, now rejected | 10/10 |

The user authorized fixes for confirmed code defects, and those fixes were applied.
External account changes, commits and deployment remain separate approvals. See
[remediation](remediation.md) and [outstanding risks](outstanding-risks.md), rather
than interpreting this table as a complete vulnerability inventory.
