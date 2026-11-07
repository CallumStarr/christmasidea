# Operator actions (human-only)

These steps need dashboard logins, payments or legal decisions, so they were
not done by an agent. Each section says what to click, what to enter and how
to confirm it worked. Dashboard menus move around; if a label differs, use the
dashboard search box with the words in **bold**.

Facts used below (checked in this repository or by the user):

- Domain: `christmasidea.co.uk` (Cloudflare zone, plan "Free Website").
  `www` and the apex are Worker custom domains. Existing DNS records: NS,
  3 MX, apex SPF TXT, DKIM `cf2024-1._domainkey`, `_dmarc`.
- Worker: `christmasidea`. Cloudflare account ID (from the dashboard URL):
  `83b864d51029862c2657fd05a7877ea6`.
- Company: NOAH Neurotech Ltd, company number 17215758.
- Amazon tag `mcstarrstud0c-21`; eBay campaign `5339240592`; Awin publisher
  `3146453`.
- `DAILY_AI_LIMIT = "500"` in `wrangler.toml`.
- Finder monitor: `.github/workflows/finder-monitor.yml` ("Live gift finder
  monitor"), daily at 07:17 UTC and runnable by hand.

## a. Upgrade Cloudflare to Workers Paid (USD 5 a month)

Why: the Free plan allows 10 ms CPU per request. Warm catalogue fallback is now
about 4.5 ms median, but the first request in a new isolate still takes about
85-90 ms on a laptop, and an AI search does more work than that.

1. Sign in at https://dash.cloudflare.com and choose the account that owns
   `christmasidea.co.uk`.
2. In the left menu open **Compute (Workers)** (older dashboards: **Workers &
   Pages**), then **Plans** (or **Workers plans**).
3. Under **Workers Paid**, click **Purchase Workers Paid** (or **Upgrade**).
4. Check the billing details. Use the company's billing details if the account
   has already moved to the company (section f). Confirm the purchase.
5. Confirm it worked:
   - **Compute (Workers) > Plans** shows Workers Paid as the current plan.
   - **Manage account > Billing > Subscriptions** lists Workers Paid.
   - Open **Workers & Pages > christmasidea > Settings** and check that the CPU
     limit options are now available. Leave them at the default.
6. Nothing in the code needs to change. Do not raise `DAILY_AI_LIMIT` as part
   of this step (see section e).

## b. Google Search Console and Bing Webmaster Tools

### Google: verify the Domain property

1. Go to https://search.google.com/search-console and sign in with the Google
   account that should own the property (ideally a company account).
2. Click the property menu (top left), then **Add property**, then **Domain**.
3. Enter `christmasidea.co.uk` (no `https://`, no `www`) and click
   **Continue**.
4. Google shows a TXT value like `google-site-verification=...`. Copy it
   exactly.
5. In another tab, open https://dash.cloudflare.com, then
   **christmasidea.co.uk > DNS > Records > Add record**:
   - Type: `TXT`
   - Name: `@`
   - Content: the full `google-site-verification=...` value
   - TTL: `Auto`
   - Click **Save**.
   This is a new, separate TXT record. Do not edit or merge it into the
   existing SPF TXT record (`v=spf1 ...`), or email may break.
6. Back in Search Console, click **Verify**. If it fails, wait 10 minutes and
   try again. Keep the TXT record afterwards: removing it unverifies the
   property.

### Google: submit the sitemap

1. In the new property, open **Indexing > Sitemaps**.
2. Under **Add a new sitemap**, enter `https://christmasidea.co.uk/sitemap.xml`
   (the box may only need `sitemap.xml`) and click **Submit**.
3. Confirm: the status shows **Success** and about 18 discovered pages.

### Google: request indexing

For each URL below: paste it into the **URL inspection** bar at the top, wait
for the result, then click **Request indexing**. Google limits how many
requests you can make each day; if you hit the limit, carry on the next day.

- https://christmasidea.co.uk/
- https://christmasidea.co.uk/gifts/
- https://christmasidea.co.uk/gifts/gifts-for-4-year-olds
- https://christmasidea.co.uk/gifts/gifts-for-new-babies
- https://christmasidea.co.uk/gifts/gifts-for-space-lovers
- https://christmasidea.co.uk/gifts/gifts-for-gardeners
- https://christmasidea.co.uk/gifts/gifts-for-history-lovers
- https://christmasidea.co.uk/gifts/gifts-for-tea-and-coffee-lovers
- https://christmasidea.co.uk/gifts/gifts-for-mum
- https://christmasidea.co.uk/gifts/gifts-for-dad
- https://christmasidea.co.uk/gifts/secret-santa-gifts-under-10
- https://christmasidea.co.uk/gifts/gifts-for-book-lovers
- https://christmasidea.co.uk/gifts/gifts-for-coffee-lovers-under-30
- https://christmasidea.co.uk/gifts/gifts-for-gardeners-under-30
- https://christmasidea.co.uk/gifts/gifts-for-personalised-gifts-under-30

If the six draft guides are approved and deployed later, request indexing for
those URLs too.

### Bing Webmaster Tools

1. Go to https://www.bing.com/webmasters and sign in (a Microsoft, Google or
   Facebook account).
2. Choose **Import your sites from GSC**, then **Continue**, and allow access to
   the same Google account.
3. Tick `christmasidea.co.uk` and click **Import**. Bing verifies the site and
   imports the sitemap.
4. Confirm: **Sitemaps** lists `https://christmasidea.co.uk/sitemap.xml`. If it
   is not there, click **Submit sitemap** and enter it.
5. Optional: **URL Submission** lets you submit `/`, `/gifts/` and the guide
   URLs above.

## c. Cloudflare rate limiting rule on /api/

Free zone plan limits (Cloudflare documentation, checked during this task):
1 rule, expression can use **URI Path** (and Verified Bot), counted per IP,
10-second period, 10-second block, action **Block**.

How the app uses the API, per visitor:

- One search sends 1 `/api/ideas` request, 4 `/api/products` requests (8 ideas
  in pairs) and up to 2 more for replacement ideas: about 7 requests in a few
  seconds.
- Feedback (wishlist and swipe signals) adds a few `/api/feedback` requests.
- The Worker already enforces its own limits: `PER_VISITOR_MINUTE_LIMIT=4`
  idea searches, 64 product searches and 40 feedback requests per visitor per
  minute.

Suggested threshold: **40 requests per 10 seconds per IP**. A real visitor doing
two fast searches plus swipes sends roughly 15-20 requests in 10 seconds, so 40
leaves room for families, offices and mobile networks that share one IP. It
still stops scripted floods long before they reach the Worker's own limits.
The edge rule is a backstop; the per-visitor limits in the Worker remain the
main control.

Steps:

1. https://dash.cloudflare.com > **christmasidea.co.uk > Security > Security
   rules** (older dashboards: **Security > WAF > Rate limiting rules**).
2. Click **Create rule > Rate limiting rule**.
3. Rule name: `API burst limit`.
4. **If incoming requests match**: Field **URI Path**, Operator
   **starts with**, Value `/api/`. If "starts with" is not offered, use
   **contains** with `/api/`, or the expression editor:
   `starts_with(http.request.uri.path, "/api/")`.
5. **With the same characteristics**: IP (fixed on Free).
6. **When rate exceeds**: Requests `40`, Period `10 seconds`.
7. **Then take action**: **Block**. Duration: `10 seconds`.
8. Click **Deploy**.
9. Confirm:
   - The rule shows as enabled in the list.
   - Load https://christmasidea.co.uk/ and run one search. It should work
     normally.
   - Over the next week, check **Security > Analytics** (or **Events**) for
     blocks from this rule. If real visitors are blocked, raise the threshold.
   - The scheduled finder monitor (3 searches a day) and uptime checks are far
     below the limit.

## d. Uptime monitoring and phone alerts

### External uptime monitor

Use any external monitor with a phone app or SMS alerts (for example
UptimeRobot, Better Stack or Healthchecks-style services). Check the provider's
current free-plan terms yourself; no plan was chosen or paid for here.

1. Create an account and install the provider's phone app. Allow push
   notifications.
2. Add monitor 1:
   - Type: HTTP(S)
   - URL: `https://christmasidea.co.uk/`
   - Interval: 5 minutes (or the shortest free interval)
   - Expected: status 200. If keyword checks are available, require the text
     `Santa's Helper`.
3. Add monitor 2:
   - Type: HTTP(S)
   - URL: `https://christmasidea.co.uk/api/ready`
   - Interval: 5 minutes
   - Expected: status 200.
4. Alert contacts: add the phone app (push), and SMS or email as a backup.
   Attach both monitors to these contacts.
5. Confirm: both monitors show **Up**. Use the provider's **Test notification**
   button and check that it reaches the phone.

Do not point the monitor at `/api/ideas`: that uses AI budget and needs
Turnstile. The daily GitHub finder monitor already covers the AI path.

### GitHub notifications on the phone

1. Install **GitHub Mobile** and sign in as `CallumStarr`. Allow notifications
   on the phone.
2. On github.com: profile picture > **Settings > Notifications**.
   - **Subscriptions > Watching**: tick **On GitHub** (and **Email** if wanted).
   - **Subscriptions > Participating, @mentions and custom**: tick
     **On GitHub** and **Email**.
   - **System > Actions**: tick **Notify me for failed workflows only** and
     choose **On GitHub** and **Email**.
3. In GitHub Mobile: profile > **Settings > Notification settings** (or
   **Configure notifications**) and turn on push for **Assigned**,
   **Participating** and **Watching** (or all types offered).
4. Open https://github.com/CallumStarr/christmasidea, click **Watch >
   Custom**, tick **Issues** (and **Pull requests** if wanted), then
   **Apply**.
5. Confirm: the finder monitor opens an issue assigned to you when it fails.
   To test without breaking the site, create a test issue in the repository
   and assign it to yourself. Check that the phone gets a push notification,
   then close the issue.

## e. Anthropic key rotation, spend limit and DAILY_AI_LIMIT

### Rotate the API key

Run these steps in one sitting, so the old key does not stay active for long.

1. Sign in at https://console.anthropic.com. Choose the organisation the site
   uses.
2. Open **Settings > API keys** and click **Create key**. Name it, for example,
   `christmasidea-worker-2026-11`, and copy it. It is only shown once.
3. In a terminal in the repository folder:

   ```powershell
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

   Paste the new key when prompted and press Enter. Never paste it into a file,
   commit or chat.
4. Check that the new key works before revoking the old one:

   ```powershell
   gh workflow run finder-monitor.yml --repo CallumStarr/christmasidea
   gh run watch --repo CallumStarr/christmasidea
   ```

   The run must succeed with all three cases marked `(ai)`. The monitor skips
   the idea cache, so a broken key fails the run.
5. Back in **Settings > API keys**, find the old key. Click its menu (`...`)
   and choose **Disable**, or **Delete** to revoke it. Delete any other keys
   you do not recognise.
6. Run the workflow from step 4 once more and confirm it still passes.

### Monthly spend limit

1. In the Anthropic Console open **Settings > Limits** (in some versions it is
   under **Billing**).
2. Under **Spend limits**, click **Change limit**. Set a monthly amount you are
   comfortable losing in a worst case, then **Save**.
3. Optional: under the same page, set an email notification at a lower amount,
   for example half the limit.
4. Confirm: the Limits page shows the new monthly limit. When the limit is
   reached, the API refuses calls and the site falls back to catalogue ideas.
   The finder monitor will then fail, which is the alert you want.

### DAILY_AI_LIMIT decision (no change made)

Current value: `DAILY_AI_LIMIT = "500"` in `wrangler.toml`. At roughly USD 0.002
a search, that is at most about USD 1 a day, or about USD 30 a month. After the
daily cap, visitors get catalogue ideas instead of AI ideas. The finder monitor
uses 3 of these calls each day.

| Option | Daily cap | Approx. worst case | Trade-off |
| --- | --- | --- | --- |
| Keep | 500 | USD 1/day, USD 30/month | Safe default; busy days fall back to catalogue ideas |
| Lower | 200 | USD 0.40/day | Cheapest; more visitors get catalogue ideas |
| Black Friday only | 1000-1500 | USD 2-3/day | More AI ideas at peak; lower it again in January |
| Higher | 2500+ | USD 5+/day | Only with a monthly spend limit set and real traffic data |

Whatever you choose, set the Anthropic monthly spend limit above the cap times
30. To change the value: edit `DAILY_AI_LIMIT` in `wrangler.toml`, run the
pre-deploy checks in `AGENTS.md`, then deploy. The estimate per search is an
approximation from earlier runs; check actual cost in the Anthropic Console
**Usage** page after the first busy week.

## f. Move accounts into NOAH Neurotech Ltd's name

General rule: update the legal name, address, company number, tax status and
payee bank account to the company's. Some programmes do not allow an
individual account to change into a company account. If the settings page has
no option to change the account holder, contact the programme's support before
opening a new account, because a new account can need new approval and new
tracking IDs. Ask your accountant which date commissions should move to the
company and whether the company is or should be VAT registered.

| Account | Where to change it | Tax and payee details to update |
| --- | --- | --- |
| Amazon Associates (UK) | https://affiliate-program.amazon.co.uk > **Account settings** (top right) > **Edit account information** and **Edit payment information** | Rerun the **Tax interview** as a company. Change the payee name and bank account to the company. If Amazon will not change the account holder, ask Associates support. Keep tag `mcstarrstud0c-21` if possible, because the site and guides use it. |
| eBay Partner Network | https://partnernetwork.ebay.com > **Account > Account information**, **Payment** and **Tax information** | Company name, address, company number and VAT status. Payee bank account. Campaign `5339240592` is used in the site and guides. |
| eBay developer keys | https://developer.ebay.com > **My Account** | Change the account details to the company, or create a company developer account. Keys from a new account must go in with `npx wrangler secret put` and are only needed if eBay discovery is turned back on (it is off). |
| Awin (publisher `3146453`) | https://ui.awin.com > **Account > Account details / Company details** and **Payment details** | Company name, address, company number, VAT status and bank account. |
| Cloudflare | https://dash.cloudflare.com > **Manage account > Members**: invite a company email address as **Super Administrator**. **Manage account > Billing > Billing profile** | Company name, address and VAT number (if any) on the billing profile and card. |
| Anthropic | https://console.anthropic.com > **Settings > Organization**, then **Billing** | Organisation name, billing address and VAT or tax ID; payment card on a company account. Invite a company email as admin. |
| Domain `christmasidea.co.uk` | At the registrar (check where it is registered; if it is Cloudflare Registrar: **Domain Registration > Manage domains > christmasidea.co.uk > Contacts**) | Change the registrant to NOAH Neurotech Ltd. For `.co.uk`, Nominet treats a change of legal registrant as a registrant transfer; follow the registrar's process and keep auto-renew on. |
| Apple App Store (future) | https://developer.apple.com/programs/enroll as an **Organization** | Needs the company D-U-N-S number and a company website. Fill in **Agreements, Tax, and Banking** in App Store Connect with company details. |
| Google Play (future) | https://play.google.com/console, create an **Organization** account | Needs the D-U-N-S number. Fill in the payments profile with company details. |

After each change, confirm next day that clicks and commissions still record
(Amazon and EPN reports). Do not make purchases yourself, or ask friends or
family to, to test tracking.

## g. Website SIC code at the first confirmation statement

Companies House currently lists SIC 26600 and 72190 only. The first
confirmation statement is due by **25 May 2027**.

1. Go to https://find-and-update.company-information.service.gov.uk, search
   for `17215758`, and click **File for this company** (sign in with GOV.UK
   One Login, then enter the company authentication code if asked).
2. Choose **Confirmation statement**.
3. At the **SIC codes** step, choose **Change**, and add a code that describes
   the website. Candidates to confirm with the accountant:
   - `63120` Web portals
   - `73110` Advertising agencies (affiliate advertising)
   Keep or remove the existing codes to match what the company actually does.
4. Complete the other steps (registered office, officers, shareholders, people
   with significant control), pay the fee shown and submit.
5. Confirm: after acceptance, the company's Companies House page shows the new
   SIC code under **Nature of business**.

## h. UK IPO trade mark search for "Santa's Helper"

1. Go to https://trademarks.ipo.gov.uk/ipo-tmtext (GOV.UK: "Search for a trade
   mark").
2. Search by **Trade mark text** for each of: `SANTA'S HELPER`,
   `SANTAS HELPER`, `SANTA HELPER`, `SANTA'S LITTLE HELPER`.
3. Filter by **Classes** `9`, `35` and `42`, and **Status** live (registered
   and pending). Also search "similar" matches if the option is offered.
4. For each hit, note the mark, number, owner, classes and status. Save the
   results page as a PDF.
5. Also search the EUIPO/WIPO databases (https://www.tmdn.org/tmview) for
   international registrations that cover the UK.
6. If anything close turns up in these classes, get advice from a trade mark
   attorney before filing or spending more on the brand. A search is not
   legal clearance.

## Also outstanding

- **ICO registration reference:** not supplied. When you have it from the ICO
  confirmation email, add "ICO registration reference: <ref>" to the
  controller section of Privacy (source in `scripts/build-site-pages.mjs`),
  rebuild with `npm run build:pages` and deploy. Never use a guessed number.
- Human accessibility checks, real-user testing, the repository visibility
  decision and the separate app release: see `docs/launch-readiness.md`.
