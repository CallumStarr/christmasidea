# Website, Android and iOS audit

## Cross-platform implementation

The shared website logic and native bridge were inspected under the repository's
cross-platform policy. Applicable storage, calendar, request, constraint and deck
fixes are made in authoritative shared source. `npm run app:sync` rebuilt
`mobile/www` and copied assets/configuration into **both** native projects.
That is source/bundle preparation, not distribution to installed users.

## Evidence by validation level

| Level | Website/browser | Android | iOS |
|---|---|---|---|
| Source inspection | Shared DOM/storage/deck/API/commerce paths | Manifest, configuration, bridge, plugins, build resources | Plist, Swift app delegates, Xcode/SPM configuration |
| Shared regression tests | Passed | Same shared tests; not native execution | Same shared tests; not WebKit certification |
| Browser UI | Local synthetic finder/deck/wishlist flows; responsive and axe checks | App browser composition checked, not Android WebView | App browser composition does not test iOS |
| Bundle generation | Page generation passed | Capacitor sync passed | Capacitor sync passed |
| Native compilation | Not applicable | Debug APK build passed with JDK21/SDK36 | Blocked: Windows has no Xcode/iOS compiler |
| Device/emulator | Integrated Chromium only | `adb devices` returned no devices | No device testing |
| Signing/store/distribution | No deployment | Debug signing only; no release AAB/store upload | No archive/signing/TestFlight/App Store submission |

Android initially failed because SDK location was unset, then because the selected
compiler did not support Java21. A checksum-verified official Temurin21 archive was
provisioned in the isolated session tool directory; only command-local `JAVA_HOME`
and `ANDROID_HOME` were changed. The synchronized build then succeeded. This
does not validate release signing, Play Data Safety or runtime permissions on a
physical device.

Native lint subsequently found `windowLightNavigationBar` (API27) in the API24
base theme. SH-022 moves cream navigation/dark icons into `values-v27` using a
shared base style. API24-26 retain platform navigation defaults; the minimum SDK
and branding on supported newer devices are unchanged. A subsequent
[individual warning review](ANDROID_WARNING_REVIEW.md) corrected manifest
permission order and added explicit cloud-backup rules without restricting
existing device-transfer defaults. `assembleDebug`, `lintDebug` and
`testDebugUnitTest` then passed: **zero lint errors, 30 warnings**, and three
unit tests (one example and two manifest-policy checks). Remaining warnings
concern dependencies and generated/template/icon/splash resources; none was
hidden with a lint baseline or suppression.

Final SHA256 comparisons matched **all 107 shared bundle files** against both
native project copies and the debug APK's packaged web assets. The final APK is
8,299,483 bytes with SHA256
`251d13b2092bb270c21149b36a82ef83ef4172ccab9a92b7801ee2d834ea87e3`.
This establishes which web bundle was packaged, not a scan of all compiled native
code or proof of installation/distribution.

## Controls and defects

- Android opts out of cloud backup and cleartext traffic. On some Android 12+
  devices, device-to-device transfer may still occur; its policy and actual
  backup/restore behavior were not device-tested. The app does not request
  camera, location or contacts permissions in the inspected configuration.
- Hosted native verification validates both message origin and exact frame
  window. Only the verification page is frameable by the two configured native
  origins. Native `localhost` origins are not valid Siteverify challenge hostnames.
- Inspected shared source uses safe text/DOM construction on the exercised paths.
  Native navigation and external shopping are bridge responsibilities, not
  arbitrary remote-page access to the app's bundled JavaScript.
- Corrupt wishlist data, stale share decoding, swipe/card races and incorrect
  future Black Friday dates were reproduced and fixed in shared source.
- Normal calendar generation folds UTF-8 lines at the required octet boundary;
  UID newline injection now rejects. Actual Apple/Google/Outlook import checks
  remain unperformed.
- Native tests include the example arithmetic/package-identity checks and
  source-level manifest-policy checks; they are not evidence of comprehensive
  native security, backup transport or product-flow coverage.

## Before native release

Test minimum iOS16.4 WebKit and current iOS, Android minimum/current targets,
real Turnstile escalation/renewal, safe areas, keyboard, large text, orientations,
process death, offline reopening, back navigation, shopping return, share
cancellation, clipboard failure and TalkBack/VoiceOver. Review actual SDK data
processing against store declarations, including third-party connections.

Old installed clients remain supported: API shapes are additive, legacy
action-less Turnstile and legacy unsigned/pre-upgrade receipt paths remain
compatible. Current browser and hosted-native verification widgets explicitly
label the fixed `ideas` action; both actual sources are executed in VM regressions.
Consequently product receipts are incremental integrity protection,
not mandatory authentication of every direct product caller. Never claim an
existing installed APK contains these source changes.
