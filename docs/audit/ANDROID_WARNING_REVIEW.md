# Android lint warning review

Review date: 2026-11-06. The original `:app:lintDebug` text report contained
**0 errors and 32 warnings**. Its XML identifies the tool as **lint 8.13.0**;
the HTML also reported 32 warnings. The original intermediate and published
text reports were byte-identical. The earlier `android-lint.log` recorded one
separate `NewApi` error plus these 32 warnings; `android-verified.log` recorded
the subsequent successful lint after the already-dirty theme fix. That prior
theme change was not altered by this review.

The original text, XML and HTML reports were preserved before rerunning lint as
`android-warning-review-original.txt`, `.xml` and `.html` in the session files
directory. The baseline manifest was preserved there as
`android-warning-review-original-manifest.xml`. Paths below are relative to
`C:\Christmas_List2\christmasidea`; a file/directory without a line number is
exactly how lint located that instance. The wrapper belongs to the Android root
project; the remaining locations belong to `:app`. All instances were reported by
Android Lint 8.13.0 at severity **Warning**; the impact labels below are this
review's assessment, not changes to lint severity.

## Individual original warnings

Each row records the original message verbatim, not a paraphrase. “Deferred”
means a genuine or possible issue needs a separate owner-approved investigation
or design decision; it does not mean the warning was suppressed.

| # | Module; original file/line | Issue ID | Tool / severity | Exact original warning text | Impact; remediation needed | Action, rationale and post-change outcome |
|---|---|---|---|---|---|---|
| 1 | `:app`; `android\app\src\main\AndroidManifest.xml:41` | `ManifestOrder` | Lint 8.13.0 / Warning | `<uses-permission> tag appears after <application> tag` | Low correctness/compatibility; yes | **Resolved.** Moved the existing INTERNET permission before `application`; source comparison and APK inspection verify the permission and other original declarations remain. |
| 2 | Android root `:`; `android\gradle\wrapper\gradle-wrapper.properties:3` | `AndroidGradlePluginVersion` | Lint 8.13.0 / Warning | `A newer version of Gradle than 8.14.3 is available: 8.14.6` | Low maintenance; no immediate change | **Remains.** A newer release alone is not a demonstrated defect; dependency/tool upgrades are explicitly outside this task. |
| 3 | `:app`; `android\app\build.gradle:35` | `GradleDependency` | Lint 8.13.0 / Warning | `A newer version of androidx.appcompat:appcompat than 1.7.1 is available: 1.8.0` | Low maintenance; no immediate change | **Remains.** No vulnerability or compatibility failure is established by this version notice; review upgrades separately. |
| 4 | `:app`; `android\app\src\main\AndroidManifest.xml:5` | `DataExtractionRules` | Lint 8.13.0 / Warning | `The attribute android:allowBackup is deprecated from Android 12 and higher and may be removed in future versions. Consider adding the attribute android:dataExtractionRules specifying an @xml resource which configures cloud backups and device transfers on Android 12 and higher.` | Medium privacy/policy; yes | **Lint warning resolved, with an important limitation.** Added explicit cloud exclusions and a legacy fallback while retaining `allowBackup="false"`; no device-transfer restriction was added. Some Android 12+ manufacturers may still transfer app data device-to-device. Product/privacy owners must decide that policy; no transfer was tested. |
| 5 | `:app`; `android\app\src\main\res\drawable-v24` (directory; no line) | `ObsoleteSdkInt` | Lint 8.13.0 / Warning | `This folder configuration (v24) is unnecessary; minSdkVersion is 24. Merge all the resources in this folder into drawable.` | Low maintainability; no immediate change | **Remains.** The qualifier is redundant at API 24, but its template vector is also reported unused; moving generated/template resources provides no demonstrated user benefit and is outside scope. |
| 6 | `:app`; `android\app\src\main\res\layout\activity_main.xml:2` | `UnusedResources` | Lint 8.13.0 / Warning | `The resource R.layout.activity_main appears to be unused` | Low size; no immediate change | **Remains.** The app's `MainActivity` extends `BridgeActivity`, which selects Capacitor's layout; this looks like a template layout, but removal and dynamic/plugin compatibility were not established as necessary. |
| 7 | `:app`; `android\app\src\main\res\xml\config.xml:2` | `UnusedResources` | Lint 8.13.0 / Warning | `The resource R.xml.config appears to be unused` | False positive for dynamic use; runtime compatibility risk if removed | **Remains.** This ignored, generated Cordova configuration is packaged. Capacitor calls `ConfigXmlParser.parse`, whose framework bytecode looks up `config` as `xml` and calls `getXml`; do not remove it. |
| 8 | `:app`; `android\app\src\main\res\drawable\ic_launcher_background.xml:2` | `UnusedResources` | Lint 8.13.0 / Warning | `The resource R.drawable.ic_launcher_background appears to be unused` | Low size; no immediate change | **Remains.** The adaptive icons use the distinct `@color/ic_launcher_background`, not this template drawable. No justified modification of template resources. |
| 9 | `:app`; `android\app\src\main\res\drawable-v24\ic_launcher_foreground.xml:1` | `UnusedResources` | Lint 8.13.0 / Warning | `The resource R.drawable.ic_launcher_foreground appears to be unused` | Low size; no immediate change | **Remains.** The active adaptive/splash references are to the distinct `@mipmap/ic_launcher_foreground`; the template drawable is left untouched. |
| 10 | `:app`; `android\app\src\main\res\values\strings.xml:5` | `UnusedResources` | Lint 8.13.0 / Warning | `The resource R.string.package_name appears to be unused` | Low size; no immediate change | **Remains.** No static app reference was found, but template/plugin or dynamic references have not been exhaustively ruled out; do not remove for negligible savings. |
| 11 | `:app`; `android\app\src\main\res\values\strings.xml:6` | `UnusedResources` | Lint 8.13.0 / Warning | `The resource R.string.custom_url_scheme appears to be unused` | Low size; no immediate change | **Remains.** No static app reference was found; retain the template/plugin contract pending a dedicated compatibility review. |
| 12 | `:app`; `android\app\src\main\res\mipmap-hdpi\ic_launcher.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icons should not fill every pixel of their square region; see the design guide for details` | Low usability; yes, deferred | **Remains.** The generated 72×72 hdpi image is an opaque square. A silhouette change requires approved branding and launcher/device review. |
| 13 | `:app`; `android\app\src\main\res\mipmap-mdpi\ic_launcher.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icons should not fill every pixel of their square region; see the design guide for details` | Low usability; yes, deferred | **Remains.** The generated 48×48 mdpi image is an opaque square; preserve the current brand pending design review. |
| 14 | `:app`; `android\app\src\main\res\mipmap-xhdpi\ic_launcher.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icons should not fill every pixel of their square region; see the design guide for details` | Low usability; yes, deferred | **Remains.** The generated 96×96 xhdpi image is an opaque square; do not alter branded output here. |
| 15 | `:app`; `android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icons should not fill every pixel of their square region; see the design guide for details` | Low usability; yes, deferred | **Remains.** The generated 144×144 xxhdpi image is an opaque square; redesign needs approval. |
| 16 | `:app`; `android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icons should not fill every pixel of their square region; see the design guide for details` | Low usability; yes, deferred | **Remains.** The generated 192×192 xxxhdpi image is an opaque square; redesign needs approval. |
| 17 | `:app`; `android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icon used as round icon did not have a circular shape` | Low usability; yes, deferred | **Remains.** The 72×72 hdpi round file is byte-identical to the square icon; a circular design is a branding decision. |
| 18 | `:app`; `android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icon used as round icon did not have a circular shape` | Low usability; yes, deferred | **Remains.** The 48×48 mdpi round file is identical to its square counterpart; preserve it pending design review. |
| 19 | `:app`; `android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icon used as round icon did not have a circular shape` | Low usability; yes, deferred | **Remains.** The 96×96 xhdpi round file is identical to its square counterpart; no brand change was authorized. |
| 20 | `:app`; `android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icon used as round icon did not have a circular shape` | Low usability; yes, deferred | **Remains.** The 144×144 xxhdpi round file is identical to its square counterpart; defer visual changes. |
| 21 | `:app`; `android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png` (file; no line) | `IconLauncherShape` | Lint 8.13.0 / Warning | `Launcher icon used as round icon did not have a circular shape` | Low usability; yes, deferred | **Remains.** The 192×192 xxxhdpi round file is identical to its square counterpart; defer visual changes. |
| 22 | `:app`; `android\app\src\main\res\mipmap-anydpi-v26\ic_launcher.xml:2` | `MonochromeLauncherIcon` | Lint 8.13.0 / Warning | `The application adaptive icon is missing a monochrome tag` | Low usability; yes, deferred | **Remains.** No monochrome layer is declared, so launchers requiring one may not show a themed icon. A suitable brand-approved asset and device checks are needed. |
| 23 | `:app`; `android\app\src\main\res\mipmap-anydpi-v26\ic_launcher_round.xml:2` | `MonochromeLauncherIcon` | Lint 8.13.0 / Warning | `The application adaptive roundIcon is missing a monochrome tag` | Low usability; yes, deferred | **Remains.** The round adaptive definition likewise has no monochrome layer; do not substitute a guessed brand asset. |
| 24 | `:app`; `android\app\src\main\res\drawable-land-xxxhdpi\splash.png` (file; no line) | `IconDipSize` | Lint 8.13.0 / Warning | `The image splash.png varies significantly in its density-independent (dip) size across the various density versions: drawable-land-hdpi/splash.png: 683x683 dp (1024x1024 px), drawable-land-mdpi/splash.png: 1024x1024 dp (1024x1024 px), drawable-land-xhdpi/splash.png: 512x512 dp (1024x1024 px), drawable-land-xxhdpi/splash.png: 341x341 dp (1024x1024 px), drawable-land-xxxhdpi/splash.png: 256x256 dp (1024x1024 px)` | Potential usability/scaling; investigate before changing | **Remains.** All landscape density files contain the same 1024×1024 generated image; actual landscape rendering across densities was not device-tested. |
| 25 | `:app`; `android\app\src\main\res\drawable-port-xxxhdpi\splash.png` (file; no line) | `IconDipSize` | Lint 8.13.0 / Warning | `The image splash.png varies significantly in its density-independent (dip) size across the various density versions: drawable-port-hdpi/splash.png: 683x683 dp (1024x1024 px), drawable-port-mdpi/splash.png: 1024x1024 dp (1024x1024 px), drawable-port-xhdpi/splash.png: 512x512 dp (1024x1024 px), drawable-port-xxhdpi/splash.png: 341x341 dp (1024x1024 px), drawable-port-xxxhdpi/splash.png: 256x256 dp (1024x1024 px)` | Potential usability/scaling; investigate before changing | **Remains.** The portrait density files are also identical 1024×1024 generated images; actual portrait rendering was not device-tested. |
| 26 | `:app`; `android\app\src\main\res\drawable\splash.png` (file; no line) | `IconDuplicatesConfig` | Lint 8.13.0 / Warning | `The splash.png icon has identical contents in the following configuration folders: drawable-land-hdpi, drawable-land-mdpi, drawable-land-xhdpi, drawable-land-xxhdpi, drawable-land-xxxhdpi, drawable-port-hdpi, drawable-port-mdpi, drawable-port-xhdpi, drawable-port-xxhdpi, drawable-port-xxxhdpi, drawable` | Low potential size overhead; no immediate change | **Remains.** Hashes confirm all 11 generated files are identical; no measured package saving or safe configuration/visual equivalence justifies changing them. |
| 27 | `:app`; `android\app\src\main\res\drawable\splash.png` (file; no line) | `IconLocation` | Lint 8.13.0 / Warning | `Found bitmap drawable res/drawable/splash.png in densityless folder` | Potential density scaling; investigate before changing | **Remains.** The theme references this generated bitmap; moving it to a density-qualified or `nodpi` folder could change scaling and needs device/branding review. |
| 28 | `:app`; `android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png` (file; no line) | `IconDuplicates` | Lint 8.13.0 / Warning | `The following unrelated icon files have identical contents: ic_launcher.png, ic_launcher_round.png` | Low size/usability; no immediate change | **Remains.** The hdpi pair is identical by hash and generated deliberately; consolidating resources or changing shape is not necessary for this scoped fix. |
| 29 | `:app`; `android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png` (file; no line) | `IconDuplicates` | Lint 8.13.0 / Warning | `The following unrelated icon files have identical contents: ic_launcher.png, ic_launcher_round.png` | Low size/usability; no immediate change | **Remains.** The mdpi pair is identical by hash; retain both launcher names pending design review. |
| 30 | `:app`; `android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png` (file; no line) | `IconDuplicates` | Lint 8.13.0 / Warning | `The following unrelated icon files have identical contents: ic_launcher.png, ic_launcher_round.png` | Low size/usability; no immediate change | **Remains.** The xhdpi pair is identical by hash; preserve generated branded resources. |
| 31 | `:app`; `android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png` (file; no line) | `IconDuplicates` | Lint 8.13.0 / Warning | `The following unrelated icon files have identical contents: ic_launcher.png, ic_launcher_round.png` | Low size/usability; no immediate change | **Remains.** The xxhdpi pair is identical by hash; preserve generated branded resources. |
| 32 | `:app`; `android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png` (file; no line) | `IconDuplicates` | Lint 8.13.0 / Warning | `The following unrelated icon files have identical contents: ic_launcher.png, ic_launcher_round.png` | Low size/usability; no immediate change | **Remains.** The xxxhdpi pair is identical by hash; preserve generated branded resources. |

The icon conclusions were cross-checked against `scripts\build-mobile-icons.mjs`:
it flattens both launcher names identically and writes identical 1024×1024
splash images. PNG dimensions, color types and SHA-256 equality were checked
independently. The splash warnings' XML secondary locations cover all five
densities per orientation, and all 11 configurations for the duplicate warning.
No generated/copied vendor resource or branded image was edited.

## Backup-policy details and limits

The original manifest already set `android:allowBackup="false"`. On Android 11
and lower that opts out of backup; the empty `legacy_backup_rules.xml` leaves
the prior default file-selection rules unchanged. On Android 12+, the new
`data_extraction_rules.xml` explicitly excludes all nine documented
credential/device-protected and app-specific external domains from **cloud**
backup. It deliberately omits a `device-transfer` section: Android's default
transfer selection remains unrestricted when an OEM permits transfer despite
`allowBackup="false"`. This avoids silently making existing local wishlists
untransferable on such devices; it does **not** establish that transfers are
disabled or that app data is recoverable. The exclusions do not delete data.

See Android's [Auto Backup documentation](https://developer.android.com/identity/data/autobackup),
especially its OEM caveat, XML syntax and missing-section defaults. The
privacy/product owner should decide whether device transfers should be allowed
or restricted, considering both confidentiality and locally stored wishlist
recovery. No Android device or emulator was connected, and no backup, restore,
OEM-specific transfer or cross-platform transfer was exercised.

## Post-change verification

With the requested command-local `ANDROID_HOME` and `JAVA_HOME`, ran:

```powershell
.\android\gradlew.bat -p android assembleDebug :app:lintDebug :app:testDebugUnitTest --console=plain --no-daemon
```

Result: **BUILD SUCCESSFUL**, 0 lint errors, **30 warnings**, and **3 app unit
tests passed** (one existing arithmetic example plus two new manifest/backup
policy tests; no failures or skips). Before the source fix, both new tests failed
on the original order/missing rules; a further targeted red run caught the
missing legacy declaration. These source-level tests do not simulate Android
backup transports.

`aapt` confirmed the debug APK still declares the original INTERNET, VIBRATE and
dynamic-receiver permissions, min/target APIs 24/36, `allowBackup=false` and
`usesCleartextTraffic=false`; both new backup XML resources and the nine cloud
exclusions are packaged. A structural comparison against the original manifest
confirmed that, aside from moving the permission and adding the two backup
attributes, all existing elements and attributes are unchanged. All 107 shared
web files still match the Android and iOS copies and rebuilt APK assets.

The final text/XML/HTML and complete Gradle output are in the session files
directory as `android-warning-review-final.txt`, `.xml`, `.html` and `.log`;
additional checks are in `android-warning-review-validation.log`. Comparing
individual XML entries by ID, message and primary file found exactly the two
original instances above resolved and **no new warnings**:

| Issue ID | Original | Final |
|---|---:|---:|
| `ManifestOrder` | 1 | 0 |
| `AndroidGradlePluginVersion` | 1 | 1 |
| `GradleDependency` | 1 | 1 |
| `DataExtractionRules` | 1 | 0 |
| `ObsoleteSdkInt` | 1 | 1 |
| `UnusedResources` | 6 | 6 |
| `IconLauncherShape` | 10 | 10 |
| `MonochromeLauncherIcon` | 2 | 2 |
| `IconDipSize` | 2 | 2 |
| `IconDuplicatesConfig` | 1 | 1 |
| `IconLocation` | 1 | 1 |
| `IconDuplicates` | 5 | 5 |
| **Total** | **32** | **30** |

No lint suppression, dependency upgrade, branding/minimum-OS/signing change,
shared-data deletion, commit or deployment was performed. Debug build and
source-level checks are not device, release-signing or store certification.
