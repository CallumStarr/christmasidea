# Outstanding risks and verification limits

No severity below asserts an exploit, statutory breach or production incident
without evidence. Priorities describe the next assurance action, not CVSS.

| ID | Priority / owner | Evidence or uncertainty | Required closure |
|---|---|---|---|
| SH-012 | P2 operator | No main protection/rulesets/environments returned by GitHub | Configure enforceable reviews/checks/release controls; verify bypass policy |
| SH-021 | P2 commercial/operator | Public eBay campaign empty while Worker configured | Confirm permission and intended tracking, then align and test destinations without purchasing |
| R-01 | P1 privacy/operator | Free text and cached explanations can contain PII; no comprehensive detector | Map purposes/contracts/retention, define minimisation and deletion limitations; assess shared-cache sensitive input |
| R-02 | P1 privacy/legal | Recent-item automatic storage and live Insights require purpose-specific PECR assessment | Determine applicable exception or consent/objection, implement resulting behavior, update accurate notices |
| R-03 | P1 legal/product | Children's Code and Online Safety scope not resolved | Document audience/service-scope assessment with UK specialist; determine safeguards and records |
| R-04 | P2 operator/security | Secret presence and length checks do not establish entropy, scope or rotation | Privately verify production salts/keys, account access, least privilege and incident rotation procedure |
| R-05 | P2 security/engineering | Legacy unsigned receipts remain accepted | Document threat model; if mandatory signed product plans are required, design a versioned installed-client migration |
| R-06 | P2 engineering/SRE | Browser cancellation not explicitly propagated to paid upstream fetch | Add isolated abort/cost tests, then design cancellation without corrupting global reservations |
| R-07 | P2 SRE | Hot global object, single AI provider, no production percentile/restore evidence | Establish SLOs, approved isolated capacity tests, dependency alerts and a non-production restore drill |
| R-08 | P2 mobile | iOS not compiled; no Android/iOS device flows or signed release | Mac/Xcode build plus minimum/current OS devices, lifecycle, native challenge, safe areas and store declarations |
| R-09 | P2 accessibility | Axe contrast incomplete; no NVDA/VoiceOver/TalkBack or full zoom audit | Manual WCAG2.2 A/AA with assistive tech, keyboard/focus, 200/400% zoom and large-text devices |
| R-10 | P2 commercial/legal | Provider approval, commissions, image/content licences and listing rights unverified | Review current account/programme-specific terms and obtain merchant-level evidence |
| R-11 | P2 catalogue owner | Awin importer repaired, existing remote generations unreviewed | Validate a fresh explicitly-new-condition catalogue before any activation; test staged migration/restore |
| R-12 | P2 AI/product | 24 new cases have no generated outputs or independent ratings | Obtain cost approval, freeze configurations, run blinded multi-reviewer evaluation and analyse uncertainty |
| R-13 | P2 security/privacy | CSP permits inline code, base-uri self; HSTS lacks includeSubDomains | Inventory inline and third-party behavior; phase stricter CSP and domain policy with compatibility tests |
| R-14 | P3 SRE/privacy | CSP report collection absent; reporting itself can disclose URL/context | Define minimised collector and retention before enabling reporting; do not send raw samples to third parties |
| R-15 | P3 supply chain | npm SBOM command fails for versionless root; lock inventory not build provenance | Decide package version metadata separately; generate signed JS/native release SBOMs in CI |
| R-16 | P3 mobile | 30 Android lint warnings remain; OEM device-transfer behavior is untested | Review the individual warning ledger, decide transfer policy and test launch images across devices without altering branding blindly |
| R-17 | P3 browser/product | No prolonged memory soak, physical touch, real calendar imports or messaging previews | Add repeatable long-session and Apple/Google/Outlook import checks; test shared fragments on actual apps |
| R-18 | P3 privacy/operations | Exports/notices outlive server pruning; some review acknowledgement records lack expiry | Define external-copy and operational-metadata retention plus small-cohort disclosure review |
| R-19 | P3 SEO/content | Search Console, ranking, editorial expertise and structured-result display not verified | Review people-first content and observed indexing; do not claim rich results or product testing |

## What access was not exercised

The available authenticated Awin tab was not inspected or altered. No production
feedback exports, private catalogues, account profiles, secret values, live model
POSTs, purchases or destructive database commands were needed for the repairs.
Cloudflare dashboard overrides, provider billing allocations, exact programme
membership, hosted deployment provenance and support/legal operating records
remain external evidence requirements.

Text secret scans do not prove that binary dependencies, unavailable/deleted
history, every account setting or every external log is clean. Browser simulations
do not establish native WebView behavior. An app bundle hash match does not prove
an installed app received an update. A zero-advisory result is a dated database
observation, not a guarantee against unknown or undisclosed vulnerabilities.

The report records these gaps explicitly so that later reviewers can close them
with evidence rather than silently inheriting a passing conclusion.
