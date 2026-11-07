# Santa's Helper — Project Status

Brand: **Santa's Helper**. Domain: **ChristmasIdea.co.uk** (retained). Worker name, routes and the Associates tag `mcstarrstud0c-21` are unchanged. This is the canonical status record.

## Launch-readiness release (6 November 2026)

Website/backend fixes are deployed as Worker version
`a2bd0f62-2b83-4f22-9079-a334007d340c`. The prior audit version was
`1a90abd3-921e-4310-8cfb-b122fb765030`; the first launch-fix deploy was
`5e619e11-c8b4-448b-bb96-95c5b6de2846`, followed by the static-header/native-frame
compatibility correction.

- **613 tests pass**, both frozen benchmark replays pass, Worker dry-run and
  shared iOS/Android asset sync pass. No signed native binary was released.
- Three live synthetic searches (describe, guided and child) each returned
  eight usable AI ideas. Company/legal pages, static security headers, readiness,
  canonical redirect and unsigned product/feedback refusal were checked.
- Listing safety, definite affiliate copy, company identity, privacy rights and
  lawful bases, adults-only Terms, guide Ad labels/bylines and accessibility
  names are implemented. The ICO reference still needs confirming.
- eBay discovery is disabled: listing content cannot appear beside other shops.
  Tagged searches remain; missing photos no longer remove ideas.
- Static assets bypass Worker execution with generated security headers;
  HTML/API requests still run it. Native verification removes inherited frame
  denial and retains its exact app-origin framing policy.
- All feedback needs signed receipts using a new independent Worker secret.
- Monitor Worker/Actions secrets are configured and live checks passed.
  The launch-readiness changes (including the preserved audit work) are
  committed and pushed to `main`, so the daily finder monitor
  (`.github/workflows/finder-monitor.yml`, 07:17 UTC) is active and was run
  manually once after push.
- Repository secret scanning/push protection are enabled. Awin's unused refresh
  workflow is manual-only (no schedule).
- 50 concurrent local catalogue requests each returned eight ideas; local
  SQLite Durable Object concurrency tests passed at 10/50/100 requests. This
  does not certify production CPU capacity or a paid billing plan.

**7 November verification:** the release was re-checked independently against
Cloudflare, the live site and Companies House (details in the checklist). The
first scheduled monitor run passed. Follow-ups: About's stale eBay wording,
latent provider disclosure strings, and the monitor now failing on catalogue
fallback; 614 tests pass. The ICO register search did not yet list the company.

See [the launch checklist](docs/launch-readiness.md) for remaining operator
tasks: Workers Paid, search-engine registration/indexing, ICO reference,
account transfers/approvals, Anthropic key rotation/spend limit, edge rate
limiting, phone-alert uptime monitoring, human accessibility/quality testing
and separate native/store releases. **Not yet cleared for announcement.**

## Completed

- Release selection: `RECOMMENDATION_MODE = "baseline-v3.3"` selects the frozen baseline prompt and original-order curation with current safety validation. The release regression preserves 29 of 30 stored title lists/order; case-12 deliberately replaces an inconsistent kneeling-pad/apron concept. The v4 engine remains available for offline research, not selected for production.

- Santa's Helper branding across pages, gift guides, metadata, OG image and package metadata.
- Claude gift recommendation engine, with structured output, validation, catalogue fallback and rate limiting.
- Recommendation prompt v3.3 and its request-generation changes (`src/prompt.js`, `src/validate.js` validator-v4).
- Phase 0 provider-neutral product architecture: provider registry, generic offer validation, per-provider image-host allow-lists, identity matching separate from suitability.
- Provider-neutral product discovery is implemented. Global discovery and photo preference remain configured, but all provider discovery flags are false for launch. Campaign 5339240592 remains on tagged eBay searches (the operator decision recorded in eaf4d3e); live EPN status and reported clicks still need independent verification.
- v3.3 Haiku 5.5 quality baseline: `benchmarks/baselines/v3.3-pre-refactor/` (4.133/5 weighted, 30 synthetic cases, single AI reviewer; see its README for limitations).
- Recovery points: `refs/snapshots/phase0-pre-refactor` and `C:\Christmas_List2\backups\christmasidea-phase0-snapshot.bundle`.
- **Gift intelligence engine (`gift-engine-v1`, prompt `gift-intelligence-v4.0`)**. Covers the recipient model with stated and inferred facts, an interest/motivation graph, hybrid BM25 + graph retrieval with RRF, multi-objective ranking with MMR and caps, quoted connections, discovery ideas, one listing per card, a source registry, and anonymous feedback counters (`POST /api/feedback`). Feedback expiry is enforced by request-time and daily scheduled pruning. See `docs/gift-intelligence-engine.md`.
- v3.4 benchmark: 50 cases, structural metrics and a live Haiku run. Human scoring is complete for the 30-case paired v3.3/v3.4 review and a separate 50-case Haiku sheet (weighted 4.014/5). The paired review preferred v3.3 on 28/30 cases and v3.4 on 2/30; the result does not support a perceived-quality improvement claim. See `benchmarks/v3.4/README.md`.

## Blocked (external dependencies)

- Amazon Creators API production activation: pending confirmation of Associates eligibility, qualifying sales, credentials and actual API access. Live API access has not been tested.
- Awin discovery activation: implementation, migrations and ingestion exist but discovery remains disabled. Merchant-level eligibility, current feed coverage, credentials and image rights require separate confirmation; static affiliate approvals do not automatically authorize catalogue access.

## Not yet implemented

- Semantic embeddings (Workers AI + Vectorize): designed, worthwhile once a real product catalogue exists.
- Trend and popularity intelligence: needs an authorised, timestamped data source.
- Learning ranker (LinUCB contextual bandit): designed. Counters are collected, but they do not affect ranking until purchase-quality signals and enough volume exist.
- Occasion-specific modes beyond Christmas.

## v3.4 audit findings: status

Targets from the v3.3 audit were originality 3.30, budget fit 3.63 and variety 3.83, plus constraint and compatibility weaknesses.

- Prompt v4 asks for adjacent "discovery directions". Ranking scores novelty and guarantees adjacent ideas when they exist.
- Variety caps now cover category, type and strategy, with a coverage bonus per interest. Interests the shopper says are already well stocked get a cap of 3.
- Owned items and dislikes are checked by stem and by group. Graph concepts carry an audience (child, teen or adult) and a price ceiling, and pass the same validator as the model's ideas.
- Budget fit is scored as well as gated. Graph backups use curated price bands.
- **Perceived-quality check:** the completed paired human review is adverse to v3.4 (v3.3 preferred on 28/30 cases; v3.4 on 2/30). Inspect reviewer notes and investigate before claiming improvement or using the benchmark as a quality rollout justification. This is one completed score sheet over synthetic cases, not multi-rater consensus.

## Product-only policy

Vouchers, tickets, services and subscriptions remain excluded. Hidden
experience/subscription controls have been removed rather than exposing
options that contradict the prompt. Any future change requires a separate
reviewed implementation and verified partner inventory.

## Deferred / hygiene notes

- Production `/api/ready` returned ready. It checks configured salt/signing-key minimum lengths and required bot-check configuration, not secret custody or rotation history.
- `/api/products` requires signed idea receipts; unsigned or modified ideas are refused.
- Confirm the Cloudflare plan's CPU and subrequest limits before enabling product discovery.
- Rotate any Anthropic API key that has been shared in plain text.
- Earlier "awaiting approval" notes for Phase 0 and benchmark work are closed; those tasks are complete.

## Audit and release limitations

See [the November 2026 audit](docs/audit/README.md) for evidence, fixes and outstanding gates, and
[the post-deployment assurance package](docs/audit/post-deployment/POST_DEPLOYMENT_ASSURANCE.md) for the follow-up.
Passing local tests is not full-platform verification. First and post-deployment
audit fixes are included in the launch deployment recorded above. No audit or
launch changes have been distributed to installed apps. Physical-device accessibility, iOS compilation,
merchant permissions, legal determinations and state-restoration drills remain separate
release checks. `KNOWLEDGE_REUSE_ENABLED` is true, but the shipped knowledge policy is
empty/unapproved; the learning ranker remains disabled.
