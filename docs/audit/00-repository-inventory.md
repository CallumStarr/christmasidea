# Initial repository inventory

Audit started 6 November 2026 (UTC). This is an evidence record, not a certification.
No application behaviour was changed to establish this baseline.

## Exact starting state

| Item | Observed value |
|---|---|
| Branch | `main` |
| HEAD | `74a6ddf2b5855710f2a2e762b0805e57645f85c1` |
| Upstream | `origin/main` |
| Local upstream divergence | 0 ahead, 0 behind |
| Latest advertised remote main | Same SHA, checked with `git ls-remote origin refs/heads/main` |
| Latest commit time | 2026-11-06 16:23:21 UTC |
| Tracked modifications / staged changes / untracked nonignored files | None at start (`git status --porcelain=v1 --untracked-files=all`) |
| Other local branch | `feat/gift-intelligence-engine` |
| Remote branches/tags advertised | `main`; no tags advertised |
| Environment | Windows; Node 24.11.1; npm 11.21.1 |

The initial full tracked enumeration was obtained with `git ls-files`. Ignored files
were also enumerated: 5,621 at this point, including dependencies, build output,
local Wrangler state and native build state. Ignored content is not proof of a
clean environment or of deployment provenance. Existing local data is preserved;
private feeds and credentials are not copied into this report.

## Repository map

| Area | Contents / role | Authority |
|---|---|---|
| `src/` | Worker, budget object/storage, recommendation validation and engine, providers, product matching and offer validation | Runtime source |
| `site/` | HTML, shared browser JS/CSS, fonts, artwork, legal copy, commercial configuration/inventory | Shared frontend source, except generated pages/images |
| `mobile/native-bridge.js` | Capacitor integrations | Native bridge source |
| `android/`, `ios/` | Native projects, build configuration, platform resources and example native tests | Native source; copied web bundles are generated |
| `scripts/` | Page/image/app builders; offline and live benchmark tools; feedback/knowledge review; Awin ingestion and safety tools | Build/maintenance source; some commands contact external services |
| `test/` | Node test runner suites, fixtures embedded in tests | Test source; not equivalent to device or browser certification |
| `benchmarks/` | Frozen v3.3 results/reviews; v3.4 cases, replay metrics and paired reviews | Historical evidence, not new live-model verification |
| `docs/` | Design, intelligence, product-evidence and Awin catalogue documentation | Claims to reconcile against code |
| `assets/editorial/` | Editorial source images | Authoritative build inputs |
| `migrations/` | Two Awin D1 SQL migrations | Schema source |
| `.github/workflows/` | Quality, Awin catalogue sync, feedback review | CI/maintenance source |
| Root configuration | Package manifest/lock, Wrangler, Capacitor, ignore rules, environment example, instructions | Configuration source; not proof of external account settings |
| Ignored directories | `node_modules/`, `.wrangler/`, native build output, `mobile/www/`, `private-feeds/` | Local dependencies/state/output, not all tracked or deployed |
| `.git/` | Objects, refs, history, configuration | History; available refs do not establish all deleted history |

## Generated-output boundaries

- `scripts/build-site-pages.mjs` builds editorial pages and sitemap and uses
  shared monetisation settings. Generated HTML must be changed through its inputs.
- `scripts/build-brand-assets.mjs` produces responsive public images from
  editorial assets.
- `scripts/build-mobile.mjs` copies shared website assets and bundles the bridge
  into ignored `mobile/www/`; Capacitor sync copies assets into both native projects.
- Native icon generation is separate. Existing APKs do not contain subsequent changes.
- Benchmark replay must not overwrite frozen baseline artefacts.
- Wrangler serves only `site/` as static assets. This audit directory is outside
  that public asset tree, but **is not confidential** if committed to a public Git
  repository. Reports must remain sanitised.

## Initial contradictions requiring verification

`PROJECT_STATUS.md` says product discovery is disabled and multi-retailer support
is unimplemented. The current Wrangler file enables global discovery, eBay and
photo-first mode, disables Amazon and Awin, enables knowledge reuse, and disables
learning ranking. The release selector is `baseline-v3.3`, not the experimental
engine described as the general recommendation path in parts of the README.
These are configuration observations, not assertions about live secret bindings,
merchant approval, deployed versions or policy activation.

`AGENTS.md` has been read. Applicable fixes must retain shared website/Android/iOS
behaviour and installed API compatibility; native asset changes require sync and
new distribution. Production deployment, external account changes, paid model
evaluations, purchases and destructive database operations are excluded.
