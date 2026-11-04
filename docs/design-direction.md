# Santa's Helper: the thought before the gift

## What failed in the first pass

The palette changed, but the experience did not. A large generic headline sat above a long boxed form, repeated decorative gift boxes impersonated product imagery, and nearly every section used the same weight, rule and spacing. There was neither a recognisable art direction nor a clear first-screen task.

## Research and application

Sources checked on 4 November 2026:

- [Otherway: Fortnum & Mason](https://www.otherway.com/work/fortnum-mason). Its account describes one strategic north star, a coherent set of brand tools, bespoke typography and a contemporary marque. Apply the principle of a consistent visual vocabulary, not Fortnum's assets or identity.
- [Work & Co: Aesop](https://work.co/clients/aesop/). Its gifting case study describes narrowing discovery by occasion and price. Keep describing the recipient and setting constraints effortless; aesthetic ambition must not bury the finder.
- [The Modern House](https://themodernhouse.com/). The first-party homepage leads with a specific editorial story and separates featured, new and archival content. Give the first recommendation a deliberate role; do not make every item an identical card.
- [Nielsen Norman Group: aesthetic-usability effect](https://www.nngroup.com/articles/aesthetic-usability-effect/). Attractive design does not compensate for major usability problems. Validate successful task completion independently of screenshots.
- [web.dev: Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds). Production targets are LCP <= 2.5 seconds, INP <= 200 milliseconds and CLS <= 0.1 at the 75th percentile. Local observations are diagnostic, not a claim about field performance.

## Art direction

**A small, beautifully run gift atelier.** The product is the consideration that happens before wrapping, not a dashboard that happens to recommend things.

1. A recognisable wordmark, botanical maker's mark and restrained seasonal masthead.
2. Warm parchment, deep forest, aged gold and a little terracotta. Fraunces is expressive, not indiscriminately enormous; Figtree handles clear, comfortable interface text.
3. Original, self-hosted SVG still-life artwork: patterned wrapping, ribbon, foliage and a handwritten-note-like composition. Flat ink and paper colours; no gradients, stock-image dependencies, canvas loops or 3D libraries.
4. A compact writing desk beside the art. One clear prompt, optional examples, a real submit button and a quieter guided alternative. Privacy and disclosures remain accessible and explicit.
5. A featured typographic selection, a complementary adjacent idea, then lighter editorial entries. No invented photographs or giant placeholder boxes. Product imagery appears only when the existing verified-product pipeline provides it.
6. Useful animation only: short button/arrow transitions, a gentle first entrance and a legible curation sequence. No scroll hijacking, marquees, parallax or cursor effects.
7. Illustrated gift-guide starting points and a complete colophon, rather than a list tacked onto the bottom.

## Implementation sequence

1. Build the art and page composition together; review desktop and mobile before polishing secondary components.
2. Refine concierge controls, examples, validation, waiting/cancellation and keyboard focus.
3. Recompose results, image enrichment, dismissal and shortlist states; preserve API and Turnstile contracts.
4. Carry the masthead and typography into generated guide pages and legal pages without overwriting authored CSS.
5. Review the real screens and iterate. Test behaviour and budgets separately.

## Acceptance criteria

- At 1440 x 900, headline, description input and submit action are visible without scrolling. On mobile, the finder precedes large decorative artwork.
- No horizontal overflow at 320, 375, 390, 768, 1024, 1440 or 1920 CSS pixels, in either colour scheme.
- No new runtime or UI dependencies, external fonts or third-party image hosts. Keep combined authored CSS below 10 kB gzipped and original SVG artwork below 30 kB.
- Normal text contrast >= 4.5:1; control/focus contrast >= 3:1. Touch targets >= 44 CSS pixels where practical. Respect reduced motion.
- Focus does not resize the input. All form modes, examples, error/retry/cancel, shortlist, dialog Escape, dismissal and image-failure states work without reload.
- Recommendation count may be zero, one or eight. Empty and single-result states must not leave broken compositions.
- Decorative illustration must never be presented as a verified product photograph. Affiliate disclosures precede shopping links.
- Generated guide builds preserve manually authored styles. Focused frontend tests and Worker deployment dry-run pass.

Visual quality is a judgement, not a measurable promise of perfection. The final review should state what was actually checked and distinguish synthetic browser fixtures from live provider testing.

## Completed review

- Rebuilt the homepage, recommendation presentation, guide directory, generated guides, legal-page mastheads and favicon around this direction.
- Reviewed real desktop and mobile screens. At 1440 x 900 the primary action ends at 872 CSS pixels; at 375 x 844 it ends at 826. Enabling the 65-pixel security-widget region below the action does not move it; token gating is unchanged. Large artwork follows the finder on mobile.
- Homepage and populated collection: no horizontal overflow at all seven specified widths, in both themes. Guide directory, two individual guides, about, privacy and 404: 60 additional layout checks.
- Both local font faces loaded. All three external SVG symbols rendered. A computed-style contrast check covered 160 rendered text nodes per theme without failures; automated tests also check shared text/focus tokens and fixed artwork palettes.
- Exercised empty validation, full example payloads, stable input geometry, both form modes, finite loading stages, duplicate-submit blocking, cancellation, timeout, retry and zero/one/eight-result states.
- Exercised save/remove, counts, dialog Escape and focus restoration, copying and copy failure, blocked storage, dismissal, feature promotion and the all-dismissed state. The dock is restricted to the collection; its visibility transitions have an executable state regression test.
- Verified product enrichment, identical image/shopping destinations, image failure and rejection of stale enrichment for a replaced collection. Concept-only cards have no pretend photographs.
- Combined authored CSS: 7,696 bytes gzipped. Original still-life: 6,094 bytes; motif sprite: 1,227 bytes. No new UI dependencies.
- Generated-page builds preserve authored stylesheet hashes. The 34 focused tests and Cloudflare Worker deployment dry-run pass.

Interaction checks used synthetic ideas/products and a locally disabled Turnstile challenge, not live AI or Amazon results. Existing token-gate regression tests cover security-token consumption and recovery. No deployment was performed. Production Core Web Vitals still require field measurement after deployment.
