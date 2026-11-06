# Accessibility verification and outstanding manual tests

Assessment date: 6 November 2026. **WCAG 2.2 AA conformance is not
established.** This log challenges the earlier
[55-criterion matrix](wcag-matrix.csv): its 28 `Partial`, 20 `Not tested` and
7 `Not applicable` records do not become passes because an automated scan
ran. All 48 potentially applicable criteria still need criterion-specific
manual review, including across responsive states and native apps. The seven
existing N/A decisions require reassessment whenever content or functionality
changes.

## Environment and test limits

Tests used a local browser against actual shared frontend files and a synthetic
API fixture. Requests to external services were blocked; no real user data,
model output, purchase, Turnstile challenge, Android WebView or iOS WebKit was
used. Keyboard operations were sent through browser automation and observed;
they are **not** an independent human or assistive-technology audit. Prior
automated scans on 18 pages had incomplete contrast checks.

No NVDA installation was found at standard Windows locations, no Android
device was attached, and VoiceOver, TalkBack and users with disabilities were
unavailable. The absence of NVDA at those locations is not a definitive
inventory of every accessible Windows installation.

## Actual test log

| Test | Observed outcome | Classification and remaining work |
|---|---|---|
| Skip link and keyboard entry | Tab reached “Skip to the gift finder”; Enter moved focus to `#form`. Subsequent Tab order reached the mode radio, description, three examples and “Find ideas”. | Partially verified for this local path; manually check all pages, focus visibility and combinations. |
| Empty form and error | Empty submission displayed a descriptive error, focused the description, and associated it with `aria-describedby`; the status exposed `role=status` and `aria-live=polite`. | Partially verified. Verify actual spoken announcement and correction on NVDA, VoiceOver and TalkBack. |
| Dynamic recommendation result | A synthetic response created eight ideas, moved focus to `#cards` and exposed `0 explored · 8 ready` in the status. | Partially verified. Actual speech, interruption, repeated updates and delayed/failed AI responses were not observed. |
| Detail dialog and focus | Keyboard opened the detail dialog; focus entered the close control. Eight Tab presses stayed inside. Shift+Tab then Enter on “Back to the gift” closed it and restored focus to the originating details button. | Partially verified for this dialog and fixture. Verify reverse navigation, long content, other dialogs, AT interaction and mobile. |
| Escape from modal | Automated Escape did not close the app dialog; a plain control `<dialog>` in the same page also received no native `cancel` event from this tool's Escape input. | **Inconclusive**, not a confirmed application defect. A human with a physical keyboard must retest Escape and the browser's native dialog behavior. |
| Swipe alternative and targets | At a 320 CSS-pixel viewport, tested deck action buttons measured 64 × 80 CSS pixels and were on screen. Button activation provided a non-swipe alternative. | Partially verified for those controls only; test physical touch, all other controls, spacing and 2.5.8 exceptions. |
| Reduced motion | With reduced-motion emulation, programmatic button activation advanced the deck immediately from `0 explored · 8 ready` to `1 explored · 7 ready`. | Partially verified for this interaction; inspect all animations and real OS settings. |
| Reflow | Tested result state had no horizontal overflow at viewport widths of 640 and 320 CSS pixels. | Partially verified. These are viewport approximations, **not** actual browser zoom; test 200% text resize, 400% browser zoom, portrait/landscape and all content. |
| Colour contrast | One primary button's observed text/background pair, `rgb(251,247,240)` on `rgb(109,16,40)`, measured **11.20:1**. | Partially verified for this pair only. Measure all text, focus indicators, icons and states, including non-text contrast. |
| Animation while hidden | In this automation environment, normal-motion animation paused while the page was hidden and completed when visible again. | Inconclusive for background lifecycle and not evidence of a deck defect. Exercise visibility changes manually on desktop and devices. |
| NVDA, VoiceOver, TalkBack | No screen-reader output was observed. | **Blocked**: run the scenarios below with real AT and record versions, steps, speech and outcomes. |

The fixture's synthetic shopping data did not include the expected `query`
field, so a displayed `undefined` search term during fixture-only navigation
was a test-fixture limitation and is not reported as an application defect.

## Manual WCAG review coverage still required

The groups below enumerate all 48 potentially applicable rows in the existing
matrix. A reviewer must assess each against the applicable WCAG definition,
not assume that one example establishes the whole criterion.

| Review and required manual method | Criteria |
|---|---|
| Meaningful alternatives, reading/DOM order, semantics, orientation, input purpose, page titles, link purpose, navigation, headings, language, consistency and help. Use a screen reader and inspect representative pages and states. | 1.1.1, 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.3.5, 2.4.2, 2.4.4, 2.4.5, 2.4.6, 3.1.1, 3.1.2, 3.2.3, 3.2.4, 3.2.6 |
| Colour-independent meaning, all text and non-text contrast, actual text enlargement/zoom/reflow, text spacing, hover/focus content and visible, unobscured focus. Inspect normal, hover, error, disabled, modal and high-contrast states. | 1.4.1, 1.4.3, 1.4.4, 1.4.5, 1.4.10, 1.4.11, 1.4.12, 1.4.13, 2.4.7, 2.4.11 |
| Complete keyboard access, no trap, shortcut behavior, timing, animation, flashing, skip navigation, focus order and unexpected context changes. Include physical Escape and native keyboard navigation. | 2.1.1, 2.1.2, 2.1.4, 2.2.1, 2.2.2, 2.3.1, 2.4.1, 2.4.3, 3.2.1, 3.2.2 |
| Touch and pointer alternatives, cancellation, visible-name matching, dragging alternatives and target sizes. Use real touch devices and voice control where possible. | 2.5.1, 2.5.2, 2.5.3, 2.5.7, 2.5.8 |
| Error identification, labels, suggestions, relevant transaction safeguards, redundant entry, accessible authentication/challenge applicability, names/roles/values and live status. Test all invalid, expired, failed, loading and success states with AT. | 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.7, 3.3.8, 4.1.2, 4.1.3 |

The prior matrix marks 1.2.1–1.2.5 N/A because no relevant prerecorded or live
media was found, 1.4.2 N/A because no automatic audio was found, and 2.5.4 N/A
because no device-motion input was found. These are scoped observations, not
permanent exclusions. Criterion 3.3.4's applicability to this app's own
transactions needs review; wishlists alone are not proof that the criterion
applies. There is no app account login, but Turnstile can still present an
accessibility barrier even if 3.3.8 is ultimately found not applicable.

## Required external test protocol

**Owner: accessibility specialist and product operator.**

1. On Windows, record browser and NVDA versions. Navigate from page load using
   keyboard only; check landmarks, labels, errors, result updates, dialog
   entry/trap/Escape/close and focus restoration. Record exact spoken output.
2. On current and minimum-supported iOS, use VoiceOver with Safari and the
   actual app. Repeat form, challenge, recommendations, modal, share,
   clipboard, return navigation, large text, orientation and reduced motion.
3. On minimum/current Android devices, use TalkBack in Chrome and the actual
   app. Repeat those flows, plus physical swipe alternatives, touch targets,
   back behavior and challenge completion.
4. Test desktop browser zoom at 200% and 400%, text-only resize and custom
   spacing; inspect all states for clipped or hidden content and focus.
   Measure contrast for every meaningful state, including focus and icons.
5. Include disabled users in moderated testing where feasible, document
   assistive technology/settings and severity, fix confirmed failures, and
   retest. Record unavailable combinations as **Blocked**, never passed.
