# Test and evidence report

**Historical snapshot:** these are results from the initial audit. The
[final assurance review](FINAL_ASSURANCE_REVIEW.md) records the later
independent challenge and its post-remediation verification.

Audit baseline: `74a6ddf2b5855710f2a2e762b0805e57645f85c1`, 6 November 2026.
Environment: Windows, Node24.11.1, npm11.21.1, Wrangler4.156.2,
Miniflare5.20261102.0-beta/workerd1.20261102.1. Native verification used the
existing Android SDK and an isolated official Temurin21.0.13+9 download.
No dependencies or toolchain choices were changed globally.

## Commands and results

| Check | Result |
|---|---|
| Initial `npm test` | 487 tests passed before remediation |
| Final `npm test` | **549 tests passed; zero failures/skips** |
| Requested focused selector below | **99 tests passed** |
| New API boundary suite | 16 tests with multi-endpoint negative assertions passed |
| Turnstile security suite | 11 tests passed; parent combined core/security/baseline/knowledge selector passed 66 |
| Final browser/hosted-native action and backend selector | 28 tests passed; both actual widget sources now label the fixed ideas action |
| Frontend state/race/storage selector | 53 tests passed in delegated validation; final suite includes all |
| Final Awin condition refinement selector | 16 tests passed; full suite subsequently passed |
| `npm run build:pages` | Passed; repeatability/legal/style regression passed |
| `npm run app:sync` | Shared assets built and synced into both Android and iOS |
| Final native asset hashes | All107 bundled files match both native copies and the debug APK web assets |
| `npx --no-install wrangler deploy --dry-run` | Passed; 323.13 KiB upload / 93.43 KiB gzip; **not deployed** |
| `npm run benchmark:replay:v3.3` | 30 historical cases replayed offline |
| `npm run benchmark:replay:v3.4` | 50 historical cases replayed offline |
| Added benchmark scenarios | 24 cases validated/dry-selected; no paid generation/human scores |
| `node scripts\audit-load.mjs` | All 1x/5x/10x reservation and same-visitor assertions passed |
| `node --check` authoritative JS/MJS | 134 files checked without syntax failures |
| Android debug build/lint/unit task | Passed; zero lint errors, 30 warnings, three native unit tests; [individual warning review](ANDROID_WARNING_REVIEW.md) |
| iOS compilation | Not run: no Mac/Xcode on this Windows environment |
| Native physical-device/emulator flows | Not run; adb returned no connected devices |

The exact user-requested frontend/native/commercial selector was:

```powershell
node --test test\mobile-app.test.js test\frontend-api.test.js test\swipe-deck.test.js test\frontend-exclusion-flow.test.js test\interactive-design.test.js test\editorial-theme.test.js test\guided-finder.test.js test\site.test.js test\monetization.test.js test\audit-guardrails.test.js
```

Android final command, after setting command-local `JAVA_HOME` to JDK21 and
`ANDROID_HOME` to the installed SDK:

```powershell
.\android\gradlew.bat -p android assembleDebug :app:lintDebug :app:testDebugUnitTest --console=plain --no-daemon
```

JDK archive SHA256:
`a4dbaa05fca4bd89d84584e58c459bd732efebb1722af80ab13c6516832004f9`.
Debug signing is not release signing; the arithmetic and source-level manifest
policy tests are not a device backup-transport or native product/security suite.

## Independently devised negative tests

- All six write/admin endpoints: wrong method 405; bad/missing/null/confusable/
  malformed origins 403; unsupported content type 415; malformed JSON 400.
- Declared, absent and understated streamed body lengths enforce actual limits:
  ideas8,000, products12,000, feedback16,000, admin2,000 bytes; oversized requests413.
- Admin missing/wrong bearer rejects401 independently of browser origin.
- Required Turnstile missing configuration503; missing/invalid/replayed tokens,
  incorrect hostname/action, HTTP/network/timeout failures and client bypass
  fields reject. Legacy absent/empty action compatibility separately verified;
  current browser and hosted-native widgets explicitly label `ideas`, independently
  of any action query parameter.
- Synthetic private markers in upstream error bodies/exceptions do not reach
  diagnostic logs after remediation.
- Negated budgets, exclusions lost during enrichment, short variant identifiers,
  bad/incomplete constraints, Awin condition conflicts and allowlist widening.
- Signed receipt tamper/expiry/spec identity, conflicting feedback/replay and
  transactional dedupe; unique-person and real-purchase proof explicitly excluded.
- Corrupt wishlist storage, partial persistence, stale decode success/error,
  changed-card swipe, 1,000 stored gifts, 101 calendar years and UID line controls.

The backend read-only reviewer additionally ran 112 existing tests and 282
ephemeral synthetic assertions. Those are supporting investigation, **not 282
new committed regression tests**. Persistent API/Turnstile suites capture the
principal reproducible boundary cases.

## Browser and production observations

Production interactions were controlled GETs: homepage, health, readiness, robots,
sitemap, hosted verification page, unknown path and canonical redirect. No live
ideas/products/feedback POST, export, mutation, load attack or paid model run.
Production health/readiness returned200 at baseline; this does not prove the
deployed service contains the new Turnstile requirements.

The local browser fixture served real shared frontend files, mocked all `/api/*`
and substituted only the challenge script. It produced eight synthetic gardening
ideas, no live offers and successful fixture feedback. It never forwarded calls
to Anthropic or retailers. Exercised finder -> deck -> details -> save named list
-> open list, guided/app-browser composition and corrupt-list recovery. The latter
preserved exact malformed original bytes while showing the surviving gift and
warning. This verifies UI handling, not model relevance or live Turnstile.

18 pages were checked for overflow at320/390/1440 widths (54 checks). Homepage
and deck additionally covered320x568,360x640,375x667,390x844,430x932,844x390,
768x1024,1440x1000,1920x1080. No horizontal overflow; measured deck action targets
were at least64x60 CSS pixels and remained on screen. App composition was confirmed
on the document root, not inferred from body classes.

Axe4.11.0 ran WCAG2/2.1/2.2 A/AA tags on all18 pages and selected interaction
states. No automatic violations; contrast was incomplete on many pages and some
states had additional incomplete checks. **No WCAG conformance claim.** No actual
screen reader, 200/400% zoom, native WebView, calendar import or prolonged memory
soak was completed. One automated Escape attempt was inconclusive; explicit
close worked, so Escape behavior is not claimed certified.

## Supply chain and secret evidence

- `npm audit --json`: zero reported advisories at audit time.
- 194 lock packages; all expected package integrity records present and resolved
  registries expected. `npm ls --all --omit=optional` passed.
- Lifecycle-bearing dependencies include esbuild, fsevents and workerd.
  Licence review identified permissive/OFL licences and LGPL-bearing image
  dependencies; no legal compatibility certificate.
- Gitleaks8.30.1 official binary checksum verified; redacted scan of all available
  refs/history covered75 commits (~105.52MB), with zero matches. Initial and final
  working-directory scans also found zero matches. No credentials printed.
- Binary/native dependencies and unavailable history are not certified by text
  scans. [Lock-derived CycloneDX inventory](lock-inventory.cdx.json) is explicitly
  not build provenance, native completeness or an npm-generated attestation.

`npm ci` was **not executed**: existing dependencies were available, manifests
were unchanged and session rules prohibit reinstalling merely for reassurance.
Reproducibility is therefore supported by lock integrity/builds, not a fresh
dependency installation. No application dependency was added. Missing axe and
native/scanner tools were provisioned only in the isolated audit tool directory.

## Failed attempts and recovery

| Attempt | Outcome / resolution |
|---|---|
| Native npm SBOM and lock-only retry | Both failed `EINVALIDPURLTYPE` because root package lacks version; retained failure evidence and produced labelled lock inventory instead |
| Initial Android build | SDK not configured; retried with existing SDK |
| Android SDK retry | Compiler did not support Java21; isolated checksum-verified JDK21 enabled successful build |
| Android lint | Confirmed NewApi resource error; SH-022 fixed via version qualifier, then all final native tasks passed |
| Current widget action verification | Two VM assertions reproduced missing browser/native action labels; fixed both sources, resynced both apps and passed the expanded suite |
| Intermediate full suite | Generated-page repeatability failed after legal-copy edit; page generation normalized output, final suite passed without weakening test |
| Initial local quota harness | Installed Miniflare v5 rejected legacy options; inspected installed API and corrected manifest/config, all thresholds passed |
| Integrated interception against local Wrangler | Detached-session browser protocol errors; replaced with an isolated no-upstream fixture server, documenting its limits |

Raw bounded logs and scanner/tool evidence are retained in the session evidence
directory; they are not copied into the public report wholesale. Repository tests,
load harness, machine-readable matrices/register and this report persist with the
worktree. All temporary audit servers were stopped after their checks.
