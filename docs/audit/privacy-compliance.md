# Privacy and technical compliance assessment

**Partial technical/documentary assessment, not legal advice or a compliance
certificate.** No production feedback, private feed, account profile, or secret
value was exported. Account contracts, legal bases, processor agreements and
transfer documentation require operator/legal confirmation.

## Data inventory

| Data | Purpose and destination | Retention / deletion / access | Important qualification |
|---|---|---|---|
| Free text, age, relationship, interests, exclusions | Browser memory -> Worker -> Anthropic when generation needed | Transient request processing; provider retention/contract external | Can contain personal/sensitive data despite the UI warning; heuristic filters cannot guarantee removal |
| Previously shown idea titles | Bounded anti-repeat input to subsequent requests | Current browser search; included in provider input | Up to 24 exclusions, not indefinite semantic memory |
| Generated ideas, summaries, explanations | Display, cache and optional local save | AI cache up to 24h, short results up to 1h; local gifts until removal/storage loss | Content may reflect user input; cache hashing is not anonymisation |
| Connection IP and daily salted identifier | Cloudflare transport/security and app abuse quotas | Raw IP not intentionally retained in app counters; rotating pseudonymous key | Cloudflare logs/processing remain separate; readiness does not establish salt entropy |
| Turnstile metadata/token | Browser/hosted iframe -> Cloudflare -> Worker verification | Provider policy; token transient | Security exception requires necessity assessment, not a blanket exemption for all third-party code |
| Product search terms/constraints | Enabled providers | eBay normalized listings transient; Amazon cache at most 1h if enabled; Awin catalogue persistent | Search terms may disclose interests; no raw-description transmission is intended on this path |
| Product images | Browser fetch to allowed retailer image host | No application image-byte persistence intended | Retailer receives IP/connection data; browser HTTP cache/provider logs not proved absent |
| Wishlist names and concepts | User-requested local persistence | Up to 20 lists x 50 gifts; clear/remove locally; native uninstall may delete | Names can be identifying. Documentation corrected; corrupt storage must not be silently replaced |
| Recent concepts | Local resume convenience | Up to 12, clear control | Automatic convenience storage is not automatically strictly necessary; legal purpose/objection review required |
| Shared list | Selected concepts encoded in URL fragment; share/clipboard/WhatsApp recipient | Copied URL persists outside operator control | No description, list name, birthday or retailer offer object; deleting local data cannot revoke copies |
| Birthday reminder date | Browser-only calendar construction | Not persisted by app; exported calendar then controlled by user/provider | Correct calendar dates and safe encoding are tested; actual imports not verified |
| Feedback labels and receipts | Controlled cohort/event counters, review | Receipt validity <=24h; expired markers removed by subsequent request/scheduled pruning; daily aggregates 90 days | Validity is not instant physical deletion. Signed issuance != unique human; self-reported purchase != verified transaction |
| Aggregate exports/GitHub notices | Operator analysis/human review | Independent copies; server pruning cannot retract them | Public issues can reveal small cohorts; aggregation does not automatically eliminate privacy risk |
| Support email | User explicitly sends via mail client | Operator mailbox policy external | No claim that composing the message submits it |
| Optional analytics/ads | Disabled app adapters; live Cloudflare Insights observed | External configuration/retention unknown | Distinguish current network observation from disabled monetisation flags |
| Native plugin metadata | OS share/clipboard/browser/haptics operations | OS/app/provider-dependent | Store privacy declarations and SDK data practices not independently verified |

The service operator is responsible for determining controller/processor roles,
lawful bases and necessity. Likely candidate purposes include providing requested
recommendations, fraud/cost protection and business support; this report does not
assign a legal basis merely because a purpose sounds reasonable.

## Verified versus unresolved

- The public notice acknowledges international processing, pseudonymous rate
  limits, cached outputs, local lists, feedback and external copies. It does not
  establish executed DPAs, a lawful transfer mechanism, a retention audit or
  operational response to data-subject requests.
- The baseline notice simultaneously described local names and claimed there was
  "never a name field." The audit corrects the latter and states actual list limits.
- Fragments are omitted from HTTP requests, **but same-page JavaScript can read
  them**. Third-party script privileges, copy destinations, browser extensions
  and screenshots remain outside the "not sent to our server" claim.
- Free text is not guaranteed PII-free; identity/sensitive-data detection and
  multilingual paraphrases have no exhaustive assurance. Shared response caches
  require continued review for input-derived identifying text and diagnostics.
- The public notice's "postal address on legal request" arrangement needs review
  under applicable trader/e-commerce disclosure duties. No address is invented
  or published by this audit.
- No complete incident register, DPIA, retention schedule for external exports,
  legal-basis register, subprocessor register or completed restoration record was
  established from the repository.

## PECR: current guidance, not a blanket local-storage exemption

The [ICO guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/)
explicitly records finalisation on **29 April 2026**, following the Data (Use and
Access) Act changes. Its [exceptions chapter](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/)
distinguishes communication, strictly necessary, statistical, appearance and
emergency purposes. Statistical/appearance exceptions require clear information
and a simple, free means of objecting.

User-requested saving is a stronger necessity candidate than automatically
recording recent shopping activity. A clear-history button deletes past entries
but is not necessarily an objection to future collection. Before the next release,
document each storage/access purpose and either justify the applicable exception
and controls or implement the required consent/objection mechanism. Do not enable
ads/analytics under an unsupported "cookieless means exempt" assumption.

## Children and online safety

The [ICO Children's Code scope guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/)
is not restricted to services intentionally directed at children. Child recipients
do not prove that children are users, and an adult-oriented gift proposition does
not prove they are not. The free, publicly accessible, mobile service needs a
documented "likely to be accessed" assessment supported by actual audience evidence.
Profile minimisation, commercial placements and default privacy warrant scrutiny.

Shared links contain user-chosen concepts and can be forwarded and rendered by
another visitor. There is no account/public feed/chat, and no server-hosted list
database was identified. These facts do **not** decide the statutory user-to-user
definition or an exemption. Use [Ofcom's service guidance](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/guide-for-services)
with a UK specialist to determine scope, children-access/risk duties and records.

## Consumer and advertising review

The UI differentiates search ideas, matched listings and illustrative editorial
imagery and contains commission disclosures. Technical repairs preserve explicit
budget/exclusion constraints and sponsored-placement safety. Actual programmes,
image licences, recurring terms, conversion attribution and business disclosures
need commercial/legal evidence. Apply [CMA207](https://www.gov.uk/government/publications/unfair-commercial-practices-cma207)
under the DMCC Act, ASA/CAP advertising identification rules and each network's
current contract; do not infer product testing or guaranteed availability from
a successful API match.
