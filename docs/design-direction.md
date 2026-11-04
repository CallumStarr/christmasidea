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

**A warm British Christmas gift edit.** Concrete ideas, useful buying advice and a recognisable illustrated vocabulary should demonstrate the service, rather than relying on abstract promises of thoughtfulness.

1. A recognisable wordmark, botanical maker's mark and restrained seasonal masthead.
2. Warm parchment, deep forest, aged gold and a little terracotta. Fraunces is expressive, not indiscriminately enormous; Figtree handles clear, comfortable interface text.
3. Original, self-hosted SVG object illustrations: books, garden snips, a coffee flask, toys and hobby equipment. Ten distinct guide scenes and one example collection share the same ink-and-paper vocabulary. No gradients, stock-image dependencies, canvas loops or 3D libraries.
4. A compact finder beside an explicitly labelled example collection. Show how a description becomes ideas, without pretending that illustrations are product listings. One clear prompt, working examples, a real submit button and a quieter guided alternative. Privacy and disclosures remain accessible and explicit.
5. A featured typographic selection, a complementary adjacent idea, then lighter editorial entries. No invented photographs or giant placeholder boxes. Product imagery appears only when the existing verified-product pipeline provides it.
6. Useful animation only: short button/arrow transitions, a gentle first entrance and a legible curation sequence. No scroll hijacking, marquees, parallax or cursor effects.
7. Illustrated guide starting points, substantial buying notes and related reading. Every page uses the same masthead and footer. The homepage is the shared-markup source; the page generator synchronizes the shell into generated and authored pages while preserving legal content and CSS.

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

## Review evidence

- Reassessed desktop and mobile screenshots after implementation, then corrected SVG fill inheritance and simplified cramped mobile form labels. Reviewed the dark homepage, populated recommendations, illustrated directory and mobile guide composition again.
- Checked all 15 routes at 320, 375, 390, 768, 1024, 1440 and 1920 CSS pixels in both themes: 210 layout checks without horizontal overflow, clipped main headings or duplicate shared shells.
- A populated eight-idea collection also passed all 14 width/theme combinations. The saved-ideas dialog fits at 320 pixels, and the guided form has no overflow at 375 pixels.
- A computed-colour scan of all routes in both themes, plus a populated dark collection, checked 2,717 visible text elements without a text-contrast failure. The scan composites ancestor background colours and respects the large-text threshold; it is not a full accessibility certification.
- Both local font faces loaded. The homepage submit action ends at approximately 851 CSS pixels at 1440 x 900, and 762 at 375 x 844. The security-widget region remains below the action, with production token gating unchanged.
- Exercised zero/one/eight-idea responses, single-card layout, save, dismissal, featured-card promotion, all-dismissed messaging, dialog Escape and saved-idea navigation from a secondary page.
- Verified that trying the illustrated example from guided mode switches to the quick description and fills it. Service errors remain visible, and cancelling a pending request preserves the description.
- Automated regressions cover the shared shell, all 80 buying notes, ten distinct guide illustrations, repeatable generation, countdown edge cases and validated shortlist counts. Existing frontend/API and Turnstile regressions remain part of validation.
- Final validation: all 282 tests pass with `npm test`; `npx wrangler deploy --dry-run` and `git diff --check` pass. The asynchronous frontend integration test now waits against a bounded deadline rather than a CPU-dependent loop count.
- No new runtime or UI dependencies, external fonts or image hosts. The active object sprite is 13,272 bytes; combined authored CSS is 8,502 bytes gzipped, below the 10 kB budget.

Interaction checks used browser-only synthetic ideas and a locally disabled Turnstile challenge, not live AI or Amazon results. No production configuration was relaxed and no deployment was performed. Production Core Web Vitals and live-provider behaviour still require post-deployment measurement; local screenshots and layout checks do not establish those results.
