# Santa's Helper — Project Status

Brand: **Santa's Helper**. Domain: **ChristmasIdea.co.uk** (retained). Worker name, routes and the Associates tag `mcstarrstud0c-21` are unchanged. This is the canonical status record.

## Completed

- Release selection: `RECOMMENDATION_MODE = "baseline-v3.3"` selects the frozen baseline prompt and original-order curation with current safety validation. The release regression preserves 29 of 30 stored title lists/order; case-12 deliberately replaces an inconsistent kneeling-pad/apron concept. The v4 engine remains available for offline research, not selected for production.

- Santa's Helper branding across pages, gift guides, metadata, OG image and package metadata.
- Claude gift recommendation engine, with structured output, validation, catalogue fallback and rate limiting.
- Recommendation prompt v3.3 and its request-generation changes (`src/prompt.js`, `src/validate.js` validator-v4).
- Phase 0 provider-neutral product architecture: provider registry, generic offer validation, per-provider image-host allow-lists, identity matching separate from suitability.
- Provider-neutral product discovery is implemented. Wrangler enables global discovery, eBay and photo-first mode; the Amazon and Awin provider flags remain false. Credentials, merchant approvals and deployed configuration require separate verification.
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

## Open product-policy decision

The product-only policy bans vouchers, tickets, services and subscriptions, which excludes many experience gifts. Unresolved; decide during the v3.4 phase. Current policy is unchanged.

## Deferred / hygiene notes

- The audit's read-only production `/api/ready` check returned ready. This checks the configured salt's minimum length only; its entropy, custody and rotation history remain privately operator-verifiable.
- `/api/products` trusts client-supplied ideas; consider a server-issued plan id.
- Confirm the Cloudflare plan's CPU and subrequest limits before enabling product discovery.
- Rotate any Anthropic API key that has been shared in plain text.
- Earlier "awaiting approval" notes for Phase 0 and benchmark work are closed; those tasks are complete.

## Audit and release limitations

See [the November 2026 audit](docs/audit/README.md) for evidence, fixes and outstanding gates.
Passing local tests is not full-platform verification. No audit changes have been deployed
or distributed to installed apps. Physical-device accessibility, iOS compilation,
merchant permissions, legal determinations and state-restoration drills remain separate
release checks. `KNOWLEDGE_REUSE_ENABLED` is true, but the shipped knowledge policy is
empty/unapproved; the learning ranker remains disabled.
