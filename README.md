# Santa's Helper - christmasidea.co.uk

One Cloudflare Worker that serves the website and its small API:

- `site/` - the website (one page, self-hosted fonts, favicon).
- `src/` - the Worker: AI gift ideas from Claude, optional verified-product discovery through retailer providers, product matching, limits that cap usage, and a redirect from www to the main domain.
- `wrangler.toml` - settings, already pointed at christmasidea.co.uk and www.christmasidea.co.uk.

If the AI is unavailable or its daily cap is reached, the Worker selects from `src/catalogue.js` and runs the candidates through the same recipient-aware validator as AI ideas. It uses stated age, explicit exclusions, owned items and budget bands, and returns fewer than eight when that is all that survives. The catalogue has only coarse price bands (not verified product prices), so a strict budget below £10 may have no verified fallback idea. Product discovery is optional; when unavailable or disabled, the site shows its locally rendered gift-box placeholder and keeps the Amazon search link.

## Pages and launch assets

- `site/gifts/` - ten original gift guides plus an index, `site/404.html`, `site/guide.css` and `site/sitemap.xml` are **generated** by `npm run build:pages` (`scripts/build-site-pages.mjs`). Edit the guide content in that script, re-run it and commit the output. The affiliate tag is read from `AMAZON_TAG` in `site/index.html`.
- `site/robots.txt`, `og-image.png`, `apple-touch-icon.png`, `about.html`, `privacy.html`.
- `src/index.js` sets security headers (CSP, HSTS, framing and referrer policy). The CSP allows inline scripts and styles because the pages use them, plus approved Amazon image hosts and Cloudflare Turnstile and Web Analytics. Tighten it if you move scripts into hashed files.

## Before you publish (checklist)

1. Rotate the Anthropic key and keep keys out of the project folder (set `ANTHROPIC_API_KEY` as an environment variable or Wrangler secret only).
2. Legal pages are filled in (name, address, email). Check you are happy for your home address to be public; a virtual office or PO-style business address is an alternative, but it must still be a geographic address where you can be reached. Register with the ICO if required.
3. `npm test` and `npx wrangler deploy --dry-run` must pass.
4. Re-run the five-case smoke test and review the actual recommendations (see the benchmark section), then the full 30-case run.
5. Set a monthly spend limit in the Anthropic console. `DAILY_AI_LIMIT` is 500 for launch (at about $0.0015 a call that is roughly $0.75 a day, or about $25 a month in the worst case); raise it once traffic and quality justify it. Over the cap, visitors get the recipient-aware fallback.
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

For `IP_SALT`, type any long random string. It's used to anonymise visitor IPs for the rate limits.

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

Prompt `gift-curator-v3.3` (frozen v2 snapshot in `src/prompts/gift-curator-v2.js`) makes **one** Claude call. The model first fills a structured `recipient_profile` (`known_facts` as `{fact, evidence}` pairs, separate `inferences`, exclusions, budget), then returns **exactly 10 ranked candidate ideas**; the server validates them and shows the best 8. Spare candidates replace rejected ones, so no second API call is needed, and nothing is invented server-side if fewer than 8 survive (`shortfall: true`). Ideas are gift *concepts* to search for, never verified products, prices or availability.

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

The API response keeps its existing shape and adds `prompt_version` and `shortfall`; a separate `/api/products` endpoint optionally enriches the concepts. The cache key includes the prompt version, validator version, model, generation settings (thinking, effort, output limit) and input (namespace `/ideas/v6/`), so results produced under different effort settings never share an entry. `MAX_OUTPUT_TOKENS` is 4500: the visible JSON needs roughly 1,500-2,000 tokens, and the rest is headroom. Validators and match scores are heuristic, calibrated with deterministic cases rather than a live-product benchmark; reject any match that fails a hard criterion.

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
2. **Per-visitor caps**: 4 AI searches a minute and 15 a day. Visitors are identified by a hashed IP that changes daily; raw IPs are never stored.
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

The About/contact and privacy pages are drafts in `site/about.html` and `site/privacy.html`. They contain explicit pre-publication notices because the operator's legal name, geographic address and contact email have not been supplied. Complete and verify those notices before publishing.

## Tests

```bash
npm test   # Worker tests
```

## Gift recommendation benchmark (Haiku vs Sonnet)

The repository includes a fixed set of 30 synthetic recipient scenarios in `benchmarks/recipients.json`. It covers both freeform and guided inputs, limited budgets, specific hobbies, people who "have everything", age suitability, explicit dislikes, items already owned, low-information requests and cross-interest gift ideas.

The benchmark (protocol 4) builds its request with the **same function as the production Worker** (`buildClaudeRequest` in `src/core.js`). For Haiku 5.5 that means the identical system prompt, the strict `gift_ideas` tool, a **forced** `tool_choice` (`{type: "tool", name: "gift_ideas"}`), `thinking: {type: "adaptive"}`, `output_config.effort: "low"` and the production output limit. Anthropic's Haiku 5.5 migration guide documents that Haiku accepts a forced `tool_choice` and that the response then starts with the tool call and has no thinking block, so forcing the tool also stops hidden thinking tokens consuming the output allowance. Sonnet 5.5 does not support forced tool selection, so if it is selected (`--models=sonnet`) it alone uses `tool_choice: auto` plus an instruction to call the tool. The runner rejects resuming runs made under an older protocol. It does not modify the production model setting and makes no retailer or image-provider calls. It records response time, Anthropic token usage, `stop_reason`, `thinking_tokens`, estimated API cost, the recipient summary, the returned ideas and basic machine-checkable warnings. The default output ceiling is the production limit of 4,500 tokens per response (`BENCHMARK_MAX_TOKENS` can override it) and the default effort is the production `low` (`BENCHMARK_EFFORT` can override it); both are recorded in the run file, and a run cannot be resumed under different settings. Actual billed output is based on tokens generated, not the ceiling. A response that stops with `stop_reason: max_tokens` is recorded with status `truncated`, flagged `TRUNCATED_max_tokens`, and never treated as an ordinary success. The warnings are a triage aid, not a substitute for human judgement. Each result also stores the unfiltered `raw_output`, the visitor-facing `output` and a `validation` block (candidates generated, accepted, rejected with reason codes, repairs, warnings).

### 1. Preview without spending API credits

```bash
npm run benchmark
```

This is a dry run. It lists the number of cases and planned requests but makes no network calls.

### 2. Run a small live pilot first

Set `ANTHROPIC_API_KEY` in your terminal environment. Do not paste the key into source code or commit it to Git.

Windows PowerShell:

```powershell
$env:ANTHROPIC_API_KEY = "your-Anthropic-API-key"
npm run benchmark -- --live --confirm-cost --limit=5
```

macOS / Linux:

```bash
export ANTHROPIC_API_KEY="your-Anthropic-API-key"
npm run benchmark -- --live --confirm-cost --limit=5
```

The pilot makes 5 Haiku calls by default (the runner now defaults to `--models=haiku`; add `--models=haiku,sonnet` to include Sonnet). Check `stop_reason`, candidate/accepted/rejected counts and token usage before running all 30 cases. Use a fresh pilot after updating from benchmark protocol 1; do not resume an older run.

### 3. Run the full comparison

```bash
npm run benchmark -- --live --confirm-cost
```

This makes 30 Haiku calls with the current prompt (`gift-curator-v3.3`). Add `--models=haiku,sonnet` for the old two-model comparison (60 calls). Calls are made sequentially, retried up to three times for transient rate-limit/server errors, and checkpointed after every response. If interrupted, use the path to the saved `benchmark-results.json`, repeating the same `--models`, `--case` and `--limit` selection:

```bash
npm run benchmark -- --live --confirm-cost --resume="benchmarks/runs/<run-folder>/benchmark-results.json"
```

You can also run one model or selected cases:

```bash
npm run benchmark -- --live --confirm-cost --models=haiku
npm run benchmark -- --live --confirm-cost --case=case-01 --case=case-18
```

Each run creates:

- `benchmark-results.json` — full outputs, actual usage, latency and estimated costs.
- `review-template.csv` — paired outputs labelled Model A / Model B, so the reviewer can score them without seeing which model produced each row.
- `blind-key.json` — the model mapping. Keep this closed until the review scores have been completed.

### 4. Review the outputs

Open `review-template.csv` in Excel. Read each pair for the same `case_id` and score both rows from 1 to 5. Use the same standard for each model:

| Criterion | Weight | What a strong result looks like |
|---|---:|---|
| Recipient fit | 25% | Ideas clearly reflect the actual person and their stated interests. |
| Budget fit | 15% | Ideas are realistically within the stated budget; no invented prices. |
| Variety | 15% | Ideas are meaningfully different, not small variations of one product. |
| Originality | 10% | Includes thoughtful, less-obvious suggestions without becoming random. |
| Constraints and age safety | 15% | Respects dislikes, owned items, age, safety and other explicit restrictions. |
| Product search usefulness | 10% | Queries describe specific product types likely to find relevant results. |
| Summary accuracy | 10% | Summary is concise and does not invent interests, traits or facts. |

Use 1 = poor / clear failure, 3 = acceptable / mixed, and 5 = excellent. A clearly unsafe or explicitly excluded recommendation should receive a low constraints-and-safety score, even if the rest of the list is good. Do not award originality for novelty alone: the idea still needs to suit the recipient.

Once all seven rating columns are filled for every reviewed row, run:

```bash
npm run benchmark:score -- "benchmarks/runs/<run-folder>/review-template.csv"
```

The scorer uses `blind-key.json` only after ratings are complete. It reports weighted averages, criterion averages and paired wins, then saves `score-summary.json`.

### 5. Blind prompt comparison: gift-curator-v2 vs gift-curator-v3 (offline, no API cost)

Reuse the historical Haiku v2 outputs (`benchmarks/runs/2026-11-02T23-17-14-316Z`, never modified) and compare them with a v3 run:

```powershell
npm run benchmark:compare -- --candidate="benchmarks\runs\<v3-run-folder>\benchmark-results.json" --model=haiku
```

Both runs are replayed through the **same current validators**, so the comparison is of visitor-facing results (v3's best eight of ten valid candidates versus v2's eight, after validation). The command writes a new folder under `benchmarks/comparisons/` containing `blind-review.csv` (randomised Model A/B, titles, descriptions, summaries, queries, neutral validation diagnostics, seven score columns), `blind-key.json`, `comparison-metrics.json` and `comparison-report.md`. Score only `blind-review.csv`; do not open the other files first. Then:

```powershell
npm run benchmark:score -- "benchmarks\comparisons\<folder>\blind-review.csv"
```

The metrics file reports deterministic measures (ideas shown, ideas rejected within the first eight, replacements used, summaries replaced, tokens, cost) so genuine quality gains can be told apart from filtering. Caveats: validators are heuristic and were tuned against the v2 baseline; v2 lacks the price/angle/basis fields that some v3 checks use; the AI-led scores are subjective, and 30 synthetic cases cannot establish statistical significance. A pilot with fewer than 30 cases compares only the shared cases.

### Model pricing used in estimates

As checked against Anthropic's published model pages on 2 November 2026, the standard API rates used by the runner are:

| Model | Input / 1M tokens | Output / 1M tokens |
|---|---:|---:|
| Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10 | $0.50 |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2.00 | $10.00 |

The runner calculates estimates from the token usage returned by Anthropic. The result may differ from the final account bill due to account-specific pricing, credits, taxes or changes to published rates. Re-check Anthropic's current [model documentation](https://platform.claude.com/docs/en/models/overview) before a future run. No model switch should be made solely from an aggregate score: inspect poor outputs, case-by-case wins, response times and cost per usable idea too. Keep Haiku as the production default until the evidence justifies a change.
