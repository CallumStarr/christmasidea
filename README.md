# Santa's Helper - christmasidea.co.uk

One Cloudflare Worker that serves the website and its small API:

- `site/` - the gift finder, editorial guides and legal pages, with self-hosted fonts and original illustrations.
- `src/` - the Worker: AI gift ideas from Claude, optional verified-product discovery through retailer providers, product matching, limits that cap usage, and a redirect from www to the main domain.
- `wrangler.toml` - settings, already pointed at christmasidea.co.uk and www.christmasidea.co.uk.

If the AI is unavailable or its daily cap is reached, the Worker selects from `src/catalogue.js` and runs the candidates through the same recipient-aware validator as AI ideas. It uses stated age, explicit exclusions, owned items and budget bands, and returns fewer than eight when that is all that survives. The catalogue has only coarse price bands (not verified product prices), so a strict budget below £10 may have no verified fallback idea. Product discovery is optional; when unavailable or disabled, the site shows typographic idea cards without pretend product photographs and keeps the Amazon search link.

## Cross-platform updates

Website, iOS and Android changes are cross-platform by default. [AGENTS.md](AGENTS.md) records the project-wide instructions for future development: implement applicable changes on all three unless explicitly scoped otherwise, and ask for confirmation before making a new platform-specific exception.

| Change | How it reaches users |
|---|---|
| Shared server-side recommendation engine, validation or product matching | Deploy the Worker; all platforms use the same production APIs on subsequent requests. Existing caches and in-flight requests may retain earlier results, so assess cache invalidation/versioning when changing recommendation behaviour. |
| Website/frontend logic, styling, bundled content or assets | Deploy the website and run `npm run app:sync`; build, test and distribute new iOS/Android versions. Installed apps retain their bundled frontend until updated. |
| Native plugins or platform code | Update affected native projects, validate and distribute new app versions. Confirm intentional platform-specific behaviour with the user when not explicitly requested. |

Shared source makes consistent implementation possible; it is not automatic app-store delivery or an over-the-air update system. Keep API changes compatible with installed versions. Release reports must distinguish source implementation, website/backend deployment, native testing and app distribution, including any Mac/signing/store-access blockers.

## iPhone and Android app

The Capacitor app bundles the same finder, retailer validation, swipe deck and wishlist storage, with a cream-and-burgundy interface. `site/app.js` removes the marketing hero in favour of a finder-first app composition: controls beside the still life on wider screens, with a quiet illustration beside the question on phones, not a banner. The website retains its desktop composition, photography and navigation. Both versions use `site/finder-controls.js` for compact segmented modes, the three-step questionnaire, a native relationship picker, searchable interest/preferences categories and selected-answer summaries. Native radio semantics, focus and selection behaviour remain. `site/app.css` shares these interactive styles under `.gift-controls`; layout and bottom navigation remain scoped to `.gift-app`. The questionnaire scrolls choices independently of its Continue action; short website viewports can also scroll the page rather than compressing the choices away. Bottom navigation and offline messaging remain app-only. Both versions share a cancellable, truthful loading overlay and lead to the same full-screen deck. Pass, save, like/shop and details keep their existing behaviour and disclosures.

Design references: [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout), [data entry](https://developer.apple.com/design/human-interface-guidelines/entering-data), [tab labels and hierarchy](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Airbnb's 2025 app redesign](https://news.airbnb.com/airbnb-2025-summer-release/), and [NN/g recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/). These inform progressive disclosure, image-led composition, restrained navigation, explicit system status and examples, not copied assets or claims of equivalent quality. Decorative art yields to form readability on small screens; accessibility text enlargement and a visible security challenge can legitimately require scrolling. No fabricated urgency, social proof or guaranteed gift matches are used.

- `capacitor.config.json`: app identity `uk.co.christmasidea.santashelper`; bundled assets, not a remote website wrapper.
- `mobile/native-bridge.js`: native share sheet, clipboard, light haptics, in-app shopping browser, status bar and Android back navigation.
- `android/` and `ios/`: persistent native projects, branded icons and launch screens. Android backups are disabled. The app requests no camera, location, contacts or advertising permissions.
- `scripts/build-mobile.mjs`: copies website assets and bundles native plugins into ignored `mobile/www/`, adding a restrictive native CSP. No server credentials are bundled.

**Preview:** run `npm run dev`, then open `http://127.0.0.1:8787/?app=1` at a phone-sized viewport. Without `?app=1`, the website retains its normal layout with the same updated interactive controls. Production Turnstile rejects localhost; use browser-only request/Turnstile fixtures for local success-path QA, never disable the deployed security check.

**Prepare both native projects:**

```powershell
npm ci
npm run app:sync
# Only needed after changing the brand icon:
npm run build:app:icons
```

**Android:** use Android Studio with SDK 36 and JDK 21 (Gradle 8.14.3). Ensure `JAVA_HOME` points to that JDK and `ANDROID_HOME` points to your SDK; an older JDK cannot compile the plugins, and JDK 25 is not supported by this Gradle version. `npm run app:android` opens the project. To build a development APK:

```powershell
Set-Location android
.\gradlew.bat assembleDebug --console=plain
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a connected test phone with `adb install -r` followed by that path. Google Play distribution requires a signed release AAB, your own keystore and developer account. Keep signing keys outside source control.

**iPhone/iPad:** on a Mac with current Xcode, run `npm ci`, `npm run app:sync`, then `npm run app:ios`. Select your Apple development team, verify the bundle ID, test a physical device and archive for TestFlight/App Store Connect. iOS compilation and signing cannot run on Windows. The app targets iOS 16.4+ to support the deck's native dialogs, inert cards and dynamic viewport layout without polyfills. Test the minimum-supported WebKit as well as current iPhones.

**Backend deployment:** the accompanying Worker/site changes are deployed to production. Future changes must use the normal release process. The bundle calls `https://christmasidea.co.uk/api/*`; `wrangler.toml` allows only the exact additional app origins `capacitor://localhost` and `https://localhost`. The app embeds the hosted `/app-verify` page for Turnstile because the provider cannot verify a local Capacitor hostname. Only that page may be framed by those two app origins; other pages retain `DENY`/`frame-ancestors 'none'`. Messages are checked against both the production origin and the exact iframe window. The existing server token verification, request limits, cancellations and product checks remain enabled. Real hosted verification, a successful production ideas request returning eight cards, and product enrichment were verified in the Android emulator without fixtures. Interactive challenge escalation, renewal and iOS still require device QA.

Wishlists remain on the device, survive app restarts, and can be opened offline. Descriptions are not persisted by the app. New suggestions and shopping require a connection. Sharing creates public website links rather than unusable Capacitor-local URLs, and only shares the saved list, not the description or local wishlist name. Calendar-file downloads remain a website feature and are hidden in the native app. The privacy notice also applies to the app; complete App Store privacy/Google Play Data Safety declarations from the actual enabled providers before release. Store acceptance is not guaranteed by packaging.

Run `node --test test\mobile-app.test.js test\frontend-api.test.js test\swipe-deck.test.js test\frontend-exclusion-flow.test.js` for focused regressions. Device QA must cover real Turnstile renewal, safe areas, keyboard opening/closing, shopping return, cancelled sharing, offline wishlists, Android back, large text, reduced motion and both screen orientations.

The revised description view and all three survey steps were browser-measured at 320x568, 375x667, 390x844, 430x932, 844x390, 936x706 and 768x1024: no page or horizontal overflow, with the primary action and disclosure above navigation. Survey search reset and hidden-choice validation, loading focus, Escape cancellation and error recovery were exercised. Short landscape uses a dedicated two-column survey, rather than clipping the choices. These checks are not a physical-device accessibility certification or a claim of perfection.

The final Android debug APK builds successfully. Native emulator regression checks cover description and guided searches, exact budget transmission, saving, Android back, clipboard, cancelled system sharing, offline wishlists and deck geometry. Text inputs blur on submission to dismiss the keyboard; known native share cancellation is normalised to `AbortError`, while real failures remain visible. The focused regression suite passes 89 tests. iOS projects are synced but not compiled or signed; neither app has been submitted to a store.

## Interactive visual language

The website and app now share segmented finder modes, rounded writing surfaces, example chips, primary actions, choice tiles and dialogs. The original radios remain the source of truth behind the relationship picker, preserving inferred age/occasion and optional custom relationships. Shared questionnaire logic handles validation, back navigation, search reset and answer persistence; it does not duplicate API requests or change request fields. Without JavaScript enhancement, the original editorial markup remains available. App-only composition and navigation do not appear on the website. Browser and emulator validation do not replace physical-device visual sign-off.

The same visual language applies sitewide through `theme.css`: 12px controls, 13px actions, 16px writing/notices, 24px surfaces/dialogs and pill navigation. Guides share rounded shopping/save actions, jump links, featured surfaces and finder calls to action; mobile retailer buttons stack below 480px to avoid cramped labels. Feedback, wishlist sharing, reminders, recent items, partner dialogs and legal notices inherit the same tokens. Typography, photography, inverse burgundy palettes, affiliate prominence and disclosures stay intact. These styles are loaded by every public page, including generated guides, about/privacy and 404; no per-page JavaScript enhancement is required for the shared design.

Sitewide rollout validation covers 18 public pages at 320px, 390px and 1440px widths (54 checks with no horizontal overflow or clipped navigation), guide-save persistence, partner/wishlist dialogs, representative app layouts and 91 focused regression tests. Shared editorial CSS remains below its existing 11,000-byte gzip budget.

Website rollout checks cover all three survey steps at seven viewport sizes from 320x568 to 1440x1000, both input routes reaching an eight-card fixture deck, exact budget/relationship transmission, search, hidden-choice validation, reset, loading cancellation and explicit API-error recovery. The shared-control regression suite passes 90 tests; the app's seven description layouts and 21 survey layouts were also rechecked after extraction. Local browser success-path checks use fixtures, not a bypass of production verification.

`site/theme.css` owns the shared paper, control-border, selected, success and warning tokens, native text/select controls, writing surfaces, buttons and base dialogs. `site/home.css` composes the guided choice cards, correspondence-style feedback and finder messages; `site/swipe-deck.css` adapts these to the results canvas. Guides and sponsor dialogs use the same shared actions rather than a separate button system.

Keep the festive photography, parchment canvas, Fraunces headings and burgundy identity intact. Selection controls retain native inputs and keyboard behaviour, with visible focus and non-colour selection indicators. Textareas retain resizing and integrated character counts; validation associates invalid fields with the live status message. Motion respects reduced-motion preferences. Feedback still opens an email draft: it does not submit a new API payload or claim that an email has been sent.

Run `node --test test\interactive-design.test.js test\editorial-theme.test.js test\guided-finder.test.js test\site.test.js` for focused checks. The combined theme, homepage and guide stylesheet budget is 11 kB gzipped. For browser QA use `npm run dev`; production Turnstile rejects localhost, so test request states with browser-only fixtures rather than weakening the production security check.

## Swipe finder and named wishlists

The photographic landing page and both input modes stay in place until a successful search. Results become a dedicated viewport-fitting cream-and-burgundy discovery canvas, rather than a section of the landing page. Only the product image, gift name and small information control appear on each card. The portrait card, compact navigation and three thumb-friendly actions fit desktop, mobile, short screens and landscape using dynamic viewport units and safe-area insets, without scrolling the page. Product images use `object-fit: contain` rather than cropping a product to mimic a dating photo. Photo-less ideas have an abstract, clearly non-photographic treatment; no competitor imagery or invented product photos are used.

Swipe left to dismiss, right to open shopping options, or use the bookmark to choose/create a wishlist. Tap the card or information button for details without registering a like. Explanations, original live retailer links, photo attribution and full disclosures live in a native modal; moving the existing DOM nodes retains feedback handlers, listing enrichment and expiry updates. A short commission disclosure stays visible below the controls. **How it works** contains the full disclosure and recipient interpretation. Wishlist sharing and reminders are in the wishlist dialog, not the discovery canvas. Equivalent buttons and left/up/right arrow keys (when the stack has focus) work without gestures. Vertical gestures, cancellation, reduced motion and keyboard focus are preserved; dismissed cards animate out and saves use a gentler confirmation transition. Right-swipe shopping links use the existing affiliate router and checked retailer-specific listings; search links never assert stock, matching products or prices. Approved searchable physical-gift partners can join Amazon/eBay alternatives; pending programmes and merchants without reviewed search destinations are not invented as offers.

Design research: [Tinder's official screenshots](https://apps.apple.com/us/app/tinder-dating-app-date-chat/id547702041) informed the dominant image, restrained identity overlay and separate action rail; [Bumble's redesign announcement](https://bumble.com/en/the-buzz/bumble-new-era) and [official product listing](https://apps.apple.com/us/app/bumble-dating-app-meet-date/id930441707) informed simplified navigation and clear visual hierarchy. The original [Stylect](https://techcrunch.com/2014/05/01/swiping-is-the-new-liking/) and [Mallzee](https://techcrunch.com/2014/05/22/mallzee-seed/) reports establish the shopping adaptation (historical examples, not claims about their current products). [WCAG 2.2 dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) supports keeping single-click alternatives, not gesture-only actions. These are pattern references, not copied layouts or assets.

The existing API returns up to eight validated ideas, sometimes fewer. After five of eight have been explored (three remain), one additional batch is fetched and appended without moving the current card or interrupting browsing. No request runs until a user advances, while another request is active, or in a hidden tab. Existing Turnstile renewal, 60-second cancellation, caches, per-visitor limits and daily AI/product budgets still apply. Failed/empty/duplicate batches pause automatic requests and preserve the deck; **Find more ideas** is the explicit retry. Catalogue fallback also pauses automatic preloading. The client remembers seen titles for this search and rejects exact case-insensitive repeats; the API still receives only the latest 24 title exclusions, prioritising rejected gifts. Semantic uniqueness beyond that bounded window is not guaranteed. Product-photo checks and replacements apply to each batch before it joins the deck.

Turnstile uses `interaction-only` appearance so completed checks do not clutter the deck. In the immersive view its wrapper accepts pointer input only between the provider's interactive-challenge callbacks; empty wrappers must not intercept the swipe controls after a completed or renewed check. This also supports Turnstile's closed shadow DOM.

`site/wishlists.js` stores up to 20 named lists of 50 gift concepts each under `ci-wishlists`, migrating the original `ci-shortlist` into "My gift shortlist". The old key remains a compatibility copy of the active list. Gift-guide saves, the resume shelf, copying and sharing use the selected wishlist; the navigation badge counts all lists. A full list prompts for another list instead of silently evicting a saved gift. List names stay local and are excluded from AI, feedback, telemetry and shared-list payloads. Storage failures are shown explicitly and retain in-memory lists for the visit. There are no accounts or cross-device sync.

Validate the new flow with `node --test test\swipe-deck.test.js test\frontend-exclusion-flow.test.js` and the existing frontend/affiliate regression suites.

## Monetization and browser-local retention

The shared [affiliate router](site/affiliateRouter.js) is used by results, shortlists, shared lists and generated guides. Existing Amazon/eBay builders and validated listings are preserved. Etsy, Not On The High Street, Buyagift, Virgin Experience Days and John Lewis support individually approved Awin, CJ and Skimlinks programmes. Unconfigured programmes use ordinary merchant links, not pretend affiliate tracking. Commission percentages and cookie days must come from approved programme terms; a wrapper cannot guarantee commissions or 7–30-day cookies. Routing orders configured commission rates, then cookie duration. CJ requires a tracking link/ad ID, not the merchant account ID.

### Public settings and API readiness

[`.env.example`](.env.example) documents public settings and Worker-only secrets. This static app does not use Vite/Next prefixes or automatically load `.env`. Export selected public variables before `npm run build:pages`; [the settings builder](scripts/monetization-settings.mjs) writes an explicit public allowlist to `site/monetization-config.js` and regenerates guide links. Keep actual API keys in Wrangler secrets or ignored `.dev.vars`, never public build output.

```powershell
$env:AWIN_AFFILIATE_ID = "<approved public affiliate ID>"
$env:ETSY_AWIN_MERCHANT_ID = "<approved merchant ID>"
$env:ETSY_AWIN_APPROVED = "true"
npm run build:pages
```

Merchant profiles have separate Awin/CJ/Skimlinks approval flags. No example implies a retailer currently offers a particular programme. Verify the approved final redirects before publishing. Build-time `AMAZON_PARTNER_TAG` and `EBAY_CAMPAIGN_ID` must match Worker product-validation settings.

### Awin applications and activation

The public publisher ID `3146453` and the following advertiser IDs persist in [`AWIN_ACCOUNT`](site/config/affiliates.config.js), so an ordinary build retains them. Explicit environment values override these defaults; empty IDs disable tracking. No Awin API token, login cookie or account contact details are stored in the repository.

At the previous account review, applications for these four programmes were **pending advertiser approval**, with **zero joined programmes**. That is historical account state, not a current check:

| Programme | Awin advertiser ID | Advertised commission, not yet assigned | Attribution window |
| --- | --- | --- | --- |
| [Not On The High Street](https://ui.awin.com/merchant-profile/18484) | 18484 | From 3% | 30 days |
| [Green Tulip](https://ui.awin.com/merchant-profile/48159) | 48159 | 10% | 30 days |
| [Ethical Superstore](https://ui.awin.com/merchant-profile/3651) | 3651 | Content sites: 20% new / 10% existing customers | 30 days |
| [Virginia Hayward Hampers](https://ui.awin.com/merchant-profile/2500) | 2500 | 2.5% in programme overview; reconfirm current rate | 30 days |

These are programme overview figures, not guaranteed earnings or confirmation of an assigned commission group. In particular, Ethical Superstore showed a payment-exposure warning and a long average payment time; monitor payment status before prioritising it. Applications disclose the site's AI-assisted recommendations and editorial promotion without making traffic claims. No brand bidding, unauthorised voucher promotion or email marketing was proposed.

The account owner has since reported joining the advertiser programmes in the expanded shortlist. Virginia Hayward Hampers (also in the table above) is now enabled for static routed links; the other legacy entries remain disabled until individually confirmed in Awin. Check each advertiser's assigned commission group, current terms and deep-link permissions before enabling it. Set commission rates only from assigned terms; rates remain zero in routing until explicitly configured.

The feed-backed product catalogue and its D1/import setup are documented in [Awin product catalogue](docs/awin-product-catalogue.md). Product discovery remains disabled until its database, a fresh feed and reviewed image-host allowlist are configured.

The shared [cold-start product ranker and research review](docs/product-evidence-ranking.md) add reviewed product
evidence, conservative review weighting, safety exclusions, equivalent-product landed-price ordering and
collision backfilling. Its external-evidence registry is intentionally empty until permitted, identity-matched
sources are reviewed. `node scripts/evaluate-products.mjs cases.json [evidence-policy.json]` evaluates product
coverage and optional graded relevance judgments without network calls; it does not claim proven gift quality.

Not On The High Street already participates in personalised-gift alternatives. The three new merchant profiles accept reviewed same-merchant product/collection URLs through the shared router; they do not automatically add generic buttons or unverified inventory. Before adding placements, enforce programme restrictions: Virginia Hayward hampers are adult-only; Green Tulip delivers only to mainland UK and excludes gift vouchers from commission; only authorised voucher codes may be promoted. Review these restrictions again when enabling inventory.

The other original merchant placeholders remain disabled. [Buyagift's official programme](https://www.buyagift.co.uk/affiliateinfo) uses Partnerize, not Awin; do not invent an Awin advertiser ID for it. No applications or new accounts were created on other networks.

**Amazon Creators API access is not required.** Keep `AMAZON_PRODUCT_DISCOVERY_ENABLED=false` until access is approved; search links work without it. When available, configure the existing provider credentials described below. Progressive listing/image injection, validation and expiry remain intact. Offer comparison distinguishes search buttons from verified, retailer-specific prices; it never claims identical products or the cheapest delivered price.

### Static sponsorship and verified partner inventory

[`sponsoredProducts.json`](site/data/sponsoredProducts.json) contains reviewed placement IDs, titles, descriptions, indicative GBP price ranges, image/destination fields, sponsor identity, target tags, budget bounds, active flags and priority weights. Three sample records have `demo: true` and never appear unless `ENABLE_SPONSORED_DEMOS=true` is deliberately built in. Replace them with reviewed real placements (`demo: false`) before commercial use. Matching injects at most one Sponsored Pick at index 1; a general fallback must also fit the budget. Minors and descriptions with explicit exclusions/owned-item constraints omit partner injection rather than bypassing recipient safeguards. The footer enquiry modal uses `mailto:` only; sent enquiries become ordinary business correspondence, not a website marketing database.

Experiences/subscriptions use separate, initially empty [`verifiedGifts.json`](site/data/verifiedGifts.json). Set `ENABLE_VERIFIED_GIFTS=true` only after supplying reviewed current inventory. Adult guided searches can explicitly opt into each type. The AI's physical-product validator stays unchanged: non-physical offers come from verified inventory, not invented model availability.

Each verified record needs:

- `id`, `title`, `description`, `giftType` (`experience` or `subscription`), `active`, `merchantId`, approved same-merchant HTTPS `destinationUrl` and `termsUrl`, and `targetTags`.
- `price: { amount, currency: "GBP" }`, `available: true`, `availabilityCheckedAt`, `expiresAt`, and `locationScope: "uk-wide"`. Evidence expires within 24 hours; re-check it before updating timestamps. This adapter supports nationwide selectable vouchers, not inferred local venues.
- Experiences: `locationNote` and `voucherTerms`, explaining selection, dates and restrictions.
- Subscriptions: `recurringPriceGbp`, `billingInterval` (`month` or `year`), `minimumTotalGbp`, `minimumTerm`, `cancellationTerms`, and same-merchant `cancellationUrl`. Initial, recurring and minimum-commitment costs must fit the budget and are displayed explicitly.

Expired/disabled inventory is not linked, including from saved/shared lists. Maintain records through reviewed static updates or a future approved feed; no live source or availability is fabricated. Sponsored creatives, if used, must be reviewed self-hosted images, not arbitrary tracking URLs.

### Retention and additional CRO

- `ci-shortlist` stores at most 50 gift concepts, grouped by fixed recipient labels. Finder and editorial-guide cards both support saving; lists and header counts refresh across tabs. Legacy title/query/category lists migrate on read. `ci-recent-ideas` stores at most 12 concepts from finder/guide shopping clicks, with a homepage resume shelf and clear-history control. Neither list is uploaded.
- Versioned, bounded UTF-8 fragments (`#list=`) encode a shared copy, using gzip when available and smaller, otherwise base64url. Shared state excludes freeform descriptions, email/name fields, birthday dates, seller/listing objects and expiring affiliate URLs. Active links are rebuilt from configuration; partner records use inventory IDs. Shared cards do not contribute to recommendation-training feedback.
- Native sharing, WhatsApp's native deep link and its explicit WhatsApp Web fallback, and copying include titles, affiliate shopping links, disclosure and a full-list link. Removing local entries cannot revoke shared copies. Storage/clipboard errors are surfaced; native share cancellation is not an error.
- Browser-generated `.ics` files provide an all-day Black Friday reminder or a reminder two weeks before a birthday. Dates are temporary browser values, never saved or sent. Calendar apps handle imported files under their own terms.
- "Complete this gift" uses curated accessory mappings and compatibility advice. Remaining budget is shown only from an unexpired matched price; add-on prices and delivery are never invented.
- Three additional reviewed interest/budget guides reuse static generation, existing imagery and the sitemap. Fragment-based finder presets fill interests/budget for review without automatically calling the AI.

### Disabled-by-default ads and telemetry

[`AdSlot`](site/AdSlot.js) reserves responsive minimum heights only when `ENABLE_ADS=true`: inside loading and below results/sharing, never inside the cards. An optional HTTPS script must match `AD_ALLOWED_HOST` exactly and the Worker `MONETIZATION_AD_HOST` CSP setting. Its approved adapter exposes `window.santasHelperContextualAd(container, { placement })`; no finder/list data is passed. Missing/blocked scripts leave a reserved placeholder and diagnostic. Providers requiring more domains/frames need a reviewed CSP change, not wildcard permissions.

[`trackMonetizationEvent`](site/monetization-telemetry.js) emits a browser-local event with only `eventType`, `merchantNetwork`, `giftCategory` and fixed `recipientTag`. It has no backend endpoint, IDs, list/title/description fields or IP handling. Plausible/Umami hooks require `ENABLE_EXTERNAL_TELEMETRY=true`, `TELEMETRY_PROVIDER` and an already installed approved adapter/script. `MONETIZATION_ANALYTICS_HOST` supplies an explicitly approved Worker CSP host. No analytics script is installed automatically.

Existing Turnstile, IP-derived rate limits, AI caching and aggregate recommendation feedback are intentionally preserved for bot/cost protection. No email collection, accounts, authentication, paywalls or marketing-PII storage are added. Existing protections are pseudonymous, not anonymous. Hosting/AI/retailer providers still process requests. Review external ads/analytics privacy, retention and consent requirements before activation; cookieless does not guarantee zero personal-data processing or GDPR liability.

Validate with `node --test test\monetization.test.js`, `npm test`, `npm run build:pages` and `npx wrangler deploy --dry-run`. These checks need no paid AI calls.

## Quality checks

The finder keeps freeform "Describe them" separate from the choice-based "Answer a few questions" path. Guided interests and recipient details use compact checkbox tiles under always-visible category headings, with selection counts above each list. Only "Someone else" reveals an optional relationship text field (not a name). Budget defaults to £40, with "No set budget" unticked; its slider and numeric field share a £1–£1,000 maximum in £1 steps. Choosing "No set budget" hides the controls and removes the cap. The exact cap reaches both prompts, deterministic validation and product discovery; legacy budget-band API requests still work. Guided interest/detail limits accommodate every listed checkbox without truncation.

Opening the guided finder hides the introductory headline and deck and returns to the top of the page, starting the survey beside the Christmas imagery. All interests and extra details are visible without expand/collapse controls or separately scrolling lists. The complete survey flows down the page with normal page scrolling, without a fixed-height container or internal scrollbar. The budget slider and amount field remain unchanged. Switching back restores the introductory layout without clearing answers. Starting over restores the enabled £40 budget and clears selections. Short screens and browser zoom retain page scrolling rather than clipping questions; reduced-motion users skip the animated scroll.

### Feedback-driven evolution

The finder records structured daily feedback totals, including explicit good/poor-match ratings and self-reported purchases. Dislikes immediately affect the current search's bounded exclusions. An admin-only paginated CSV export and offline policy-proposal command support reviewed category ranking for similar interest/age/budget cohorts, without storing raw descriptions, generated titles or per-user histories in feedback. Global learning is disabled until sufficient evidence and a quality review approve a versioned policy; it does not retrain Claude or treat clicks as purchases. See [the learning workflow](docs/gift-intelligence-engine.md#learning-from-feedback) for setup, thresholds, export, activation and rollback.

Concept-level feedback now also records controlled gift-concept keys and graph versions, never a recipient-description archive. A fresh, human-approved library can skip Claude only for supported requests with eight validated, grounded ideas, at least three categories and direct coverage of every detected interest. Recent explicit ratings, minimum support and a Wilson lower-bound guard inform unapproved proposals; clicks are not quality labels. The shipped library is empty/unapproved, so the baseline remains unchanged until real evidence passes review. Export with `node scripts\export-feedback.mjs gift-knowledge.csv --knowledge`, then run `node scripts\review-knowledge.mjs gift-knowledge.csv`. See [reviewed concept memory](docs/gift-intelligence-engine.md#reviewed-concept-memory-and-api-free-reuse) for the research, limitations, acceptance gates, activation and rollback.

Reuse evidence now requires server-signed, 24-hour card receipts and transactional replay deduplication: copied requests cannot repeatedly rate the same card or submit both a good and bad rating. Only single-topic, trait-free requests contribute verified concept evidence; legacy clients retain category/usage feedback without affecting reuse approval. Random replay markers expire within 24 hours, while controlled aggregate counts retain the existing 90-day limit. This proves an issued card, not an independent human or a retailer purchase. `node scripts\evaluate-knowledge.mjs` reports API-bypass coverage, explicit abstention reasons and structural checks without paid calls or a recommendation-quality claim.

A daily GitHub Actions check can open a usage-analysis issue after 200 additional shown cards across the site, even without ratings. Separately, rated cohorts qualify after 200 shown cards and 30 explicit ratings, with equivalent fresh evidence required for rated-cohort reminders. Both triggers are combined into one issue when ready together; deliveries retry without duplicating issues. Notifications require the Worker/admin secret and repository Actions setup; see [notification setup](docs/gift-intelligence-engine.md#feedback-readiness-notifications). No ranking changes are made by this workflow.

### Release recommendation selection

Production selects `RECOMMENDATION_MODE = "baseline-v3.3"` in `wrangler.toml`, following the completed paired review's preference for the preserved baseline. The normal AI path uses the frozen v3.3 prompt/tool, its ten candidates, and the validator's original-order variety selection. It does not run graph top-ups, discovery hints or v3.4 reranking. A separately approved knowledge library may bypass this AI path as described above; it is initially empty/unapproved. Current safety and product-only validation remain in place. The preserved baseline keeps identical titles and ordering on 29/30 cases; case-12 intentionally replaces the inconsistent "Garden kneeling pad and tool apron" (title/concept name an apron, while its query and explanation describe a kneeler with pockets) with the next valid candidate, "Personalised herb garden marker set". `test/baseline-release.test.js` asserts that exact rejection and replacement, and exact parity for the other 29. Catalogue fallback also uses the original catalogue curation.

The shared validator rejects explicit product-identity conflicts between kneeling aids and aprons, and between enamel camping coffee pots and moka/stovetop espresso makers. It checks title, concept, raw and cleaned query, the leading product description in the explanation, and feature/variant specs. It never rewrites a product to force agreement: the next validated candidate is used, or an honest shortfall is returned. These are narrow deterministic guards, not comprehensive natural-language consistency verification; unknown types and incidental explanatory mentions retain the existing checks. Explicit synonyms can satisfy query/title agreement without sharing literal words.

"Show me different ideas" retains the existing title-only request payload: the browser sends up to 24 displayed titles, prioritising its last 24 dismissed/poor-match titles (in memory, reset on a new form submission), and the API accepts at most 24 entries of 80 characters each. Retries preserve that request's exclusions. In addition to existing exact/stem-overlap checks, known kneeling-aid, moka and enamel-coffee-pot identities match rewordings across candidate title/concept/query and within a batch. Kneeling mats, pads, cushions and kneeler-seats count as one aid; storage seats, ordinary pads, apron types, books, covers and other accessories are not automatically collapsed. Grinders and drippers remain distinct. This is bounded freshness protection, not indefinite session-wide uniqueness or general semantic matching. The validator version participates in cache identity, as do the normalized exclusions and baseline/experimental mode; older curated responses cannot bypass the new checks.

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

- `site/gifts/` - thirteen original gift guides plus an index, `site/404.html` and `site/sitemap.xml` are **generated** by `npm run build:pages` (`scripts/build-site-pages.mjs`). Edit the guide content/templates in that script, re-run it and commit the output. Each of the 104 guide ideas has specific buying advice; shopping links are sponsored searches, not tested products or guaranteed prices. Affiliate settings use the public build configuration, falling back to existing homepage Amazon/eBay settings.
- `site/theme.css` owns the shared ivory/oxblood colour tokens, fixed light appearance, local Fraunces/Figtree fonts, masthead/footer and reduced-motion rules. Edit `site/home.css` for the single-column finder, and `site/guide.css` for editorial/legal pages directly; the page build preserves these stylesheets. Shared header/footer markup comes from `site/index.html`; the generator also synchronizes it into `about.html` and `privacy.html` without replacing their authored legal content. `site/site-shell.js` supplies the shared countdown and secondary-page shortlist badge; `/?shortlist=1` opens the finder's existing saved-ideas dialog.
- Approved photographic-style editorial masters live in `assets/editorial/`, with a distinct scene for each guide. They are AI-created inspiration, not photographs of tested products; this distinction is disclosed on the homepage and guides. No external UI, font or image dependencies are needed. The homepage aligns the headline and finder on the left of one integrated Christmas photograph, without a separate image column or sample-collection sidebar. Its waiting message does not simulate server progress; cancellation and errors retain the description. Recommendation photographs still come only from the product-matching pipeline, labelled "Matched Amazon listing", not as tested or endorsed products. See [the design direction and research](docs/design-direction.md) for rationale and acceptance criteria.
- Copy should explain recipient fit and a useful buying decision, not promise that a gift is universally welcome. Keep titles, descriptions and search queries about the same item; do not imply unverified prices, performance, health benefits or bundle contents. The £10 guide lists ideas to search for, not current offers. Catalogue explanations remain item-specific even when there is no keyword match. Shared AI writing guidance in `src/core.js` is appended to both prompt modes without editing the frozen baseline; `EDITORIAL_VERSION` is part of the generation fingerprint, so change it when that guidance changes. Stored replays test selection, not the quality of newly generated prose; paid live writing evaluation needs the benchmark cost approval described below.
- Each guide scene uses recognisable objects: a telescope for astronomy, a train and blocks for play, a classical temple model and map for history, and both a teapot and cafetiere for hot drinks. Guide heroes include descriptive alt text; repeated linked directory imagery is decorative to screen readers.
- The explicitly approved design uses oxblood, warm ivory, pale blush, restrained local serif typography and a small Christmas star. A substantial right-hand still life shares a continuous linen background with the left-aligned, unboxed finder. On tablet and mobile, the photograph scales to the viewport and the finder uses the available reading width below the opening composition. Guides, results, shortlist, legal pages, sharing image and icons use the same identity. The site deliberately stays light even when the device prefers dark mode: `color-scheme: only light`, matching page metadata and a single ivory browser theme colour preserve the approved aesthetic. Category images use separately approved transparent photographic cutouts, not feathered rectangles; the original scene masters remain available.
- The shared header contains the Christmas countdown, with no promotional strip above it. On canvas pages, the body owns the continuous photographic background behind both header and content; the header is transparent and has no divider. Mobile retains a visible guide link alongside the shortened countdown.
- Run `npm run build:images` after updating approved masters or brand sources. Commit all generated assets: the category 400/800/1200-pixel WebPs and Christmas banner 800/1400/2000-pixel WebPs in `site/images/`, `og-image.png` (1200 x 630) and `apple-touch-icon.png` (180 x 180). The build reads the transparent 1400 x 980 `*-cutout.webp` category masters and preserves alpha; do not flatten them or restore scene-cover crops. The original category scene masters remain as references; the banner master is 2000 x 889. All masters stay outside the published directory. The sharing image composites the banner photograph with `site/og-image.svg`; `site/brand-icon.svg` and `site/favicon.svg` contain the star identity. Sharp is build-only; browsers receive self-hosted WebP/SVG/PNG assets. Rebuild guide markup using `npm run build:pages`. Further overall design proposals require explicit approval before implementation.
- `site/robots.txt`, `og-image.png`, `apple-touch-icon.png`, `about.html`, `privacy.html`.
- `src/index.js` sets security headers (CSP, HSTS, framing and referrer policy). The CSP allows inline scripts and styles because the pages use them, plus approved Amazon image hosts and Cloudflare Turnstile and Web Analytics. Tighten it if you move scripts into hashed files.
- The browser's Cancel button aborts the browser fetch and returns the UI to the form; it does not guarantee that the Worker or an already-started Claude request stops processing. The Worker applies its own upstream timeout.

## Before you publish (checklist)

1. Rotate the Anthropic key and keep keys out of the project folder (set `ANTHROPIC_API_KEY` as an environment variable or Wrangler secret only).
2. Legal pages identify the operator by name and email, with a physical postal address available upon legitimate legal request in the privacy notice. Verify applicable address-disclosure requirements before publishing; an on-request clause may not satisfy every legal obligation. Register with the ICO if required.
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

3. Set both `PRODUCT_DISCOVERY_ENABLED = "true"` and `AMAZON_PRODUCT_DISCOVERY_ENABLED = "true"` in `wrangler.toml`, confirm `AMAZON_PARTNER_TAG` is the UK tracking ID for the registered Associates account, then run `npm test` and `npx wrangler deploy --dry-run` before a separately approved deployment.

Creators API search uses `SearchItems` (up to 10 results), explicitly filters for available new items, and retrieves titles, brands/features, primary and variant image URLs, and offers where returned. Product matches must identify the full product type in the listing title, match any explicit brand/colour/size/model/edition constraints, be explicitly new and in stock, and fit any stated budget. The application rejects uncertain matches, unapproved image hosts and affiliate destinations that do not match the ASIN. If there is no suitable verified match, the existing Amazon search link and decorative local placeholder remain. The account's actual Creators API TPS allocation is unknown; the default global limit is one request per second and can be configured after Amazon confirms the allocation.

Amazon's official Creators API guidance specifies a one-hour cache TTL for `Offers` and one day for other listed resources, including images, item details and detail-page URLs. This application uses a stricter one-hour cache for all normalized Amazon results, never downloads or stores image bytes, and never uses Amazon content when the flag or credentials are absent. Review the [UK Creators API documentation](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/get-started/using-curl), [UK Creators API cache guidance](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/concepts/best-programming-practices), [UK Creators API registration guide](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/onboarding/register-for-creators-api), and [UK Associates policies](https://affiliate-program.amazon.co.uk/help/operating/policies) before enabling or changing this integration.

## eBay and equal merchant links

The finder, shortlist and generated gift guides give Amazon and eBay equally sized shopping links. Without an approved eBay Partner Network campaign, eBay links are ordinary searches or matched listing links, not monetised links. Photos do not require an affiliate campaign, but they do require production API access. Search links do not verify a product or promise availability.

eBay's Browse API can supply real listing photos independently of Amazon access, but production access is not guaranteed. First create an [eBay developer account](https://developer.ebay.com/), join [eBay Partner Network](https://partnernetwork.ebay.com/), and complete the [Buy API production approval process](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html). Confirm the site's intended image use against the API licence and EPN agreement. Sandbox credentials alone do not enable live photos.

After approval:

1. Set the production App ID as `EBAY_CLIENT_ID` in `wrangler.toml` (or as a Worker secret), and the production Cert ID with `npx wrangler secret put EBAY_CLIENT_SECRET`. Sandbox keys do not fetch live listings; the Dev ID is not needed. A single secret named `EBAY_API` is not used.
2. Leave `EBAY_CAMPAIGN_ID` empty to use ordinary eBay listing links. When Partner Network is approved, set its numeric campaign ID in both `wrangler.toml` and the `GIFT_CONFIG` block in `site/index.html`. Run `npm run build:pages` to regenerate the guides with the same campaign. A configured campaign requires API-returned affiliate URLs with that exact campaign; missing tracking never silently falls back to an ordinary link.
3. Set `PRODUCT_DISCOVERY_ENABLED = "true"` and `EBAY_PRODUCT_DISCOVERY_ENABLED = "true"`. Leave `AMAZON_PRODUCT_DISCOVERY_ENABLED = "false"` until Amazon access and permissions are confirmed. The global switch disables all product discovery; the merchant switches operate independently.
4. Run `node --test test/ebay.test.js test/merchant-card.test.js test/product.test.js test/provider-neutral.test.js test/site.test.js test/frontend-api.test.js`, then `npx wrangler deploy --dry-run`. Separately approve deployment and verify live credentials, returned affiliate URLs, listing matches and image loading.

The integration uses server-side OAuth client credentials and the GB marketplace. It searches new, fixed-price listings located in the UK and deliverable to GB, rejecting mismatched IDs, variants, campaign IDs, image hosts and expired listings. A budgeted match requires a GBP price including returned delivery charges. Checkout may vary by postcode; shoppers must still confirm delivery and the final total. Images are linked directly from `i.ebayimg.com`, never downloaded or copied into the site's assets. eBay's `persistResults: false` policy skips all persistent product-cache reads and writes, including empty results. Listing data exists only during request processing and temporary browser display; API responses use `Cache-Control: no-store`. Seller/account fields are discarded, listings are not logged, and shortlists keep our gift concepts rather than retailer listing data. Amazon retains its existing one-hour cache when enabled.

Production keysets disabled for marketplace account deletion compliance cannot obtain OAuth tokens. For this no-persistence integration, apply for the exemption through Application Keys > Notifications > Marketplace Account Deletion > **Not persisting eBay data**, describing transient Browse API processing accurately. See the [official account-deletion guide](https://developer.ebay.com/marketplace-account-deletion). eBay must activate the keyset before live verification can pass. Do not claim an exemption if this application or another application sharing the keyset persists eBay data; subscribe to notifications instead. Revisit compliance before adding persistence.

The eBay-only launch configuration caps Browse attempts at 4,000/day site-wide, with 1,000/hour, 32/second, 240/visitor/day and 64/visitor/minute limits. Each OAuth-related Browse retry needs another reservation; token requests use a separate eBay allocation. Existing daily visitor counters seed the new global daily counter without discarding earlier usage. This leaves headroom against eBay's published default 5,000 Browse calls/day; confirm the actual keyset allowance and account for any other applications sharing it. Eight initial ideas use up to 16 searches; four optional replacement candidates add up to eight, with no second AI generation. At 8-24 searches per list the daily cap supports roughly 165-500 lists before retries or other usage, not 4,000 visitors. Per-visitor capacity covers ten worst-case replacement-heavy lists/day (the AI limit remains 15); repeated searches and burst limits can reduce photo availability further. Request eBay's Application Growth Check before raising the daily limit above the approved allocation.

`PRODUCT_PHOTO_FIRST = "true"` enables the operator-approved photo-only finder. The ideas API supplies up to four additional candidates, first from unused model suggestions and then from the recipient-filtered catalogue; all pass the existing exclusions, age, relevance and budget validation. The browser checks initial candidates, tries replacements if capacity remains, and preloads approved retailer images before displaying up to eight unique ideas. It shows fewer ideas rather than filling gaps with photo-less concepts or illustrations, and shows a retryable message if none survive. Product failures and limits are surfaced without silently reverting to photo-less results. Current-image failures and expiry remove affected cards. Partner inventory injection is not applied to this photo-only collection because those placements have not passed the live-photo checks; guide, shared-list and other partner surfaces retain their existing behaviour. With the flag disabled the original progressive enrichment remains available. The feature flag is part of the ideas cache key; retailer offers and photos are never stored in the ideas cache.

The browser requests two ideas per batch, at most two batches concurrently. Photo-first mode waits for image validation before rendering; legacy enrichment displays each batch as it finishes. Each server request searches with concurrency 2 (up to four eBay searches across the browser's concurrent batches). Listings already shown in another batch are not displayed twice. Before enabling Amazon, restore the per-second limit to Amazon's confirmed allocation, or implement separate provider budgets. API failures are logged without credentials or raw response bodies.

eBay examines up to 30 candidates per query, requests extended listing descriptions for feature checks, and retries unmatched ideas with a concise product type plus required features/variants rather than the full recipient-facing headline. Verified matches with photos take priority over other accepted matches without photos; a photo-less match still triggers the existing bounded alternative search and remains available if no photographed match survives. Photo availability never bypasses identity, suitability or budget checks. Matching recognises a small set of equivalent product terms (e.g. whetstone/sharpening stone and knife/knives), rejects conflicting materials, and requires evidence of customisation for personalised ideas rather than treating any engraved message as personalised. A knife's steel or dimensioned blade description is not itself an accessory, but replacement blades, sharpeners, knife blocks and cutlery remain distinct products. Book/ISBN listings cannot stand in for physical equipment. Kits and sets remain product requirements, so a pasta-making book cannot stand in for a kit. Unrequested explicit listing text is rejected. Photos use the largest dimensioned image supplied by the API; URLs are never guessed. Missing matches still retain both search buttons rather than showing unrelated images.

The operator reports eBay approval for an attributed example photo beside equally prominent Amazon and eBay links. Keep that approval with the site's programme records and stay within its scope. eBay example photos are non-clickable, labelled with their source and a warning that the Amazon product may differ; there is no image-sized extra click target favouring eBay. A photo never verifies the Amazon search beside it. Approved Amazon listing photos take priority when available and remain linked to their Amazon listing. Disabling eBay and enabling Amazon switches discovery entirely to Amazon while preserving both shopping buttons.

Each matched offer retains its own title, price and destination, while the card heading remains the gift concept. Expired offers revert to searches and lose their price and source photo; an old eBay expiry or image-error callback cannot remove a replacement Amazon photo. When both APIs are enabled, both merchants are searched and matched independently; the API keeps its legacy `products` array and adds aligned `offers` arrays for multiple merchants. API failures and rate limits retain both search links and show a notice. All merchants share the existing global product-search budget: confirm allocations and adjust the bounded limits before enabling both at volume.

Fixed guides continue to use their disclosed editorial illustrations; live listing-photo enrichment applies to the finder. With no approved credentials, no live retailer photos can be supplied.

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
