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

**A warm British Christmas gift edit.** Concrete ideas, useful buying advice and cohesive photographic-style editorial imagery should demonstrate the service, rather than relying on abstract promises of thoughtfulness. The user explicitly approved the oxblood-and-ivory editorial proposal after rejecting the plain and forest split-screen proposals.

1. A recognisable serif wordmark, small Christmas star and restrained seasonal masthead.
2. Warm ivory, oxblood and pale blush, with a little antique gold. Fraunces uses restrained optical styling without the previous soft/wonky treatment; Figtree handles clear, comfortable interface text. Keep this approved light palette regardless of device theme; the automatic dark reinterpretation was rejected.
3. Ten self-hosted, AI-created editorial scenes: books, garden tools, a telescope, toys and hobby equipment. Rich natural light, tactile materials and identifiable objects replace the rejected line illustrations. Local responsive WebPs, not remote image services or runtime generation.
4. A compact photographic banner, followed by a centred, unboxed finder without a sample-collection sidebar. One clear prompt, small example-description buttons, a real submit button and a quieter guided alternative. Keep all existing controls, rather than inventing a separate quick-mode budget selector from the mockup. Privacy and disclosures remain accessible and accurate.
5. A featured typographic selection, a complementary adjacent idea, then lighter editorial entries. No giant placeholder boxes. AI-created category imagery is explicitly disclosed and separate from recommendation product imagery, which appears only when the existing verified-product pipeline provides it.
6. Useful animation only: short button/arrow transitions, a gentle first entrance and a legible curation sequence. No scroll hijacking, marquees, parallax or cursor effects.
7. Photographic guide starting points, substantial buying notes and related reading. Every page uses the same masthead and footer. The homepage is the shared-markup source; the page generator synchronizes the shell into generated and authored pages while preserving legal content and CSS.

## Implementation sequence

1. Build the art and page composition together; review desktop and mobile before polishing secondary components.
2. Refine concierge controls, examples, validation, waiting/cancellation and keyboard focus.
3. Recompose results, image enrichment, dismissal and shortlist states; preserve API and Turnstile contracts.
4. Carry the masthead and typography into generated guide pages and legal pages without overwriting authored CSS.
5. Review the real screens and iterate. Test behaviour and budgets separately.

## Acceptance criteria

- At 1440 x 900, headline, description input and submit action are visible without scrolling; the submit button should end before 850 CSS pixels. A compact photographic banner introduces the page without a decorative or sample sidebar.
- No horizontal overflow at 320, 375, 390, 768, 1024, 1440 or 1920 CSS pixels, in either colour scheme.
- No new runtime or UI dependencies, external fonts or third-party image hosts. Keep combined authored CSS below 10 kB gzipped. Editorial variants are 400 x 280, 800 x 560 and 1200 x 840, with respective per-image budgets of 35, 100 and 180 kB.
- Normal text contrast >= 4.5:1; control/focus contrast >= 3:1. Touch targets >= 44 CSS pixels where practical. Respect reduced motion.
- Focus does not resize the input. All form modes, examples, error/retry/cancel, shortlist, dialog Escape, dismissal and image-failure states work without reload.
- Recommendation count may be zero, one or eight. Empty and single-result states must not leave broken compositions.
- AI-created editorial scenes must never be presented as verified product photographs. Reserve image space, describe guide heroes, and avoid duplicated descriptions on decorative linked thumbnails. Affiliate disclosures precede shopping links.
- Generated guide builds preserve manually authored styles. Focused frontend tests and Worker deployment dry-run pass.

Visual quality is a judgement, not a measurable promise of perfection. The final review should state what was actually checked and distinguish synthetic browser fixtures from live provider testing.

## Initial redesign review evidence

- Reassessed desktop and mobile screenshots after implementation, then corrected SVG fill inheritance and simplified cramped mobile form labels. Reviewed the dark homepage, populated recommendations, illustrated directory and mobile guide composition again.
- Checked all 15 routes at 320, 375, 390, 768, 1024, 1440 and 1920 CSS pixels in both themes: 210 layout checks without horizontal overflow, clipped main headings or duplicate shared shells.
- A populated eight-idea collection also passed all 14 width/theme combinations. The saved-ideas dialog fits at 320 pixels, and the guided form has no overflow at 375 pixels.
- A computed-colour scan of all routes in both themes, plus a populated dark collection, checked 2,717 visible text elements without a text-contrast failure. The scan composites ancestor background colours and respects the large-text threshold; it is not a full accessibility certification.
- Both local font faces loaded. The homepage submit action ends at approximately 851 CSS pixels at 1440 x 900, and 762 at 375 x 844. The security-widget region remains below the action, with production token gating unchanged.
- Exercised zero/one/eight-idea responses, single-card layout, save, dismissal, featured-card promotion, all-dismissed messaging, dialog Escape and saved-idea navigation from a secondary page.
- Verified that example-description buttons switch to the quick description and fill it. Service errors remain visible, and cancelling a pending request preserves the description.
- Automated regressions cover the shared shell, all 80 buying notes, ten distinct guide illustrations, repeatable generation, countdown edge cases and validated shortlist counts. Existing frontend/API and Turnstile regressions remain part of validation.
- Final validation: all 282 tests pass with `npm test`; `npx wrangler deploy --dry-run` and `git diff --check` pass. The asynchronous frontend integration test now waits against a bounded deadline rather than a CPU-dependent loop count.
- No new runtime or UI dependencies, external fonts or image hosts. The active object sprite is 13,272 bytes; combined authored CSS is 8,502 bytes gzipped, below the 10 kB budget.

Interaction checks used browser-only synthetic ideas and a locally disabled Turnstile challenge, not live AI or Amazon results. No production configuration was relaxed and no deployment was performed. Production Core Web Vitals and live-provider behaviour still require post-deployment measurement; local screenshots and layout checks do not establish those results.

## Sidebar removal

Removed the sample collection and its desktop/mobile styles following design feedback. The finder now sits in a centred, 760-pixel maximum-width column; guide illustrations and the small description-prompt buttons remain. Verified the absence of the sidebar and horizontal overflow at all seven widths in both themes, checked the simplified desktop composition, and exercised mode switching and a description prompt. All 282 regression tests pass. Production Turnstile settings remain unchanged; local challenge rejection is not a live-service failure.

## Artwork refinement

The production guide directory was inspected in the browser, and hashes confirmed that the live illustration sprite, favicon, social image and touch icon matched the sources before editing. The older red social assets were inconsistent with the current site palette.

Reworked all ten active guide scenes with recognisable silhouettes, material details and more specific subject matter: telescope and star chart; garden tools and watering can; toy train and blocks; teddy bear and picture book; museum and map; cafetiere and teapot; reading glasses and books; and distinct family and Secret Santa arrangements. Decorative gifts remain illustrations, never substitute product photos. No new homepage section was added.

The social preview now uses the current forest, parchment and sage palette, with a large readable headline and a gift still life. Its editable SVG and the home-screen icon source are rasterised by `npm run build:images`; Sharp is a build-only dependency. The favicon has a deliberately simplified gift silhouette for small sizes. Guide hero illustrations have descriptive accessible labels, while repeated directory scenes remain decorative.

Image tests render every scene at 160 x 112, check clear edges, validate all internal references and category objects, and verify social/icon dimensions, palettes and size budgets. These checks complement browser screenshots; they do not prove subjective visual quality or that every visitor will interpret an illustration identically.

Verification for this iteration: all 286 tests pass; 96 browser layout checks cover the homepage, directory and ten guides at four widths in both themes. Reviewed the interest and family artwork together, all three compact mobile homepage tiles, the mobile astronomy hero and the Secret Santa illustration. The sprite is 25,716 bytes (6,709 gzipped), the social PNG is 85,464 bytes and the touch icon is 7,064 bytes. The Worker deployment dry-run passes; no recommendation or Turnstile behaviour was changed.

## Approved photographic replacement

The SVG scene refinements above were subsequently rejected. The ten approved photographic-style images now replace content illustrations on the homepage, directory, guide heroes and related guides. Optimised 1400 x 980 WebP masters are retained in `assets/editorial/`; `npm run build:images` produces 30 responsive variants totalling 1,673,410 bytes. The largest is 149,030 bytes. Original image generation is not part of the build.

The existing page structure, colours, typography and finder behaviour are retained. The brand mark, favicon and social graphic remain purpose-made brand artwork. Editorial images are disclosed as AI-created inspiration, never evidence of a reviewed product. The image tests cover every responsive source, dimensions, budgets, accessible descriptions and disclosure; the full 286-test suite and deployment dry-run pass.

At this stage the overall website mockups were proposals only. Neither the original plain design nor the richer heritage proposal was approved; the subsequent forest split-screen was rejected as worse. Approval of category imagery was not treated as design approval.

## Approved oxblood-and-ivory design

The user subsequently approved the new oxblood-and-ivory editorial proposal with "Yes — implement this design". This implementation preserves the ten approved category photographs and existing finder functionality. A new AI-created Christmas still life supplies the photographic banner and sharing image. The banner has three responsive variants (29,448 / 67,910 / 121,448 bytes); it is prioritised, while category thumbnails remain lazy-loaded. The sharing PNG is 210,774 bytes; the star touch icon is 4,419 bytes.

The masthead, compact footer, guide articles, directory, recommendation states, shortlist and legal pages share the new palette and star identity. Photographs are unframed rather than sitting inside the old sage/oat/clay illustration mattes. The banner was made more compact than the mockup so the primary action remains prominent. Privacy, affiliate and AI-imagery disclosures remain explicit; the recommendation pipeline, provider configuration, production Turnstile and product verification logic are unchanged.

The image build remains deterministic from local masters and SVG brand sources. The full 287-test suite and deployment dry-run pass. Browser interaction checks use isolated synthetic responses and a loopback-only fixture with Turnstile disabled in the served copy; this does not certify live AI/provider behaviour or change production protection.

Final browser review covered 15 routes at seven widths in both themes (210 checks), with actual viewport dimensions asserted, loaded images and no horizontal overflow or clipped main headings. A populated eight-idea collection passed another 14 width/theme combinations. The submit button ends at 816 CSS pixels on a 1440-pixel desktop and 740 on a 375-pixel mobile screen. A screenshot review caught the mobile headline reaching into the presents; the image now anchors left on mobile, keeping the lettering on the empty linen. Combined authored CSS is 7,961 bytes gzipped.

Checked quick/guided validation, example mode switching, zero/one/eight-idea states, saving, dismissal and featured-card promotion, all-dismissed messaging, dialog Done and Escape, error/retry visibility, input preservation, waiting/cancellation and a shortlist opened from a guide. Pointer activation and validation focus were rechecked at mobile width. A rendered-colour scan of the populated page checked 279 text elements across both themes without a contrast failure; this complements token tests rather than constituting accessibility certification.

## Preserving the approved appearance in dark-mode browsers

The user rejected the automatic dark variant because its red/pink treatment no longer resembled the approved mockup. Removed the dark palette rather than inventing another unapproved interpretation. The shared stylesheet and every page now declare `color-scheme: only light`; the browser theme colour is always ivory. The approved imagery, layout and burgundy accents are unchanged. Continue checking both system preferences, but expect the same light appearance under each.
