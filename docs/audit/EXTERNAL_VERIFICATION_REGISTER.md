# External verification and operator actions

Assessment date: 6 November 2026. A repository setting is not an independent
attestation of the deployed value, provider approval, contract, account
access or live behavior. The observations below are read-only; no account
setting, integration, secret, release or production data was changed.

## External controls

| Control / owner | Classification | Evidence actually available | Required independent evidence |
|---|---|---|---|
| Cloudflare account, domains, routes, WAF and bindings — **operator/SRE** | Not verified | [Wrangler configuration](../../wrangler.toml) describes routes, Worker assets, D1, cron and a Durable Object. | Compare actual deployed version, routes, DNS, WAF/rate limits, bindings, plan, logs and permissions in the account. |
| Production secret presence, strength, scope, recovery and rotation — **operator/security** | Blocked | Code checks selected secret presence/length; no production secret values or account inventories were read. | Privately verify bindings, generation, least privilege and recovery; never place values in reports or logs. |
| Domain response headers — **security/operator** | Partially verified | A read-only HEAD to `https://christmasidea.co.uk/` returned 200 with HSTS `max-age=31536000`, CSP, permissions, referrer, nosniff and `X-Frame-Options: DENY`; `www` returned 301 to the canonical host. On 7 November 2026, read-only GETs found the same headers on `/`, `/api/health` (body `{"ok":true}`) and 404 responses, and 404 for `/.git/HEAD`, `/.git/config`, `/.env`, `/wrangler.toml` and `/package.json`. HTML was served as `text/html` **without a charset** (fixed locally, not deployed). | Assess every relevant endpoint, response/error, cache and subdomain over time. The observed CSP permits inline scripts/styles and HSTS lacks `includeSubDomains`; neither observation establishes exploitability. |
| Turnstile account, allowed hosts, secret and enforcement — **operator/security** | Blocked | Source requires the challenge in configured production mode and validates hostname/action; browser and native widget paths have local fixtures. | Privately verify actual widget/site/secret bindings and allowed hosts, then run an approved staging challenge and failure/recovery test. |
| Anthropic model, limits, billing, data terms and availability — **operator/AI owner** | Blocked | Source sets a model and request/output caps; no paid or live model request was made. | Check account limits, budget alerts, retention/processing terms, model availability and approved paid evaluation separately. |
| Amazon Associates and Creators API — **commercial owner** | Blocked | Partner-tag settings exist; Amazon product discovery is disabled in repository Worker configuration. | Confirm each account's eligibility, API permissions, territory, display/image rights, attribution and current contractual conditions before any activation. |
| eBay Browse and Partner Network — **commercial owner** | Blocked | Repository has a Worker campaign and empty public campaign; synthetic tests demonstrate their interaction below. | Verify actual application credentials, programme/campaign authorization, territory, attribution and listing/image terms without changing account settings. |
| Awin, CJ and Skimlinks merchant approvals — **commercial owner** | Blocked | Awin product discovery is disabled, but the public affiliate configuration contains a **separate** Virginia Hayward Awin merchant marked `approved: true`; other merchant/network settings vary. Repository booleans are claims, not account evidence. | Check current joined status, IDs, feed/image/content permissions, countries, commission and disclosure requirements per merchant and network. Do not equate disabled product discovery with all affiliate links being disabled. |
| Advertiser/merchant agreements — **commercial/legal owner** | Blocked | Routing, disclosure and some configured commercial terms exist in source. | Obtain current executed agreements and verify licence scope, presentation, disclosure, expiry, prohibited use and payout terms. |
| D1 and Durable Object backups — **operator/SRE** | Blocked | A synthetic local selective D1 restore and object restart were exercised; remote backup and recovery were not. | Verify account/database capabilities, retention, recovery permissions, backup integrity, object-state strategy and staging restore as described in [recovery validation](DISASTER_RECOVERY_VALIDATION.md). |
| GitHub protection for `main` — **repository administrator** | Verified, for the observed API response | On 6 November 2026 the classic branch-protection endpoint returned HTTP 404 with `Branch not protected`; repository rulesets and effective branch rules returned empty arrays. | Set and verify an enforceable policy; recheck inherited rules, bypasses and billing/permissions after configuration. No policy was changed during this audit. |
| GitHub Actions secrets, deployment permissions and scheduled jobs — **repository administrator** | Not verified | Workflow definitions are visible, including an Awin job that can migrate/write remote D1 and a conditional feedback notification job. | Privately verify secret/environment scope, permissions, schedules, alerts, provenance and whether workflows are actually enabled. |
| App Store and Google Play release/security/privacy compliance — **mobile/release owner** | Blocked | Android debug build/manifest inspected; iOS source inspected, but no signed release or store console was accessed. | Build/sign independently, inspect release artifacts and privacy manifests, verify data-safety declarations, store review policies and device behavior. |
| Third-party privacy agreements and UK legal scope — **privacy/legal owner** | Blocked | Privacy notices and code-level data flows exist; they do not prove actual processor terms, legal basis, consent, data-subject handling or children's-service scope. | Review signed processor/data-transfer agreements, current vendor practices, retention, PECR, UK GDPR and applicable children's/online-safety obligations with qualified advice. |
| Monitoring, SLOs, traffic, commercial conversion and support — **operator/product owner** | Not verified | Source observability settings and isolated tests exist. No production percentiles, conversion records, alert drills or support SLAs were independently reviewed. | Collect appropriately minimized real operational evidence, review costs, alerts, incident response and performance without disclosing user data. |

## Operator action SH-012: protect `main`

Recommended repository ruleset, subject to the repository's available GitHub
plan and a repository administrator's decision:

1. Target `main`, enforce for administrators, require a pull request, require
   the branch to be up to date, prohibit branch deletion and force pushes.
2. Require the exact Actions job/check **`test-and-replay`**, observed from the
   `github-actions` app. Select the app/source explicitly where GitHub
   supports it and avoid duplicate job names that could satisfy a required
   check ambiguously. The local
   [quality workflow](../../.github/workflows/quality.yml) runs it on push and
   pull request; ensure the reviewed version is present and produces the check
   before enforcing the rule.
3. If an independent maintainer is available, require one non-author approval
   and dismiss stale approvals after relevant changes. For a genuinely
   single-maintainer project, one-other-person approval would block normal
   work: a documented temporary **zero-reviewer** rule with required CI,
   deliberate self-review and a plan for independent review is more practical
   than an unworkable rule or routine bypass.
4. Allow at most a narrowly scoped, logged break-glass bypass for an authorized
   administrator; document incident justification and review each bypass.
   Avoid broad routine app/user bypasses.
5. Do **not** make scheduled-only
   [Awin refresh](../../.github/workflows/awin-catalogue.yml) or
   [feedback notification](../../.github/workflows/feedback-review.yml)
   jobs required PR checks: they do not run on normal pull requests. After
   configuring the ruleset, open a disposable PR and confirm failed/missing
   checks block merging and successful checks permit it.

This is a recommendation, not a claim that the policy is configured.

## Operator action SH-021: eBay campaign mismatch and user impact

The local [Worker configuration](../../wrangler.toml) sets
`EBAY_CAMPAIGN_ID = "5339240592"` and enables eBay product discovery and
photo-first selection. The public homepage's
[`GIFT_CONFIG`](../../site/index.html) sets `EBAY_CAMPAIGN_ID` to the empty
string. The Worker accepts the older `EBAY_CAMPAIGNID` spelling as a fallback;
the public client validator uses the `EBAY_CAMPAIGN_ID` setting.

The original review correctly identified attribution divergence but
**understated functional impact**. The Worker can normalize a tracked offer;
the browser's [validator](../../site/merchant-links.js) deliberately rejects
tracked URLs when its public campaign is empty. The
[photo selector](../../site/product-selection.js) then discards that offer
before loading its image. If every suitable offer is rejected and photo-first
is active, the finder can display no ideas even though the Worker produced
ideas and valid tracked eBay offers. The synthetic regression in
[`test/ebay.test.js`](../../test/ebay.test.js) demonstrates rejection with an
empty public campaign and acceptance with a matching synthetic campaign.
Actual deployed settings and production incidence have **not** been verified.
Treat this as a release-blocking configuration decision, not just a
commission-reporting discrepancy.

The **eBay account's authorized campaign and intended product/attribution
scope** are authoritative for whether tracking may be used. The Worker
setting controls API offer shape; the public setting controls both fallback
links and acceptance of those offers. Account access was unavailable, so
choosing either value as commercially authoritative would be speculation.
The operator must first decide:

- If the existing campaign is authorized and public tracking is intended,
  approve a reviewed change aligning both settings and disclosures; or
- If it is not authorized/intended, approve a reviewed change that removes
  Worker tracking and verifies ordinary untracked offers and fallback links.

Do not loosen client URL validation, invent an account identifier or enable
tracking merely to remove the mismatch. [`test/ebay-config-alignment.test.js`](../../test/ebay-config-alignment.test.js)
reads the committed values and is marked `todo`; once the settings agree,
remove the `todo` option so the suite enforces alignment. In either case, run the synthetic
regression, check that API offers and public configuration agree, verify
disclosures, then use an authorized staging/sandbox flow with approved test
data and no purchase. Review actual attribution only with the account owner.
No option or account change was performed in this audit.
