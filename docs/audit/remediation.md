# Remediation, compatibility and release notes

The read-only baseline preceded implementation. Full original scenarios, impacts,
source files and regression references are in [findings.json](findings.json);
the human-readable [register](findings.md) uses the same IDs.

| Finding group | Core change | Validation | Compatibility/release consequence |
|---|---|---|---|
| SH-001 through SH-004 | Shared parsing, bounded exclusions, true budget ceiling, hard variant conflicts | Recipient/commerce, baseline, product and receipt fixtures | Validator v7 invalidates old curation cache; additive product fields; original baseline selection preserved |
| SH-005 through SH-007 | Strict new-condition evidence, explicit advertiser IDs, full valid offer identity | Awin positive/negative/import-abort tests | Awin stays off; old feed generations need review and refresh |
| SH-008, SH-009 | Commercial parsing parity; finite single-strategy entropy | Commercial tests and offline replays | No sponsored/verified feature or learning activation |
| SH-010 | Required production Turnstile, fixed server host/action, browser/native widget action labels, fail-closed errors | Missing/invalid/context/replay/timeout, both widget sources and readiness fixtures | Legacy missing/empty action remains accepted for installed clients |
| SH-011 | Immutable actions and generated/app/Worker quality gates | Source guards plus equivalent local builds | New remote CI execution still required; no repository settings changed |
| SH-013 | Correct runtime/benchmark/local-storage documentation | Copy checks and repeatable page generation | Legal page bundled into both apps; not yet released |
| SH-014 through SH-018 | Non-destructive storage, accurate persistence notices, race invalidation, correct Black Friday | Storage/async/calendar regressions and synthetic browser flow | Shared source rebuilt/synced for both apps; no cloud migration |
| SH-019 | Reject calendar UID line controls | Direct helper adversarial fixtures | Defence-in-depth; normal generated UUID behavior unchanged |
| SH-020 | Fixed failure diagnostics, no provider body/arbitrary exception logging | Synthetic private-marker assertions | Preserves useful numeric upstream status without provider payload |
| SH-022 | API27-qualified light navigation resources | Android lint, unit task and debug build | API24 minimum retained; older system navigation defaults avoid unsupported light-icon styling |

## Intentionally not changed

- Production recommendation mode remains `baseline-v3.3`; the inactive learning
  ranker is not promoted. Empty/unapproved knowledge cannot become active merely
  through the enabled reuse flag.
- Amazon, Awin discovery, sponsored demos, verified inventory, ads and monetisation
  telemetry were not activated. Cloudflare Insights is a separate observed
  production integration, not a reason to enable another adapter.
- Legacy unsigned/pre-upgrade product and feedback paths remain compatible.
  New product receipt digests improve integrity when present but are not a
  mandatory authentication gate. Unsigned feedback cannot approve knowledge.
- A broad CSP rewrite, blanket subdomain HSTS, PII stripping and removal of
  recent-item storage were not applied speculatively. These require compatibility,
  privacy, audience or operator decisions.
- No full dependency upgrade, native branding rewrite, minimum-OS increase,
  release-signing change, secret rotation or production database cleanup occurred.

## Release and rollback checklist

1. Review the complete diff and open risks; configure required CI/review policy.
2. Confirm production Turnstile secret binding and accepted canonical/challenge
   hosts without printing values. Required verification can intentionally return
   503 if production configuration is incomplete.
3. Run remote CI against the reviewed revision and stage a non-production smoke
   test with approved credentials/cost limits; do not disable protections.
4. Verify old installed clients and current native builds against the staged API,
   including legacy tokens, additive receipt fields and fallback shopping links.
5. Run iOS/native accessibility and lifecycle checks, sign/distribute only after
   separate operator approval. Website deployment does not update installed apps.
6. Record release SHA, Worker version, schema/bundle versions and measured gates.
   Preserve the prior approved Worker/native release for an operator-controlled
   rollback; do not downgrade solely to reintroduce known unsafe behavior.
7. No database migration is added by these fixes. Old Awin data must not be
   assumed repaired by deploying importer code; refresh while still disabled.

These are release instructions, not evidence that a release or rollback drill ran.
