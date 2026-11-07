# Launch readiness: 6 November 2026

This is an implementation/release checklist, not legal advice. Do not announce
until the remaining external launch gates are resolved.

## Implemented

- Shared listing safety screens title, description and features using the same
  restricted-item, minor, baby and small-parts lexicons as idea validation.
  Regression tests cover all four reported unsafe bundles and under-3 warnings.
- Conservative eBay compliance: no eBay listing content on mixed-retailer cards.
  API discovery is off; the frontend also refuses stale eBay offers. Search
  links retain campaign 5339240592. Photos can no longer make ideas disappear.
- Company disclosures use the [Companies House record](https://find-and-update.company-information.service.gov.uk/company/17215758)
  checked on 6 November: NOAH NEUROTECH LTD, number 17215758, registered in
  England and Wales. Full registered office and email appear on public pages.
- Definite commission wording, exact Amazon and eBay statements, guide-card and
  title Ad labels, author/update details, buying methodology, homepage structured
  data and responsive guide-image preloads.
- Privacy lawful bases by purpose, separate right to object, ICO complaints,
  Anthropic Ireland/DPA/UK Addendum information, enabled analytics, adult audience
  and Terms. See [audience assessment](child-audience-assessment.md).
- Wishlists and guide Save/Saved labels start with their visible words. Other
  deck labels now include Back, Pass, Save and How it works.
- All feedback needs signed receipts, including `more`; receipt signing uses an
  independent secret. Unsigned product lookups remain refused.
- Static assets use generated `_headers` without running the Worker. HTML/API
  paths still run it for canonical redirects, framing and dynamic headers.
  Script CSP uses hashes, not `unsafe-inline`; existing audit hardening retained.
- Awin's unused twice-daily job is now manual-only. Repository secret scanning
  and push protection were enabled and confirmed through GitHub.
- Daily Actions finder check exercises three fixed synthetic cases through the
  real ideas API and shared photo/no-photo selector, plus homepage and readiness.
  Failures open/comment on an issue assigned to CallumStarr. The check bypasses
  Turnstile only for those three fixed inputs, via a constant-time-compared
  `X-Finder-Monitor` token (wrong token 401, any other input 400). Since 7
  November it also fails when a case falls back to the catalogue, so a broken
  Anthropic key or model is caught. It does not exercise real Turnstile,
  browser rendering, native apps or devices, and alerts only via GitHub.
- Unapproved app builds strip Amazon affiliate tags from runtime configuration
  and bundled guides. Set `AMAZON_MOBILE_APPROVED=true` only after Amazon approves
  every mobile app being released; keep website approval separate.

## Remaining launch gates and operator actions

Step-by-step click paths for items 1, 2 and 4-8 are in
[operator-actions.md](operator-actions.md).

1. **Cloudflare Workers Paid:** dashboard needs an interactive login; the
   available OAuth token cannot read billing subscriptions. Upgrade/confirm the
   paid plan in the dashboard. Local tests do not establish production CPU
   allowance; warm catalogue fallback is now under 10 ms but a cold isolate is
   not. The AI cap stays at 500/day until a monthly spend limit and
   expected traffic are agreed; do not silently expand the spending envelope.
2. **Search engines:** Google Search Console and Bing Webmaster Tools could not
   be opened in this environment. Verify domain ownership and submit
   `https://christmasidea.co.uk/sitemap.xml`, then request indexing for `/`,
   `/gifts/` and each guide. Generated sitemap now includes Terms.
3. **ICO reference:** the user confirms company registration on 6 November, but
   the number was not supplied. A public register search for "NOAH NEUROTECH"
   on 7 November returned no entries; the ICO says new entries can take two
   working days. Add the reference from the confirmation email to Privacy;
   never invent one.
4. **Scheduled monitoring (active):** the first scheduled run (7 November,
   07:21 UTC) passed with eight AI ideas per case. Make sure GitHub
   notifications for failed workflows and new issues reach your phone;
   failures open an issue assigned to you.
5. **Account ownership and approvals:** move/confirm Amazon, EPN/developer,
   Awin, Cloudflare, Anthropic, domain and app-store accounts under the company.
   Confirm campaign clicks in EPN and Amazon the next day; do not create
   qualifying purchases through friends, family or personal orders.
6. Rotate the previously exposed Anthropic key in the provider console, revoke
   the old key and set a monthly spend limit. Worker secrets cannot reveal or
   rotate the provider's source credential. Review any Actions Cloudflare token
   for D1-only scope; no Cloudflare token is currently listed in Actions secrets.
7. Add a zone `/api/` edge rate-limit rule (suggested: 40 requests per
   10 seconds per IP, Block) and an independent uptime service with phone
   alerts. These need dashboard/provider access. HSTS `includeSubDomains` is
   now done (see the 7 November record below).
8. Confirm support email delivery/monitoring and one-month rights handling.
   Have an adviser review the notice, audience assessment and Terms; have the
   accountant confirm overseas commissions, tax/VAT and expenses. Add a suitable
   SIC activity at the next confirmation statement. Check the UK IPO name
   register (classes 35, 42, 9).

## Before Black Friday and later releases

- Real-person research (10-15 shoppers), multi-rater gift-quality review and
  NVDA/VoiceOver/TalkBack scenarios remain human tasks. Retest Escape on a
  physical keyboard, actual 200%/400% browser zoom, text spacing and full-palette
  contrast. Automated checks do not prove WCAG conformance.
- Publish useful original guides for teenagers, grandparents, colleagues,
  Secret Santa at GBP 20, partners and hard-to-buy-for recipients after editorial
  review. Drafts are in the pull request "Draft: six new gift guides for
  review" (not merged, not deployed). Do not auto-publish unreviewed content
  or invent product comparisons.
  The existing 13 guides now have clearer attribution and buying checks.
- Use permitted communities and a launch post; don't request affiliate purchases.
- No eBay photo relevance review is required while eBay content is disabled.
  Reassess toy seller provenance and request a growth limit before re-enabling.
- Website first. Apps remain a separate release: company accounts/D-U-N-S,
  Amazon app approval, store privacy/data-safety declarations, tester/review
  requirements, Apple minimum-functionality review, native builds and signing.
  Existing installed apps do not update when the website deploys.
- Decide repository visibility explicitly. It remains public; making it private
  cannot retract existing clones/forks. No historical personal details were
  reproduced or rewritten as part of this task.

## Release and launch-day checks

Record the current Worker version before deploy; keep the prior version for
rollback. Never describe a code change as deployed without checking the live
version. Rolling back code does not restore Durable Object or D1 data.

1. Build pages/CSP; run tests; dry-run deploy; build/sync both native projects.
2. Configure independent `RECEIPT_SIGNING_KEY` and `FINDER_MONITOR_TOKEN` Worker
   secrets. Use the same monitor token in Actions; never store it in source.
3. Deploy, check homepage and `/api/ready` are 200; verify static and HTML
   security headers and the `www` HTML redirect.
4. Run describe, guided and child synthetic searches: eight usable ideas,
   visible Ad wording and working tagged searches. No listing photos is now
   an intentional compliance fallback, not an empty-results error.
5. Confirm unsigned `/api/products` and `/api/feedback` requests return 400.
6. Confirm company/footer/privacy/terms content on the live site.
7. Next day confirm affiliate reporting. Review Worker logs daily for the first
   week; catalogue-only local load tests do not prove paid production capacity.

### Validation record

Deployed version: `a2bd0f62-2b83-4f22-9079-a334007d340c`.
All 613 tests pass; both benchmark replays, app sync and deploy dry-run passed.
Three live AI searches each returned eight usable ideas. Live legal pages,
readiness, security headers, canonical HTML redirect and unsigned request
refusals passed. Native verification framing was checked after the static-header
compatibility correction. No native binary was released.
See PROJECT_STATUS.md for the release record. Local load evidence:
50 simultaneous real catalogue API requests returned eight ideas each; the
real SQLite Durable Object was exercised separately at 10/50/100 concurrent
requests with exact global/per-visitor limits. This is not a production
capacity or CPU-quota certification.

### Independent verification (7 November 2026)

Checked against the repository, Cloudflare and the live site rather than the
release summary.

- Repository at `d708f01` (contains `eaf4d3e`); full suite passed before the
  follow-up fixes below. Cloudflare active version, feature flags
  (all provider discovery off, `DAILY_AI_LIMIT=500`, Turnstile required),
  secret bindings and the `run_worker_first` allowlist match `wrangler.toml`.
- Live: homepage, `/api/ready`, static assets, sitemap (18 URLs) and robots
  return 200; `www` 301s to the canonical host; script CSP uses hashes only;
  pages send `X-Frame-Options: DENY` except `/app-verify` (app origins only).
  Unsigned `/api/products` and `/api/feedback` return 400; `/api/ideas`
  without Turnstile 403; a wrong monitor token 401.
- All 18 sitemap pages show company name, number, England and Wales,
  registered office, support email, definite Ad wording and both programme
  statements. All 13 guides have `Ad ·` titles; all 208 guide shop links are
  `sponsored` and carry `tag=mcstarrstud0c-21` or `campid=5339240592`.
- Companies House: NOAH NEUROTECH LTD, 17215758, active, registered office
  1 Tryelyn, Bodmin, England, PL31 1GD, incorporated 12 May 2026, SIC 26600
  and 72190 only (add a web/information activity at the next confirmation
  statement). England and Wales is consistent with the record; the
  incorporation PDF itself was not machine-read.
- Real browser describe search passed Turnstile and returned eight AI ideas
  with the AI notice, no-photo fallback notice, Ad wording and tagged links.
  Automated Escape did not close even a control native dialog, so the
  Escape result is inconclusive; a physical keyboard test is still required.
- Follow-up fixes: About no longer says eBay links are ordinary searches
  (campaign tracking is live); latent provider disclosures now use definite
  wording and the exact Amazon/eBay statements, guarded by a test; the
  monitor fails on catalogue fallback. 614 tests pass.

### Monitor, accessibility, CPU and HSTS release (7 November 2026)

Deployed version `80c0e211-4b8a-4609-a778-6765b35543e5` from `66a211a`;
live before deploy `4528dd31` (rollback target). Details are in
PROJECT_STATUS.md.

- **Pre-deploy:** 616 tests passed; `npm run build:pages` left no diff;
  `npm run app:sync` was clean; `npx wrangler deploy --dry-run` passed with
  Amazon, eBay and Awin discovery still false.
- **Finder monitor:** monitored requests skip the idea cache and knowledge
  reuse, and `check-finder.mjs` fails on cached or non-AI results (tests in
  `test/launch-readiness.test.js`). Workflow runs 42361735711 and 42361885536,
  started back to back after deploy, both passed with three AI cases.
  `check-finder.mjs` was not run from the laptop because the monitor token
  exists only as a GitHub secret.
- **Accessibility:** axe-core 4.14, run from a temporary folder outside the
  repository with tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and
  best-practice. `/`, `/about`, `/privacy`, `/terms`, `/gifts/`,
  `/gifts/gifts-for-dad` and `/404`, at 1280 px and 375 px, had 0 violations
  locally and live. There was no horizontal scroll at 375 px. The
  Wishlists buttons are named from their visible text (for example "Wishlists
  0 saved ideas").
- **CPU:** `node scripts/benchmark-fallback.mjs` (50 v3.4 cases, warm,
  laptop): before, median 43 ms, p90 73 ms, max 98 ms; after, median about
  4.5 ms, p90 about 6.2 ms, max 9-13 ms. The first call in a fresh isolate is
  about 85-90 ms. `test/catalogue-snapshot.test.js` proves the output is
  identical.
- **HSTS includeSubDomains (no preload):**
  - The Wrangler token could not list DNS records (403).
  - The user supplied the zone list: NS, three MX, apex SPF TXT, DKIM
    `cf2024-1._domainkey` TXT and `_dmarc` TXT. There are no A, AAAA or CNAME
    records; the apex and `www` are Worker custom domains.
  - Checked: the apex returns 200 and `www` 301, both with valid certificates.
    A random subdomain does not resolve. The DKIM and DMARC names hold only
    TXT records, so they serve no web traffic.
  - The user approved the change. Live pages and static files now send
    `max-age=31536000; includeSubDomains`.
  - Any new web hostname added to the zone must serve HTTPS before use.
- **Live checks:** `/`, `/about`, `/privacy`, `/terms`, `/gifts/` and
  `/gifts/gifts-for-dad` returned 200 with company details and no "may earn".
  Unsigned products and feedback requests returned 400, ideas without
  Turnstile 403, and a wrong monitor token 401. `www` redirected 301 to the
  main domain, `/api/ready` returned 200, and security headers were present on
  pages, CSS, JS, images and the favicon.
- **Not done here:** the ICO reference (not supplied), and the human-only
  items: NVDA, VoiceOver and TalkBack testing; Escape-key and 200%/400% zoom
  checks on a real keyboard and browser; full-palette contrast; real-user
  testing with 10-15 shoppers; the repository visibility decision; and the
  separate app release. Installed apps need a native rebuild to pick up the
  label change.
