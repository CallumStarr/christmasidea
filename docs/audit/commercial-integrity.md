# Commercial, product and asset integrity

## Confirmed corrections

Product matching now preserves recognized exclusions and strict budget caps through
enrichment and rejects explicit size-system/unit conflicts. Similarity or photo
availability cannot override those added hard constraints. Current issued-card
receipts bind a digest of normalized product identity/specifications; raw recipient
text is not added to receipts. Legacy clients remain compatible, so removing a
receipt is **not** prevented as an authentication downgrade.

Awin ingestion now requires explicit new-condition evidence, rejects used,
refurbished, unknown, missing and conflicting conditions, preserves full valid
provider IDs, and obeys explicit advertiser-ID allowlists without widening them
through name aliases. An empty eligible import aborts before publication, cleanup
or D1 writes. **Awin remains disabled. Existing generations need a validated
refresh before activation; old data is not retroactively certified new.**

Commercial recipient checks now use shared language parsing for the reproduced
child-age/exclusion forms. Demo inventory and inactive flags remain unchanged.
Single-strategy benchmark metric repair is not evidence of improved conversion.

## Current routing and attribution

| Surface | Verified source behaviour | Unverified external evidence |
|---|---|---|
| Finder/deck/details | Gift concepts separate from matched offers; merchant-specific destinations; prominent commission text | Actual affiliate conversion, account standing and redirect/payout records |
| Wishlists/shared lists | Concepts rather than saved live listing objects; current links reconstructed | Messaging-app URL-length limits, recipient share previews and retailer attribution |
| Guides | 13 generated guides, 104 concepts, Article markup, shopping searches and illustration disclosure | Editorial expertise, independent product testing and all factual buying advice |
| Awin/CJ/Skimlinks | Merchant-level approval/configuration gates, not a network-ID blanket approval | Programme membership, assigned rates, territory, content/feed/image rights |
| Sponsored/verified offers | Demo flag/active state, expiry, merchant URL and subscription-term validation | Real commercial inventory is absent/disabled; no invented launch readiness |

**SH-021: configuration divergence.** The Worker has an eBay campaign configured,
but the homepage's public `EBAY_CAMPAIGN_ID` is empty, so ordinary search/fallback
links are unmonetised while API offers can carry the Worker campaign. This is a
confirmed configuration difference, not proof of denied commission or permission
to activate frontend affiliate tracking. It was **not silently enabled** during
the audit. The operator must confirm intended approval/scope and reconcile the
public builder and Worker configuration before claiming consistent attribution.

No live purchases, affiliate click-throughs, account settings changes or network
programme activation were performed. Exact commission percentages, payout delays,
cookie windows, revenue per click and commercial sustainability cannot be inferred
from configuration alone.

## Provider-specific limitations

- eBay is enabled in repository configuration. OAuth/retry/quota/destination and
  matching fixtures passed. No-persistence claims are strongest for inspected
  application server caches/database and wishlist fields, not every browser cache,
  provider log or diagnostic tool. Account-deletion compliance and image-use
  permission require programme evidence.
- Amazon Creators API is implemented but disabled. Eligibility, exact allocation,
  product-content licence, cache/display terms and permission to combine content
  with other merchants require current account/legal review before activation.
- Awin's D1 catalogue and scheduled ingestion exist even though discovery is off.
  Joined-feed access, static public affiliate approval and runtime image-host
  permission are distinct controls.
- Verified subscriptions require recurring and minimum-commitment cost disclosure
  and budget checks, but no active inventory was available for real-world term
  verification.

## Assets, SEO and intellectual property

Fonts are self-hosted with OFL licence files. Editorial assets are described as
AI-created illustrations, not tested-product photography. Product images come from
validated provider URLs; a URL allowlist does not itself prove licensing rights.
Maintain original-generation provenance and each provider's written approval.
No images were generated or copied from outside sources by this audit.

All 18 examined public pages had one H1 and no `<img>` missing an `alt` attribute.
All 13 guides had parseable Article JSON-LD and canonical URLs, and the sitemap
listed generated guides. About/privacy lacked explicit canonicals (low-risk
observation, not a ranking penalty assertion). No fabricated Product ratings or
stock schema was found in the inspected guide output.

The [Google FAQ documentation](https://developers.google.com/search/updates#removing-faq-rich-result)
now records removal of FAQ rich results; validity of JSON-LD never guaranteed
presentation. No new FAQ markup or SEO claims were added. People-first editorial
quality, Search Console indexing, backlinks and messaging previews were not
independently certified.
