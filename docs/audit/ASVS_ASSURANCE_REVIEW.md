# Independent ASVS 5.0.0 assurance review

**Review date:** 6 November 2026  
**Scope:** the existing, dirty Santa's Helper working tree; not a deployed-build
attestation or ASVS certification.  
**Companion:** [ASVS_VERIFIED_MATRIX.csv](ASVS_VERIFIED_MATRIX.csv). The previous
[asvs-matrix.csv](asvs-matrix.csv) is preserved.

## Executive assessment

All **345** official requirements were read individually and matched by ID,
level and description digest. The previous matrix has the correct IDs and
levels, but several assessments were too broad:

* **Five of seven prior Pass claims remain downgraded.** Before remediation, a
  local canonical redirect bypassed the common security-header wrapper.
  That local defect has since been fixed and regression-tested, but deployed
  and platform-generated responses remain unverified.
* **Eleven of 69 previous N/As are challenged.** V4.3.1 also covers data-layer
  expressions, not just GraphQL. Santa's Helper is an OAuth client; controls
  of the provider's resource and authorization servers cannot all be dismissed
  merely because Santa's Helper does not run those servers.
* The Awin feed workflow places its API key in a URL path (V14.2.1), as
  documented by Awin. Before remediation, credentialed requests followed
  redirects by default; Worker provider requests now use `redirect: "manual"`
  and reject any 3xx response (workerd rejects `redirect: "error"`; an
  earlier audit fix that used it was caught in local workerd before any
  deployment). These observations are **not evidence that a real secret leaked**.
* A synthetic storage exception previously escaped the outer Worker without an
  application-level response. A last-resort generic 500 and sanitized logging
  are now tested locally; production behavior remains unknown.

The updated matrix records **4 Verified (3 on local evidence; V13.4.1 on a
read-only production probe), 92 Partially verified, 82 Not verified, 57 Blocked
and 110 Not applicable**. These are assurance dispositions,
not a security score. Known local discrepancies are explained in the evidence
and limitations even when the required status vocabulary has no separate
“failed” value. Nothing here establishes ASVS L1, L2 or L3 conformance.

## Authoritative source, integrity and licensing

* Source: OWASP, **Application Security Verification Standard 5.0.0**, official
  [release](https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release),
  published 30 May 2025, and its non-legacy English
  [CSV asset](https://github.com/OWASP/ASVS/releases/download/v5.0.0_release/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv).
  The OWASP [project page](https://asvs.owasp.org/) identifies 5.0.0 as the
  stable release.
* The official asset was downloaded independently into memory, 105,446 bytes,
  and compared byte-for-byte with the supplied local CSV. Both SHA-256 values:
  `6124DBA176DC563F66363A11AE0C47F9B86B8A4A84C66A793670BD196ED86CD5`.
  GitHub release asset ID: `259362914`. A second download was checked directly
  against every matrix row.
* OWASP's [release README](https://github.com/OWASP/ASVS/tree/v5.0.0_release)
  identifies the standard as **CC BY-SA 4.0**. Credit: OWASP and the ASVS
  contributors; [license](https://creativecommons.org/licenses/by-sa/4.0/).
  This review changes the presentation, selects identifiers/levels, hashes
  descriptions and adds independent assessments; it does not reproduce the
  full requirement text or imply OWASP endorsement. These two ASVS-derived
  deliverables are made available under CC BY-SA 4.0; no other repository
  materials are relicensed.
* `official_versioned_id` uses OWASP's `v5.0.0-<chapter>.<section>.<number>`
  convention. `official_description_sha256` is the lowercase SHA-256 of the
  UTF-8 bytes of the exact `req_description` field returned by parsing the
  official CSV with `encoding='utf-8-sig'` and `newline=''`; no trimming,
  Unicode normalization or paraphrasing is applied. The brief
  `requirement_focus` is this review's description, not normative text.

## Method and assessment meanings

The primary target is cumulative **L2**, with the L3 rows retained for
risk-based review. The review considered browser and native source, the Worker,
administrative APIs, provider integrations, operational scripts and disabled
but implemented features. It compared each official description with the old
claim, then inspected the relevant source, configuration, tests or architectural
absence. The matrix gives each row its own focus, evidence, limitation and,
where applicable, a specific N/A reason.

* **Verified:** sufficient local, requirement-specific source and dynamic
  evidence for the stated implementation scope. It does not mean independently
  verified production configuration, all possible platform behaviors, or
  overall ASVS conformance.
* **Partially verified:** some relevant evidence exists, but a mandatory
  condition, execution environment, route, or full scope is not established.
  A demonstrated local mismatch is stated explicitly rather than hidden.
* **Not verified:** the full requirement was not established; this includes
  requirements with a local indication of nonconformance.
* **Blocked:** necessary external-provider, cloud-account, live-protocol or
  operator evidence was unavailable or intentionally not accessed.
* **Not applicable:** the particular conditional feature or role was not
  identified in the assessed application. It must be reconsidered when the
  feature, deployment or provider relationship changes.

`testing_type` explicitly distinguishes manual source/architecture inspection,
automated local tests or scripted probes, and unavailable external evidence.
Manual source inspection is not a hands-on manual security test. Mocked Node tests are **not** real-browser,
Cloudflare Worker, live-provider or native-device tests. Prior audit reports and
tests not rerun here are identified as such; they are not silently promoted to
independent dynamic evidence. A missing feature is not inferred merely from a
chapter heading. Conversely, an absence of evidence is not a Pass.

The Git HEAD was `74a6ddf2b5855710f2a2e762b0805e57645f85c1`; it does **not**
describe the already-dirty source reviewed. The working tree also changed
during review: for example, Android manifest/backup-rule changes appeared
between status observations. Those changes were left intact. This is not an
atomic source snapshot; recheck the relevant hashes and native scope before
using this assessment for a release decision.

## Exact requirement and status totals

The official `L` is the **first** level at which a requirement is required.
Thus L2 cumulative includes L1 plus L2-only requirements. “L2+” below means
L2-only **plus L3-only**, not cumulative L2.

| Set | Total | Verified | Partially verified | Not verified | Blocked | N/A | Applicable |
|---|---:|---:|---:|---:|---:|---:|---:|
| L1-only / cumulative L1 | 70 | 4 | 28 | 10 | 6 | 22 | 48 |
| L2-only | 183 | 0 | 51 | 34 | 30 | 68 | 115 |
| L3-only | 92 | 0 | 13 | 38 | 21 | 20 | 72 |
| Cumulative L2: L1 + L2 | 253 | 4 | 79 | 44 | 36 | 90 | 163 |
| L2+: L2-only + L3-only | 275 | 0 | 64 | 72 | 51 | 88 | 187 |
| Cumulative L3: all levels | 345 | 4 | 92 | 82 | 57 | 110 | 235 |

“Applicable” includes implemented-but-disabled functionality and
provider/platform-dependent controls. The 110 N/As have 110 nonempty,
requirement-specific reasons; they are not counted as Verified. A single
conditional row, V4.3.1, concerns an implemented Awin feature disabled in the
repository configuration.

## Targeted engineering exercise updates (7 November 2026)

These row changes follow the operator's request for a targeted exercise. Only
two dispositions changed; the other rows gained evidence without promotion.

| ID | Disposition | Basis |
|---|---|---|
| V13.4.1 | Partially verified → **Verified** | Read-only production GETs returned 404 for `/.git/HEAD`, `/.git/config`, `/.env`, `/wrangler.toml` and `/package.json`; the asset binding serves only `site/`, which contains no VCS metadata. Point-in-time and deployed-commit scope only. |
| V5.2.1 | Not verified → **Partially verified** | Awin feed-list/feed byte caps and CSV field/row caps with synthetic oversized-input regressions. Real feed sizes and the disabled production path are untested. |
| V6.3.1 | Partially verified (unchanged) | Admin authentication failures are now throttled per IP hash in the Durable Object and exercised in local workerd. Not deployed; IP rotation remains possible; no operator-owned strategy document. |
| V6.1.1 | Partially verified (unchanged) | Evidence updated for the throttle; the requirement is a documentation control. |
| V4.1.1 | Partially verified (unchanged) | The live site serves `text/html` **without a charset** (observed nonconformance). Fixed locally in `src/worker-fetch.js` with a regression; requires deployment and recheck. |
| V3.4.1 | Partially verified (unchanged) | Production sends a one-year HSTS on probed 200/404 HTML and JSON responses; the L2 all-subdomains condition is not met. |
| V9.1.1 | Partially verified (unchanged) | Unsigned feedback can no longer add learning counters; tokenless requests are still accepted for coarse counters. |

## Explicit changes from the previous matrix

| Previous status | New status and count |
|---|---|
| Pass: 7 | Verified 2; Partially verified 5 |
| Partial: 14 | Partially verified 13; Not verified 1 |
| Not tested: 253 | Verified 2; Partially verified 71; Not verified 80; Blocked 48; Not applicable 52 |
| Requires external access: 2 | Blocked 2 |
| Not applicable: 69 | Not applicable 58; Partially verified 3; Not verified 1; Blocked 7 |

For comparison, the **old cumulative L2** matrix had 7 Pass, 12 Partial,
175 Not tested, 2 Requires external access and 57 N/A. Status definitions
differ, so comparing these numbers as security scores would be misleading.
Every CSV row retains `previous_status` and an explicit `change_explanation`.

### All seven previous Pass claims

| ID | New status | Challenge |
|---|---|---|
| V3.4.4 | Partially verified | The previously missing local 301 `X-Content-Type-Options` is now tested; all deployed and platform-generated responses are not established. |
| V3.4.5 | Partially verified | The local redirect now has a referrer policy; all navigation and sensitive URL cases were not tested. |
| V3.4.6 | Partially verified | The local redirect now has CSP, including `frame-ancestors`; live browser behavior and the native iframe exception remain incompletely tested. |
| V3.5.2 | Partially verified | Six local routes reject safelisted body types, but no real browser preflight or deployed edge test was performed. |
| V3.5.3 | Verified | Local source and tests cover methods on the six enumerated sensitive API routes only. |
| V9.1.2 | Verified | Locally issued receipts fix HMAC-SHA256; explicitly presented signatureless and alternative-MAC tokens were rejected. Tokenless legacy requests remain accepted; key entropy and other issuers are separate questions. |
| V16.5.1 | Partially verified | The Worker now catches the injected storage error and returns a generic 500; production and other failure paths remain unknown. |

V9.2.1 is the one previously Not tested row now **Verified**: expiry was
checked for locally issued and presented receipts, not tokenless legacy
requests. The previous Partial V3.4.7 is now **Not verified**:
the inspected CSP has no reporting directive, and external reporting was not
established. V14.2.1 remains Partial but now records the Awin key in a URL.

### Previous N/As challenged

* **V4.3.1 → Partially verified:** the requirement mentions data-layer
  expressions. Awin constructs a bounded SQLite FTS expression even though
  the Awin provider is presently disabled.
* **V10.4.4 and V10.4.10 → Partially verified:** local OAuth client behavior
  is observable, but the provider's allowed grants and actual client
  authentication enforcement are not.
* **V10.3.1, V10.3.2, V10.3.5, V10.4.7, V10.4.9, V10.4.11 and V10.4.14 →
  Blocked:** external provider resource/authorization-server controls, token
  type, registration or revocation require evidence not accessed here.
* **V10.4.16 → Not verified:** the inspected clients use client secrets,
  including eBay Basic authentication; strong public-key client authentication
  and the provider's enforcement were not demonstrated.

The 52 newly assigned N/As were previously Not tested, not previously passed.
They are listed here for review; the CSV gives the individual reason and
reassessment trigger for each:

* V1: V1.2.6, V1.2.7, V1.2.8, V1.3.1, V1.3.8, V1.3.9, V1.3.11.
* V5: V5.1.1, V5.2.4, V5.2.5, V5.2.6, V5.3.1, V5.3.3.
* V6: V6.1.2, V6.3.8, V6.4.1–V6.4.4, V6.4.6, V6.5.1–V6.5.5,
  V6.5.7, V6.5.8, V6.7.1, V6.7.2.
* V7: V7.1.1–V7.1.3, V7.2.1, V7.2.3, V7.2.4, V7.3.1, V7.3.2,
  V7.4.1–V7.4.5, V7.5.1, V7.5.2, V7.6.1, V7.6.2.
* V8.4.1, V10.1.2, V10.2.1, V11.4.2, V12.1.3 and V14.2.8.

For example, there is no identified user password, user session, WebSocket,
GraphQL server or application-operated TURN/media/signaling server. This does
**not** make the static administrator bearer, third-party OAuth, FTS queries,
external file ingestion, cookies or platform TLS N/A. Turnstile is an
anti-automation challenge, not an end-user identity provider; feedback
receipts are integrity tokens, not login sessions.

## Findings and closure evidence

The following are technical observations or bounded risks, not claims of a
production compromise. Each pre-remediation finding is distinguished from its
subsequent local fix or residual limitation.

1. **Redirect bypasses common headers — V3.4.1, V3.4.3, V3.4.4, V3.4.6.**
   Before remediation, the outer Worker returned `canonicalRedirect` before
   `withHeaders`; its local 301 lacked nosniff, CSP, referrer policy and HSTS.
   [src/worker-fetch.js](../../src/worker-fetch.js) now wraps redirects and
   [worker-boundaries.test.js](../../test/worker-boundaries.test.js) verifies
   those headers and the native verification-frame exception. HSTS still
   lacks `includeSubDomains`, and CSP uses
   `base-uri 'self'` rather than the L2 minimum `base-uri 'none'`.
   Deployed and platform-generated responses remain unverified.
2. **Feed credential in a URL — V14.2.1.**
   [scripts/sync-awin-catalogue.mjs:124–132](../../scripts/sync-awin-catalogue.mjs)
   inserts `AWIN_DATAFEEDS_API_KEY` into the feed-list path. Encoding the path
   does not prevent URL logging. The scheduled workflow can invoke this
   independently of the disabled Awin product-search flag. A synthetic
   in-memory probe confirmed construction; no real secret, provider request or
   log was inspected. [Official Awin documentation](https://help.awin.com/developers/docs/product-feed-list-download)
   explicitly documents the key in this endpoint's path; it does not establish
   a header-based alternative. The script rejects feed-list redirects and
   emits sanitized request errors, but provider/proxy URL logging and
   account-side retention remain external risks.
3. **Outbound redirect control — V15.3.2, V1.3.6, V13.2.4.**
   Before remediation, Anthropic and eBay calls omitted a redirect policy.
   Mocked requests had Node's default `follow` mode. In a separate
   Node 24 loopback experiment, a 307 across different ports forwarded a
   **synthetic** `x-api-key` header. This is not a Cloudflare Worker test and
   does not establish an attacker-controlled redirect or an actual leak.
   Credentialed Anthropic, Turnstile, Amazon and eBay Worker requests now go
   through a [redirect guard](../../src/upstream-fetch.js) using
   `redirect: "manual"` and rejecting any 3xx or opaque-redirect response.
   The first remediation used `redirect: "error"`, which local workerd
   rejects with a `TypeError` before sending; it would have broken all six
   calls in production and was replaced before any commit or deployment. The
   [workerd regression](../../test/workerd-redirects.test.js) returns 301,
   302, 303, 307 and 308 for each call (30 credential-bearing redirects,
   zero destination requests) and confirms ordinary successes still work; a
   negative control with `"error"` fails it. The Node-only benchmark runner and
   feedback export keep `redirect: "error"`, which Node supports. The
   [Node loopback regression](../../test/credential-redirects.test.js) also
   passes. The Cloudflare edge and real provider redirect contracts remain
   unexercised.
4. **Unhandled failure boundary — V16.5.1 and V16.5.4.** A synthetic
   `feedback.export` failure rejected `handleRequest` and previously escaped
   the outer Worker. The new [last-resort boundary](../../src/worker-fetch.js)
   logs only an allowlisted error type and broad request area, and returns a
   generic, non-cacheable 500 with appropriate headers. Local tests inject
   storage and asset failures and check that synthetic private strings do not
   enter responses or logs. Error details useful for forensics are deliberately
   omitted; platform-generated errors and process availability remain untested.
5. **Administrative authentication — V6.3.1 and V6.3.3.**
   [src/core.js:407–418](../../src/core.js) checks a shared static bearer before
   the public visitor-budget path. No application-level second factor or
   admin-auth rate limit is shown there. Secret entropy, gateway/WAF controls,
   rotation and real brute-force feasibility remain external unknowns.
6. **Conditional FTS and file-resource limits — V4.3.1, V5.2.1, V5.2.3.**
   [src/providers/awin.js:130–134,169–187](../../src/providers/awin.js)
   quotes up to eight search terms, binds the expression and limits results;
   this is not a query-cost test. Awin feed fetches have a 15-minute abort
   signal, and the scheduled job has a 60-minute timeout; the synchronous
   importer has no separately identified timeout or compressed/uncompressed
   byte cap. No decompression or load attack was executed.
7. **Legacy receipts and other data-protection gaps — V9.1.1, V1.2.10,
   V14.2.2, V14.3.3.** The feedback and product paths retain a compatibility
   path for requests with no receipt token. This is separate from rejecting an
   invalid or expired *presented* receipt, and the abuse impact was not tested.
   A synthetic CSV aggregate field beginning with `=` is quoted but not
   apostrophe-prefixed; normal feedback dimensions are enumerated, so an
   attacker-controlled route to that synthetic value is not established.
   Idea responses can be cached and named lists stored locally; the sensitivity
   classification, external copies and complete retention guarantees remain
   unverified.

**Suggested order for remaining closure:** obtain evidence for administrative MFA/rate limits,
provider controls, cloud headers/TLS and secret handling. Bound and test feed
and FTS resource consumption, classify cached/browser data, and assess the
legacy receipt and spreadsheet-export trade-offs. Re-evaluate the matrix
against an immutable release snapshot and reconsider N/As whenever a relevant
feature or integration is enabled. This order is not a CVSS severity rating.

## Tests and reproducible local probes

Node **v24.11.1** was used. No live application API, paid model/provider call,
account setting, deployment or production data was exercised. The only public
internet retrievals were standards/reference pages and the official ASVS CSV.
The Node loopback experiment used synthetic values and closed both listeners.

```powershell
node --test --test-reporter=spec test\api-boundaries.test.js test\turnstile-security.test.js test\feedback-receipts.test.js test\ebay.test.js test\core.test.js test\mobile-app.test.js
node --test --test-reporter=spec --test-name-pattern='Awin full-text results' test\awin.test.js
```

Final re-run results: **94/94** and **1/1** respectively, no failures or skips.
An earlier run of the first command recorded 93/93; `test\ebay.test.js`
changed during the mutable-tree review, so the two results are not an atomic
snapshot. The selected Awin test uses its in-memory database mock; the
file-writing Awin tests were not run. A separate local probe checked 42
method/content-type cases over the six write/admin routes, plus the 301's
missing headers. Other synthetic probes checked receipt expiry and algorithm
rejection, the FTS eight-term/40-result bounds, the Awin URL path, an uncaught
storage error, CSV quoting and the Node redirect behavior. These are bounded
tests, not exhaustive fuzzing.

The previous [test report](test-report.md) records 549 passing tests and a
local workerd load run on an earlier snapshot. An independent full-suite run
later passed 551 tests before subsequent changes. See the final assurance
report for the final post-change run; neither number should be attributed to
a different snapshot.

The original probes exercised `canonicalRedirect` and `handleRequest`
directly and inspected the former outer Worker routing. They are historical
pre-fix evidence, not commands that should still reproduce a defect on the
current tree. Current, repeatable regressions are:

```powershell
node --test test\worker-boundaries.test.js test\credential-redirects.test.js test\workerd-redirects.test.js test\api-boundaries.test.js test\turnstile-security.test.js test\product.test.js test\ebay.test.js
```

The targeted run passed **87/87** on the final tree. It tests
the application's exported Worker handler, Node loopback transport and, for
outbound redirects, the bundled modules in local workerd, using synthetic
values; it does not demonstrate Cloudflare edge headers, the real
provider redirect contract or production failure handling. The Awin URL,
FTS-bound and CSV probes remain bounded local observations.

## Validation and integrity ledger

* Official/local CSV: 345 rows, 345 unique IDs, exact order and levels match;
  all 345 description hashes match a freshly downloaded official asset.
* Matrix: no unreviewed placeholders, empty evidence/limitations or missing
  N/A reasons. Its current status and level totals are the tables above. The
  initial evidence-path check matched 458 references to 46 existing files and
  checked 309 numbered line ranges before subsequent source refactoring; it
  did not prove semantic completeness or attest the final tree. A later
  bounded recheck found all 269 recognized file-and-line references within
  existing files; it likewise does not prove semantic completeness.
* Previous matrix SHA-256, before and after:
  `90F22D2C5D3DA3A9E9096CC1434AD0375A1BE0CED7CE295EF0ECEA7EAB7B56B1`.
* Current matrix SHA-256 after the targeted exercise:
  `7541DCE40368C8333B984433A95D1D1DAAE302F29062EF60C2E5D8631778EB07`;
  all 345 description hashes and levels were rechecked against the official CSV.
* Earlier updated matrix SHA-256:
  `E37885987D46CAD72DD04B97AB8DA3302C0A01BB5FF9F23A593BF06C8A1F10A3`
  (after updating the V1.3.6, V13.2.4 and V15.3.2 evidence cells for the
  workerd redirect fix; restoring those three cells reproduces the prior
  `A7720D485C92BC3E5C6A714ACDD124D62B6C729103125AED50ADDCB408E419AD`, and no
  disposition changed).
* Selected inspected evidence SHA-256 recorded **before the later source fixes**:
  `src\core.js` `EE9BBF3C50C5A968487DC345127D6FE08F7CA456249F9A2A0B20B0B989785347`;
  `src\index.js` `EE0668490D759355CE727DC22AC571CE16EDADC983C4AFA3555A716F39F8CB63`;
  `src\providers\awin.js` `0CD835E0AED1151D20A2CB2C490F9BF90692EEBC9479338A9DD028A3EA45B2E4`;
  `src\providers\ebay.js` `D5B7CD66202E2343FD45C8235C6DFACD1EEC0FEA45FE456623CBDD4881F652C8`;
  `src\engine\feedback-receipts.js` `BB125647E812D454FF6EE762C8EF3F2D604BCCE3C58DC8009F6E7C22E09097E5`;
  `scripts\sync-awin-catalogue.mjs` `5568C5EA2E0D1E5E1DB9D2E66C6B72BE481A000B292DEF1DABD3176A4C569141`;
  `wrangler.toml` `613EA0A98D9EAC934EF14BE2B7EB47E6DE9D0AE75FB5124809901AFE83E757C2`;
  `.github\workflows\awin-catalogue.yml` `903405AA09D17F81079C7E1E49A4A4E96AB099DC87671AC3589C493CB5144575`.
  The final re-run used `test\ebay.test.js` SHA-256
  `63F7E860C69EC6A28DB6684619D36696AFC543A05446406EB9682CA6AF9C618D`.

No commit, deployment, external account change, paid service, dependency
installation, secret rotation or unrelated edit was performed. Apart from a
small set of read-only production GETs (headers and VCS-path reachability),
production edge behavior, TLS, WAF, provider grant enforcement, secret custody, browser
preflight, native devices and live failure handling remain outside the evidence
collected here.
