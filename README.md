# Santa's Helper - christmasidea.co.uk

One Cloudflare Worker that serves the website and its small API:

- `site/` - the gift finder, editorial guides and legal pages, with self-hosted fonts and original illustrations.
- `src/` - the Worker: AI gift ideas from Claude, optional verified-product discovery through retailer providers, product matching, limits that cap usage, and a redirect from www to the main domain.
- `wrangler.toml` - settings, already pointed at christmasidea.co.uk and www.christmasidea.co.uk.

If the AI is unavailable or its daily cap is reached, the Worker selects from `src/catalogue.js` and runs the candidates through the same recipient-aware validator as AI ideas. It uses stated age, explicit exclusions, owned items and budget bands, and returns fewer than eight when that is all that survives. The catalogue has only coarse price bands (not verified product prices), so a strict budget below £10 may have no verified fallback idea. Product discovery is optional; when unavailable or disabled, the site shows typographic idea cards without pretend product photographs and keeps the Amazon search link.

## Quality checks

### Release recommendation selection

Production selects `RECOMMENDATION_MODE = "baseline-v3.3"` in `wrangler.toml`, following the completed paired review's preference for the preserved baseline. This uses the frozen v3.3 prompt/tool, its ten candidates, and the validator's original-order variety selection. It does not run graph top-ups, discovery hints or v3.4 reranking. Current safety and product-only validation remain in place. The preserved baseline keeps identical titles and ordering on 29/30 cases; case-12 intentionally replaces the inconsistent "Garden kneeling pad and tool apron" (title/concept name an apron, while its query and explanation describe a kneeler with pockets) with the next valid candidate, "Personalised herb garden marker set". `test/baseline-release.test.js` asserts that exact rejection and replacement, and exact parity for the other 29. Catalogue fallback also uses the original catalogue curation.

The shared validator rejects explicit product-identity conflicts between kneeling aids and aprons, and between enamel camping coffee pots and moka/stovetop espresso makers. It checks title, concept, raw and cleaned query, the leading product description in the explanation, and feature/variant specs. It never rewrites a product to force agreement: the next validated candidate is used, or an honest shortfall is returned. These are narrow deterministic guards, not comprehensive natural-language consistency verification; unknown types and incidental explanatory mentions retain the existing checks. Explicit synonyms can satisfy query/title agreement without sharing literal words.

"Show me different ideas" retains the existing title-only request payload: the browser sends its last 24 displayed titles (in memory, reset on a new form submission), and the API accepts at most 24 entries of 80 characters each. Retries preserve that request's exclusions. In addition to existing exact/stem-overlap checks, known kneeling-aid, moka and enamel-coffee-pot identities match rewordings across candidate title/concept/query and within a batch. Kneeling mats, pads, cushions and kneeler-seats count as one aid; storage seats, ordinary pads, apron types, books, covers and other accessories are not automatically collapsed. Grinders and drippers remain distinct. This is bounded freshness protection, not indefinite session-wide uniqueness or general semantic matching. The validator version participates in cache identity, as do the normalized exclusions and baseline/experimental mode; older curated responses cannot bypass the new checks.

The v4 prompt and engine remain preserved for offline research. The existing v3.3/v3.4 replay commands describe the experimental engine, not the selected baseline release. `test/baseline-release.test.js` checks the release path against the preserved baseline, including prompt selection, cache isolation and Turnstile enforcement. No new live model quality result is claimed.

Rollback: record the currently deployed Cloudflare version before deployment. If post-deployment checks fail, use Cloudflare's deployment rollback to that recorded version. This rolls back the Worker and assets, not Durable Object data or secrets. Do not rotate secrets or alter storage during rollback. The previous version lacks the release fixes, so treat rollback as temporary containment, not acceptance.

Run the deterministic suite and fixed benchmark replays locally:

```powershell
npm ci
npm test
npm run benchmark:replay:v3.3
npm run benchmark:replay:v3.4
```

These replays use stored model outputs and make no API calls. CI runs the same checks; a live Claude benchmark is intentionally not part of routine CI. After a material prompt or engine change, run the live benchmark only with explicit cost confirmation, then prepare and complete the blind paired review described in `benchmarks/v3.4/README.md`.

## Pages and launch assets

- `site/gifts/` - ten original gift guides plus an index, `site/404.html` and `site/sitemap.xml` are **generated** by `npm run build:pages` (`scripts/build-site-pages.mjs`). Edit the guide content/templates in that script, re-run it and commit the output. Each of the 80 guide ideas has specific buying advice; shopping links are sponsored searches, not tested products or guaranteed prices. The affiliate tag is read from `AMAZON_TAG` in `site/index.html`.
- `site/theme.css` owns the shared parchment/forest colour tokens, automatic dark mode, local Fraunces/Figtree fonts, masthead/footer and reduced-motion rules. Edit `site/home.css` for the single-column finder, and `site/guide.css` for editorial/legal pages directly; the page build preserves these stylesheets. Shared header/footer markup comes from `site/index.html`; the generator also synchronizes it into `about.html` and `privacy.html` without replacing their authored legal content. `site/site-shell.js` supplies the shared countdown and secondary-page shortlist badge; `/?shortlist=1` opens the finder's existing saved-ideas dialog.
- Original object illustrations live in `site/gift-objects.svg`, with a distinct scene for each guide. No external UI, font or illustration dependencies are needed. The homepage focuses on the finder without a sample-collection sidebar. Its curation stages are illustrative, not server progress; cancellation and errors retain the description. Recommendations are concept-led (featured/companion plus lighter entries), with photographs shown only for verified products. See [the design direction and research](docs/design-direction.md) for rationale and acceptance criteria.
- `site/robots.txt`, `og-image.png`, `apple-touch-icon.png`, `about.html`, `privacy.html`.
- `src/index.js` sets security headers (CSP, HSTS, framing and referrer policy). The CSP allows inline scripts and styles because the pages use them, plus approved Amazon image hosts and Cloudflare Turnstile and Web Analytics. Tighten it if you move scripts into hashed files.
- The browser's Cancel button aborts the browser fetch and returns the UI to the form; it does not guarantee that the Worker or an already-started Claude request stops processing. The Worker applies its own upstream timeout.

## Before you publish (checklist)

1. Rotate the Anthropic key and keep keys out of the project folder (set `ANTHROPIC_API_KEY` as an environment variable or Wrangler secret only).
2. Legal pages are filled in (name, address, email). Check you are happy for your home address to be public; a virtual office or PO-style business address is an alternative, but it must still be a geographic address where you can be reached. Register with the ICO if required.
3. `npm test` and `npx wrangler deploy --dry-run` must pass.
4. Re-run the five-case smoke test and review the actual recommendations (see the benchmark section), then the full 30-case run.
5. Set a monthly spend limit in the Anthropic console. `DAILY_AI_LIMIT` is 500; the stored v3.4 Haiku run averaged about $0.0021 per call, or roughly $1.05/day and $31.50 per 30 days at the cap before cache hits. Actual costs vary with tokens, pricing and traffic. Over the cap, visitors get the recipient-aware fallback.
6. Add your Cloudflare Web Analytics token, enable Turnstile (`TURNSTILE_SITE_KEY` in `site/index.html` and `TURNSTILE_SECRET`), and submit `sitemap.xml` to Google Search Console.

## Go live (about 15 minutes)

You need [Node.js](https://nodejs.org) (the LTS version) installed. Then, in a terminal inside this folder:

**1. Install and log in to Cloudflare**

```bash
npm install
npx wrangler login
```

This opens your browser to approve access to your Cloudflare account (the one where you bought the domain).

**2. Get your Claude API key**

- Claude: [platform.claude.com](https://platform.claude.com) > API keys > create a key. Add some credit, and set a monthly spend limit on the Billing page (US$10 is plenty to start).

**3. Store the keys as secrets** (paste each one when asked; they never go in the code)

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put IP_SALT
```

For `IP_SALT`, set a securely generated random value of at least 32 characters. It is used to derive a daily-changing pseudonymous rate-limit identifier; this is not anonymisation. `npx wrangler secret list` confirms only that a secret name is configured. It does not reveal or verify the value's length or randomness, which the operator must check privately.

For local development, put `IP_SALT=<a locally generated random value of at least 32 characters>` in the ignored `.dev.vars` file. The API fails closed with a generic unavailable response if the salt is missing or too short; never commit `.dev.vars`.

`/api/health` is a liveness check only. `/api/ready` returns ready only when the required `IP_SALT` passes the generic configuration check; it never exposes the secret or its length.

**4. Deploy**

```bash
npx wrangler deploy
```

Cloudflare creates the DNS records and the HTTPS certificate for both christmasidea.co.uk and www automatically. Cloudflare won't attach the Worker to a hostname that already has a CNAME record, so if the domain has any existing DNS records for the main domain or www, delete them in the Cloudflare dashboard first. The certificate can take a few minutes to appear.

**5. Check it**

Open https://christmasidea.co.uk, run a search, and click a shop button. The Amazon address should end with `tag=mcstarrstud0c-21`. Amazon's Associates help pages explain how to check that links are tagging to your account.

To change something later, edit the files and run `npx wrangler deploy` again.

## Amazon Associates

- Tracking ID `mcstarrstud0c-21` is set in `site/index.html` (settings block at the top).
- Add `https://christmasidea.co.uk` to the websites listed in your Associates account and follow the current Associates application requirements. Do not rely on a fixed qualifying-sales number for Creators API access: Amazon's current documentation says the account must be finally accepted and have referred qualified sales, but does not publish one universal threshold there.
- Do not buy through your own links or ask, request, or encourage friends, relatives, employees, contractors, or business contacts to buy through them. Build qualifying traffic from genuine, independent visitors.

The Amazon Creators API feature is disabled by default. Amazon's official UK documentation requires final Associates acceptance and qualified sales before Creators API registration; access for this specific account cannot be checked from this repository. The responsive site must also be reviewed against the current Associates policy, including whether Amazon requires approval for this site's intended product-content use. Obtain any required approval before enabling the feature.

To enable it after approval and credential issuance:

1. In Amazon Associates Central, register a Creators API application and obtain the Credential ID, Secret and EU credential version (UK is listed under EU version 3.2). The UK token endpoint is `https://api.amazon.co.uk/auth/o2/token`; the OAuth request uses `client_credentials` and scope `creatorsapi::default`, and API calls go to `https://creatorsapi.amazon`. Current request documentation specifies a bearer `Authorization` header, `Content-Type: application/json`, and `x-marketplace`; it does not require AWS Signature Version 4.
2. Set the credentials as Worker secrets (never put them in `wrangler.toml`):

   ```powershell
   npx wrangler secret put AMAZON_CREATORS_CLIENT_ID
   npx wrangler secret put AMAZON_CREATORS_CLIENT_SECRET
   ```

3. Set `PRODUCT_DISCOVERY_ENABLED = "true"` in `wrangler.toml`, confirm `AMAZON_PARTNER_TAG` is the UK tracking ID for the registered Associates account, then run `npm test` and `npx wrangler deploy --dry-run` before a separately approved deployment.

Creators API search uses `SearchItems` (up to 10 results), explicitly filters for available new items, and retrieves titles, brands/features, primary and variant image URLs, and offers where returned. Product matches must identify the full product type in the listing title, match any explicit brand/colour/size/model/edition constraints, be explicitly new and in stock, and fit any stated budget. The application rejects uncertain matches, unapproved image hosts and affiliate destinations that do not match the ASIN. If there is no suitable verified match, the existing Amazon search link and decorative local placeholder remain. The account's actual Creators API TPS allocation is unknown; the default global limit is one request per second and can be configured after Amazon confirms the allocation.

Amazon's official Creators API guidance specifies a one-hour cache TTL for `Offers` and one day for other listed resources, including images, item details and detail-page URLs. This application uses a stricter one-hour cache for all normalized Amazon results, never downloads or stores image bytes, and never uses Amazon content when the flag or credentials are absent. Review the [UK Creators API documentation](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/get-started/using-curl), [UK Creators API cache guidance](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/concepts/best-programming-practices), [UK Creators API registration guide](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/onboarding/register-for-creators-api), and [UK Associates policies](https://affiliate-program.amazon.co.uk/help/operating/policies) before enabling or changing this integration.

## Recommendation quality

Prompt `gift-intelligence-v4.0` (v3.3 is frozen in `src/prompts/gift-curator-v3.3.js`) still makes **one** Claude call. The model fills a structured `recipient_profile` and suggests discovery directions, then returns **12 candidate ideas**. The gift intelligence engine (`src/engine/`, described in [docs/gift-intelligence-engine.md](docs/gift-intelligence-engine.md)) then takes over. It builds a recipient model and walks an interest/motivation graph to find adjacent ideas. It retrieves curated graph concepts (BM25 + graph ranker, fused with RRF) and scores every candidate on grounding, fit, novelty, specificity and budget. It picks 8 with MMR diversification and attaches a connection quoted from the shopper's own words.

Graph concepts only top up a thin list (at most 3), so `shortfall: true` is now rare. Ideas are gift *concepts* to search for, never verified products, prices or availability. Anonymous click, save and dismiss counters go to `POST /api/feedback`; they do not change ranking yet.

**Facts versus inferences.** A `known_fact` must carry a short verbatim `evidence` extract that the server finds in the shopper's text (case and punctuation ignored). Unverified facts are kept in diagnostics (`facts_unverified`) and are never used to build the recipient summary; an unsupported summary is replaced with one built from verified facts only.

**Thinking effort.** Haiku 5.5 uses adaptive thinking at `low` effort by default, matching `wrangler.toml`; thinking tokens count towards `max_tokens`. Every request sends `thinking: {type: "adaptive"}` and the configured effort (never the legacy `budget_tokens`, which Haiku 5.5 rejects). The Worker forces the `gift_ideas` tool; a live forced-tool smoke test recorded 0 thinking tokens. Both the Worker and benchmark runner build the request from `generationParams()` in `src/core.js`. `CLAUDE_EFFORT` and `BENCHMARK_EFFORT` can set `low`, `medium` or `high`. Judge effort settings by recommendation quality, not token usage alone.

Server-side checks (`src/validate.js`, rules in `src/rules.js`, recipient parsing in `src/recipient.js`) are deterministic and heuristic. They reject, or repair only by removing text, and never invent content:
- malformed or missing fields; duplicate titles, concepts and near-identical product search queries
- budget (parsed from the visitor's input; the model's private price estimate is never displayed)
- age safety: baby/toddler/child rules, small loose parts, specialist equipment, supervision notes
- unsupported safety, age-rating, price or stock claims
- unknown-preference topics (fragrance, personal care, sized clothing, consumables), explicit dislikes, owned items
- injection echoes, brand/model names and marketing noise in queries, title/query/description mismatch
- recipient summaries that mention things the shopper never said (replaced by validated known facts)

The API response keeps its existing shape and adds `prompt_version` and `shortfall`; a separate `/api/products` endpoint optionally enriches the concepts. The cache key includes the prompt version, validator version, model, generation settings (thinking, effort, output limit) and input (namespace `/ideas/v7/`), so results produced under different effort settings never share an entry. `MAX_OUTPUT_TOKENS` is 4500: the visible JSON needs roughly 1,500-2,000 tokens, and the rest is headroom. Validators and match scores are heuristic, calibrated with deterministic cases rather than a live-product benchmark; reject any match that fails a hard criterion.

Evaluation is AI-led and subjective; 30 synthetic cases cannot show statistical significance.

The model is configurable with `MODEL`; the default stays Claude Haiku 5.5.

## Running costs

| Service | Free allowance | What this site uses |
|---|---|---|
| Cloudflare Workers | 100,000 requests a day | about 4 per page view plus 1-2 per search |
| Cloudflare Durable Objects | 100,000 requests a day | 1-2 per search |
| Amazon Creators API | Account-specific request allocation | Disabled by default; capped at 120 calls/hour globally and 32/day per visitor when enabled |
| Claude Haiku 5.5 | pay as you go | usage depends on input/output tokens; check actual usage in the Anthropic Console |

The Claude API is the main variable cost. At the configured cap of 500 AI searches a day, total spend depends on the tokens used by each request and response; set a hard monthly spend limit in the Anthropic Console and monitor actual usage rather than relying on a fixed per-search estimate.

### Limits that stop costs running away

1. **Daily AI cap** (`DAILY_AI_LIMIT`, default 500, resets midnight UTC). Above it, visitors get recipient-aware suggestions from the Worker catalogue.
2. **Per-visitor caps**: 4 AI searches a minute and 15 a day. Rate limits use a pseudonymous IP-derived value that changes daily; Cloudflare also processes connection data to operate the service.
3. **Product lookup caps** limit Amazon API calls per second (default 1), per hour and visitor (`PRODUCT_SEARCH_PER_SECOND_LIMIT`, `PRODUCT_SEARCH_HOURLY_LIMIT`, `PRODUCT_SEARCH_PER_VISITOR_DAILY_LIMIT`, `PRODUCT_SEARCH_PER_VISITOR_MINUTE_LIMIT`). Confirm the actual account allocation with Amazon before choosing production limits.
4. **Browser CORS policy** (`ALLOWED_ORIGINS`) limits which browser origins can read API responses. It is not authentication: non-browser clients can spoof `Origin`, so enable Turnstile and retain rate/spend limits.
5. **Claude Console spend limit** as the final backstop.

Identical searches are cached for a day and cost nothing.

To test a higher-capability model, set `MODEL = "claude-sonnet-5-5"` in `wrangler.toml`. Compare it on the same recipient test set and check current per-token pricing before switching the default.

## Compliance checklist (built in)

- Amazon's required statement, "As an Amazon Associate I earn from qualifying purchases", appears above the results and in the footer, with a plain-English explanation.
- Every shop link is marked `rel="sponsored"` and labelled "Ad".
- A price is shown only when the official API returns a GBP offer and the server-side offer data is still fresh; no price is inferred or invented. Confirm current Associates price-display requirements before enabling product discovery.
- When product discovery is disabled or no high-confidence result is found, the locally rendered placeholder is clearly identified as decorative, not a product photograph.
- The affiliate tag is fixed in the code, so visitors can't change it.
- Product titles, destinations, prices and images are validated on the server; only image URLs from the official Amazon product response and approved Amazon image hosts are accepted. Pexels is not used and no Pexels credentials are required.
- No tracking cookies; fonts are self-hosted, so visitors' browsers don't contact Google.

## Optional: bot protection

If you see abuse, create a free Cloudflare Turnstile widget for christmasidea.co.uk, put its site key in `TURNSTILE_SITE_KEY` in `site/index.html`, and run `npx wrangler secret put TURNSTILE_SECRET` with its secret key.

## Editing the fallback catalogue

The `CATALOGUE` array in `src/catalogue.js` is Worker-side. Each entry has a title (`t`), Amazon search (`q`), category (`c`), supported age groups (`a`), coarse budget bands (`b`), interest keywords (`k`) and description (`w`). The legacy photo-search field is unused. The fallback is filtered by age and conservative budget-band ceilings, then validated against exclusions, known small-parts rules, preferences and already-owned items. Add and test catalogue entries there; the browser does not contain a second gift list.

The About/contact and privacy pages contain operator and contact details. The operator must verify their accuracy, required disclosures and publication suitability before release.

## Tests

```bash
npm test
npm run benchmark:replay:v3.3
npm run benchmark:replay:v3.4
```

## Current gift recommendation evaluation

The current benchmark has 50 synthetic cases, including 30 original scenarios shared with the preserved v3.3 baseline and 20 v3.4 discovery cases. The stored Claude Haiku 5.5 run used one request per case, adaptive thinking, low effort and a 4,500-token output limit; it cost $0.104119 total. Its model latency was 12.7 seconds at the median and 14.2 seconds at p95. These are stored-run measurements, not live-site latency or evidence of perceived quality.

See [the v3.4 benchmark guide](benchmarks/v3.4/README.md) for run settings, metric meanings, human results and limitations. The 30-case paired score sheet and separate 50-case Haiku review are complete. In the paired review, v3.3 was preferred on 28 cases and v3.4 on 2; this single-score-sheet result does not support claiming a perceived-quality improvement. See the [paired scores](benchmarks/v3.4/paired-blind-review-scored.csv), the [50-case Haiku scores](benchmarks/v3.4/live-haiku/review-template-completed.csv) and the [weighted summary](benchmarks/v3.4/live-haiku/score-summary.json). Distribute only the blinded CSV, never the A/B key alongside it. The fixed-seed assignment is reproducible and is not independent randomisation.

Routine CI runs unit/regression tests, benchmark integrity checks and fixed offline replays of the stored v3.3 and v3.4 outputs. This is an integrity/replay regression check, not a recommendation-quality gate or evidence that quality improved; it does not call Claude. For a major prompt/engine change, run a live benchmark only with explicit cost confirmation:

```bash
npm run benchmark -- --live --confirm-cost --models=haiku --cases-file=benchmarks/v3.4/cases.json --output=benchmarks/v3.4/live-haiku
```

The live command requires `ANTHROPIC_API_KEY`; do not commit it. The benchmark writes a new output directory, so choose a new path rather than overwriting historical artifacts.
