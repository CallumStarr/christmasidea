# Awin product catalogue

The recommendation engine first chooses a gift concept from the recipient's interests and budget. Awin is an optional product-match layer: it searches current advertiser-feed products for that concept, then applies the same strict product-type, suitability, availability and budget checks as other retailers. Commission rate is not a relevance or ranking signal.

Accepted products now pass through the shared [cold-start product ranker](product-evidence-ranking.md).
It supports reviewed independent evidence, conservatively shrunk product reviews and exact-identity safety exclusions.
Missing evidence remains explicitly unassessed. Within a checksum-valid shared GTIN, known delivery-inclusive totals
can order equivalent offers; unrelated products do not receive a "quality" boost for being cheaper. Awin delivery
is added exactly once, including when a normalized offer is validated again. Retrieved alternatives backfill
duplicate card matches, and cross-provider selection no longer defaults to whichever retailer was registered first.
These changes do not authorize any additional feeds, review scraping or product-data retention.

## What is connected

- `src/providers/awin.js` searches the full-text catalogue and validates Awin's publisher ID, advertiser ID, product identity, destination URL and feed freshness.
- `migrations/0001_awin_catalog.sql` creates the D1 product and full-text tables.
- `scripts/import-awin-feed.mjs` accepts one or more local Awin CSV or gzip-compressed CSV feeds. It stages a new catalogue generation, switches it live only after all imports succeed, then removes older generations in bounded batches so D1's CPU limit does not interrupt publication. Feed rows and API keys are not committed or logged.
- `scripts/sync-awin-catalogue.mjs` downloads every supported UK Awin-format feed marked active/joined in the publisher's Awin feed list and imports them as one generation. It reports joined advertisers without a supported feed. Newly joined advertisers are picked up automatically once Awin lists a supported feed for them.
- `.github/workflows/awin-catalogue.yml` refreshes the D1 catalogue every 12 hours and can also be run manually. It needs GitHub Actions secrets `AWIN_DATAFEEDS_API_KEY` and `CLOUDFLARE_API_TOKEN`; optionally set the `AWIN_PUBLISHER_ID` Actions variable (defaults to the current publisher ID). Cloudflare Worker secrets are separate and are not automatically available to GitHub Actions.
- Product and affiliate links are retained only in the response; Awin search results are not placed in the shared product cache. Stock must be explicitly in stock and the feed currency must be GBP. With a budget, delivery cost must also be present so the displayed total can be checked.
- Offer records expire after 24 hours. Import a fresh feed at least daily; stale offers are not returned.
- Images are used only when their exact HTTPS host is in `AWIN_IMAGE_HOSTS`. Confirm each advertiser's image-use terms before adding hosts. The same host list must be present in the Worker CSP and the public site build.

The feed-list API is the source of truth for synchronization: only advertisers Awin marks active/joined are imported, and only from allowlisted HTTPS Awin feed hosts. Product discovery validates advertiser IDs against the active imported catalogue generation, so newly joined feed advertisers do not require a code or Worker configuration update. The static advertiser list remains as a compatibility/default validation list for existing products and manual imports.

## Current coverage snapshot

The Awin **My Programmes** page showed 20 joined programmes on 2026-11-06. Fourteen had product-feed entries in the feed list; 11 UK Awin-format feed URLs were imported. The active D1 generation contains 25,046 eligible, in-stock GBP products across six advertisers: cardfactory (20,423), Philip Jones Jewellery (2,605), Cadbury Gifts Direct (1,367), Bunches.co.uk (305), Fitness Options (290), and Social Stories Club (56). This is a snapshot, not evidence that every joined programme or product is covered.

Coverage is still partial:

- Four joined advertisers expose Google-only feeds, which this importer does not support: Purr and Mutt, Geek Crate, Wilder Botanics, and Susan Caplan.
- Four Awin-format advertisers had no eligible rows in this snapshot: InterRose, Flowers & Plants Co., Craft Buddy Shop, and My Mini Maker.
- Six joined programmes report no product feed: Tenth Muse Ltd, Austens Jewellers, The Regal Mutt, Black Bee Honey UK, Tinkerer STEAM Box, and Buddylicious.
- Amazon remains disabled and Amazon/eBay APIs are search providers, not exhaustive product-catalogue exports.

The Awin provider flag is still off in `wrangler.toml`; the imported catalogue is not yet being served in production. The refresh workflow requires the two GitHub Actions secrets above before its scheduled/manual runs can succeed. Images also remain disabled until their permitted hosts are reviewed and configured.

## Provision and enable

1. In Awin's publisher interface, go to **Toolbox > Create-a-Feed**, create a feed, and copy its download link. The value after `apikey/` is the **datafeed key**. Store it as `AWIN_DATAFEEDS_API_KEY` in the environment that runs the sync command (for example a GitHub Actions secret or a local, untracked environment variable). Awin's official [feed-list guide](https://help.awin.com/developers/docs/downloading-a-list-of-your-product-feeds) explicitly says this key is different from the Publisher API OAuth2 key. `AWIN_OAUTH2` is therefore not used to retrieve product feeds. The feeds must include the standard Awin CSV fields consumed by the importer: `merchant_id`, `aw_product_id`, `product_name`, `description`, `brand_name`, `merchant_name`, `merchant_category`, `search_price`, `currency`, `in_stock`, `delivery_cost`, `image_url`, `product_url`, `aw_deep_link` and `ean` (where available). Google-format feeds are reported as unsupported and are not silently treated as Awin CSV.
2. The current deployment's D1 database is already provisioned as `christmasidea-awin-catalogue` and its migration is applied. For a separate Cloudflare account, create a database:

   ```powershell
   npx wrangler d1 create christmasidea-awin-catalogue
   ```

3. If provisioning a separate database, add its returned ID to `wrangler.toml`:

   ```toml
   [[d1_databases]]
   binding = "AWIN_CATALOG"
   database_name = "christmasidea-awin-catalogue"
   database_id = "<ID returned by Wrangler>"
   migrations_dir = "migrations"
   ```

   The checked-in binding belongs to the configured Cloudflare account; do not copy its ID into another account.
4. Apply the schema and import a feed. Keep feed files outside source control (for example under `private-feeds/`):

   ```powershell
   npx wrangler d1 migrations apply christmasidea-awin-catalogue --remote
   node scripts/import-awin-feed.mjs --feed .\private-feeds\joined-advertisers.csv.gz --database christmasidea-awin-catalogue --remote --apply
   ```

   For a custom advertiser list, pass `--advertisers 488,48471,...` and set the same list in the Worker variable `AWIN_ALLOWED_ADVERTISERS`. The `AWIN_PUBLISHER_ID` variable defaults to the account's existing public publisher ID, `3146453`.
   
   To fetch every available joined UK Awin-format feed directly from Awin's feed list and publish them together, run:

   ```powershell
   $env:AWIN_DATAFEEDS_API_KEY = "<datafeed key from Create-a-Feed>"
   npm run awin:sync -- --database christmasidea-awin-catalogue --remote
   ```

   For a dry run, replace the database options with `--output .\awin-feed-output`. The feed-list key is used only by this sync process; it is not placed in product links or the public site. The GitHub Actions workflow runs every 12 hours after its required secrets are configured.

   To inspect which joined advertisers have each feed format without downloading products, use `--list-only`.
5. Review the feed's distinct image hosts, confirm their use is permitted, and set the identical comma-separated list in the Worker variable `AWIN_IMAGE_HOSTS` and the public build environment. Then run `npm run build:pages`.
6. Only after a successful import and a review of the feed/link/image terms, set `AWIN_PRODUCT_DISCOVERY_ENABLED = "true"` in `wrangler.toml`, keep `PRODUCT_DISCOVERY_ENABLED = "true"`, run the focused tests and `npx wrangler deploy --dry-run`, then deploy through the normal release process.

Without the D1 binding or a fresh catalogue generation, Awin product discovery stays unavailable; Amazon/eBay and the ordinary gift ideas continue to work. Without the image-host allowlist, Awin products can still be matched in non-photo-first mode, but their images are stripped and photo-first search won't select them. Use `--output .\awin-feed-output` without `--apply` to generate SQL for review instead of writing to D1. A failed import never activates a partial generation.

## Retailer status

Amazon's Creators API provider is already implemented but remains explicitly disabled until its account access and permitted use are confirmed. eBay's Browse API provider is already implemented and enabled behind its own credentials and limits. eBay accepts both `EBAY_CAMPAIGN_ID` and the existing `EBAY_CAMPAIGNID` spelling; the public-site build must also receive that setting to match API affiliate links. Keep their per-retailer approval flags and credentials separate from Awin's feed catalogue.

This is a product-feed snapshot for eligible products from supported, joined Awin advertisers; it does not represent every joined retailer or every item ever listed. Out-of-stock, non-GBP, invalid-link, and unsupported-format rows are excluded. Amazon Creators and eBay Browse are query APIs, not exhaustive catalogue-export APIs, so their providers return relevant search results rather than crawling and storing every listing. Do not describe the combined catalogue as complete.
