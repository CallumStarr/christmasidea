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

1. **Cloudflare Workers Paid:** dashboard needs an interactive login; the
   available OAuth token cannot read billing subscriptions. Upgrade/confirm the
   paid plan in the dashboard. Local tests do not establish production CPU
   allowance. The AI cap stays at 500/day until a monthly spend limit and
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
7. Add a zone `/api/` edge rate-limit rule and an independent uptime service
   with phone alerts. These need dashboard/provider access. Only add
   `includeSubDomains` to HSTS after confirming HTTPS for every subdomain.
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
  review. Do not auto-publish unreviewed content or invent product comparisons.
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
