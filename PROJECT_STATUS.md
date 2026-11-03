# Santa's Helper — Project Status

Brand: **Santa's Helper**. Domain: **ChristmasIdea.co.uk** (retained). Worker name, routes and the Associates tag `mcstarrstud0c-21` are unchanged. This is the canonical status record.

## Completed

- Santa's Helper branding across pages, gift guides, metadata, OG image and package metadata.
- Claude gift recommendation engine, with structured output, validation, catalogue fallback and rate limiting.
- Recommendation prompt v3.3 and its request-generation changes (`src/prompt.js`, `src/validate.js` validator-v4).
- Phase 0 provider-neutral product architecture: provider registry, generic offer validation, per-provider image-host allow-lists, identity matching separate from suitability.
- Amazon Creators API product-discovery implementation. It is dormant: `PRODUCT_DISCOVERY_ENABLED = "false"` in `wrangler.toml`.
- v3.3 Haiku 5.5 quality baseline: `benchmarks/baselines/v3.3-pre-refactor/` (4.133/5 weighted, 30 synthetic cases, single AI reviewer; see its README for limitations).
- Recovery points: `refs/snapshots/phase0-pre-refactor` and `C:\Christmas_List2\backups\christmasidea-phase0-snapshot.bundle`.

## Blocked (external dependencies)

- Amazon Creators API production activation: pending confirmation of Associates eligibility, qualifying sales, credentials and actual API access. Live API access has not been tested.
- Any other retailer integration (e.g. Awin): pending approval, access, commercial terms and image usage rights.

## Not yet implemented

- Richer associative gift discovery.
- Improved originality and diversity.
- Better budget reasoning.
- More sophisticated semantic constraint handling.
- Multi-retailer product discovery.
- Trend and popularity intelligence.
- Recommendation feedback and learning.
- Occasion-specific modes beyond Christmas.

## Next phase: v3.4 recommendation-engine improvement (proposal, not implemented)

Targets from the v3.3 audit: originality 3.30, budget fit 3.63, variety 3.83, plus constraint/compatibility weaknesses.
Findings to investigate:

- Prompt step 5 ("relevance always beats novelty") suppresses adventurous ideas.
- Variety caps are by category/angle/type, not by interest.
- Constraints are enforced only lexically.
- The budget check relies on the model's own price estimate.
- `product_spec` is about a third of output tokens and is used only by disabled product matching.
- The summary is hard-sliced at 180 characters.

Proposed method: small prompt and code changes, then a blind paired v3.4 vs v3.3 benchmark (repeated runs, deterministic metrics added).

## Open product-policy decision

The product-only policy bans vouchers, tickets, services and subscriptions, which excludes many experience gifts. Unresolved; decide during the v3.4 phase. Current policy is unchanged.

## Deferred / hygiene notes

- Confirm `IP_SALT` is set in production (code falls back to a default).
- `/api/products` trusts client-supplied ideas; consider a server-issued plan id.
- Confirm the Cloudflare plan's CPU and subrequest limits before enabling product discovery.
- Rotate any Anthropic API key that has been shared in plain text.
- Earlier "awaiting approval" notes for Phase 0 and benchmark work are closed; those tasks are complete.
