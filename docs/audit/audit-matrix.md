# Audit framework and evidence matrix

## Interpretation

- **Pass**: the stated, bounded control was observed/tested. Not a whole-platform
  certificate or proof that every possible request/state was exercised.
- **Partial**: useful evidence exists, but the full requirement or runtime scope
  is not established.
- **Not tested**: insufficient requirement-specific evidence, including where
  a general source review is not a substitute for the prescribed verification.
- **Requires external access**: account, infrastructure or specialist evidence
  unavailable/unexercised in this audit.
- **Not applicable**: an explicit architectural reason is recorded. Reassess
  when the feature or threat model changes.

Findings and uncertainty are not erased by a green automated suite.

## ASVS 5.0.0

Primary target: **Level 2**, with risk-based additional scrutiny of administrative
authorization, MAC tokens, secrets and abuse budgets. This is a target, **not
achieved ASVS L2 conformance**.

[asvs-matrix.csv](asvs-matrix.csv) enumerates all **345 official requirement IDs**,
levels, sections, status, source/test evidence and limitations. IDs/levels were
derived from the official
[5.0.0 release](https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release) CSV,
download SHA256
`6124dba176dc563f66363a11ae0c47f9b86b8a4a84c66a793670bd196ed86cd5`.
Requirement text is not duplicated; consult the official version for normative
wording. Most controls remain unverified at the individual requirement level.

Recorded totals: **7 scoped Pass, 14 Partial, 253 Not tested, 2 Requires external
access, 69 Not applicable**. These counts are not a security score. The small
number of control-level passes deliberately reflects stricter evidence standards
than simply assigning every reviewed chapter a pass.

Examples that prevent an unjustified certification:

- HSTS exists but lacks the L2 `includeSubDomains` scope; do not enable it without
  checking all controlled subdomains.
- CSP still permits inline resources and uses `base-uri 'self'`, not ASVS's
  minimum `base-uri 'none'`. Blanket tightening would risk the current app.
- Correct app JSON size checks do not establish HTTP/1/2/3 framing consistency
  in every Cloudflare proxy component.
- HMAC receipt integrity does not authenticate unsigned legacy submissions.
- Secret-binding configuration and redacted scans do not establish entropy,
  account access controls, rotation, hardware-backed custody or external logs.

## Complementary security frameworks

References: [OWASP Top 10:2025](https://owasp.org/Top10/2025/),
[API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/),
[WSTG 4.2 stable](https://owasp.org/www-project-web-security-testing-guide/v42/).
The following mapping is thematic evidence, not full checklist completion.

| Top 10:2025 risk | API/WSTG focus | Evidence / finding | Result |
|---|---|---|---|
| A01 Broken Access Control | API1/3/5; authorization/origin boundaries | Exact origins, admin bearer negatives, receipt tamper/replay; legacy constraints documented | Partial |
| A02 Security Misconfiguration | API8; deployment/header/config tests | SH-010, SH-012, CSP/HSTS limitations, public readiness | Partial |
| A03 Software Supply Chain Failures | API10; dependency/workflow trust | SH-011, lock/advisory/history scans; native transitive provenance incomplete | Partial |
| A04 Cryptographic Failures | Token/transport/data protection | Fixed HMAC, expiry and tampering; live salt/secret entropy unavailable | Partial |
| A05 Injection | WSTG input validation, DOM and SQL | Parameterized inspected SQL, bounded input, output validation, UID guard; not every sink exhaustively traced | Partial |
| A06 Insecure Design | API4/6; business/cost abuse | Budget/exclusion/variant repairs, quotas, feedback governance; abuse identity not unique-human proof | Partial |
| A07 Authentication Failures | API2; admin and verification context | Admin bearer, Turnstile timeout/context tests; external accounts not assessed | Partial |
| A08 Software or Data Integrity Failures | API10; untrusted provider/model/feed data | Signed receipts, explicit catalogue condition/merchant constraints; old catalogue unreviewed | Partial |
| A09 Security Logging and Alerting Failures | Error/log/monitoring tests | SH-020 logs sanitized; alert delivery and investigation timelines unverified | Partial |
| A10 Mishandling of Exceptional Conditions | Dependency/storage/async failure behavior | Fail-closed Turnstile, corrupt-storage preservation, race fixes; full outage/restore not exercised | Partial |

API7 SSRF is addressed by inspected fixed provider destinations and URL allowlists,
not by a production network fuzz campaign. API9 inventory is addressed by the
eight discovered endpoints and configuration register; dashboard/deployment drift
remains external. API1 object authorization is relevant to receipts/admin state
despite the absence of account-owned cloud wishlists.

Relevant [CWE](https://cwe.mitre.org/) classes include CWE-20 (validation),
CWE-200/532 (sensitive diagnostics), CWE-362 (races), CWE-400 (resource consumption),
CWE-79 (untrusted DOM output) and CWE-89 (SQL injection). CWE-79/89 are review
categories, **not findings of successful XSS/SQL injection**.
[MITRE ATT&CK](https://attack.mitre.org/) T1190 (public-facing application),
T1195.002 (software supply chain), T1552.001 (credentials in files) and T1499
(endpoint denial of service) informed threat coverage. No ATT&CK technique was
observed as an actual intrusion.

## AI security

See [AI matrix](ai-quality.md#genai-risk-mapping-and-limitations). All ten requested
themes are addressed. The official OWASP GenAI index retrieved for this audit
linked the 2025 edition; an authoritative final **2026 edition was not verified**.
No invented 2026 identifiers or model-security certification is claimed.

## Accessibility: WCAG 2.2 A/AA

[wcag-matrix.csv](wcag-matrix.csv) records all **55 current A/AA criteria**, excluding
the obsolete 4.1.1 parsing criterion. Normative reference:
[WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Automated axe checks covered all 18 pages and selected modal/deck/guided/app-browser
states. Width/overflow and deck target measurements add useful evidence but do
not substitute for zoom, semantic alternatives, contrast, screen readers, complete
keyboard flows or native testing. No entire WCAG criterion is marked passed
solely because a scanner returned zero violations. Missing multimedia and
device-motion input features have explicit applicability notes.

## Whole-platform coverage ledger

| Area | Baseline/verification | Remaining boundary |
|---|---|---|
| Repository/history/generated output | Exact state, refs, map, redacted scans, repeatable builds | Unavailable/deleted history, release provenance |
| Browser input/rendering/lifecycle | Shared code review, negative fragments, storage/race tests, synthetic flows | Every sink, long soak, physical touch, real clipboard/share/calendar applications |
| Worker/API | Endpoint/body/method/origin/admin/Turnstile tests | All edge protocol behavior, deployed secret values |
| Durable Objects/D1/scheduled work | Real SQLite quotas, migrations/integrity, transaction/dedupe/prune tests | Production restore, storage outage, scheduler delivery and alert exercise |
| AI/knowledge/feedback | Deterministic validation, signed issuance/dedupe, inactive policy/ranker, historical replays | New paid-model jailbreaks, independent reviewers, unique-human/purchase verification |
| Products/monetisation | Provider fixtures, identity/condition/merchant guards, disabled flags preserved | Actual programme approvals, quotas, image rights, commissions and conversions |
| Native | Shared sync, bridge source, Android build/lint and source-level unit tests | iOS compile, devices, signing/stores |
| Privacy/legal | Data map, retention/fragment/cache caveats, current guidance | Contracts, lawful bases, children/scope, operating procedures |
| Accessibility/SEO/assets | Axe/viewport/markup checks; licences/provenance documentation | Manual WCAG, specialist content/IP decisions, search outcomes |
| Operations/cost/performance | Local limits, one live lab load, isolated quotas | Capacity/SLO percentiles, real account costs, restoration and incident drills |
