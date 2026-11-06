# Cross-platform change policy

## Default scope

- Treat website changes as changes for the website, iOS app and Android app unless the user explicitly limits the scope. This includes recommendation quality, features, bug fixes, styling, content, accessibility, privacy and security.
- Reuse shared source and services rather than implementing independent versions. Preserve equivalent functionality and a coherent visual identity while respecting native interaction patterns, safe areas and device capabilities.
- If a change appears unsuitable for one or more platforms and the user has not explicitly specified an exception, ask the user to confirm the intended scope before omitting, disabling or substituting it on any platform. Do not silently assume a website-only exception. Preserve existing intentional platform differences unless the requested change affects them; ask when their applicability is uncertain.

## Implementation and release

- Assess all three platforms for every applicable change, including shared backend logic, API contracts, bundled web assets, app-specific overrides and native bridges. Keep existing installed clients compatible with backend changes, or explicitly coordinate a required client upgrade.
- Recommendation-engine changes in the deployed shared Worker apply to requests from all platforms. Changes to bundled frontend code, assets, local data or native code require rebuilt and distributed app versions; deploying the website alone does not update installed apps.
- After applicable shared frontend changes, run `npm run app:sync` to build the shared assets and sync both native projects. Do not manually patch generated bundles instead of their source. Build and validate affected native targets where the required tools are available.
- Use focused existing tests and check affected website and app flows. An app browser preview is not a substitute for native-device testing. Report any unavailable checks explicitly; iOS compilation and signing require a Mac with Xcode.
- Do not describe a change as shipped on all platforms until the backend/site deployment and any required native builds, signing, distribution and installation/update steps are complete. State separately what is implemented, tested, deployed and awaiting release. Never claim an existing APK includes changes made after it was built.
- Do not bypass signing, store review, security checks or release authorisation to achieve parity. If credentials, hardware or distribution access are unavailable, complete the safe implementation work and clearly identify the remaining release steps.

See [README: cross-platform updates](README.md#cross-platform-updates) and [native build instructions](README.md#iphone-and-android-app).
