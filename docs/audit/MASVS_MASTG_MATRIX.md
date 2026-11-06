# Mobile security: MASVS and MASTG assurance matrix

Assessment date: 6 November 2026. **This is not a MASVS certification.** It
maps all 24 controls in the current [OWASP MASVS](https://mas.owasp.org/MASVS/)
source to available evidence and proposed
[MASTG](https://mas.owasp.org/MASTG/tests/) tests. Control summaries below
are paraphrased from OWASP MASVS, CC BY 4.0; the linked OWASP text is
authoritative. The matrix describes the app as inspected, not an installed
store release. `Partially verified` is not a pass.

The downloaded MASVS archive had SHA-256
`6659818cd7cd66f905aaa10311a5c2bdcbc1d12016205cc68d48fddfa8c7f3b8`.
All 24 control-file Git blob hashes matched the public upstream tree at
[`bbe226fd17e6dab51927f392936deef31c816423`](https://github.com/OWASP/masvs/tree/bbe226fd17e6dab51927f392936deef31c816423).
Current MASTG test references were checked against its public index; they are
proposed procedures, not claims that the full tests were executed.

## What was actually examined

- The prior Android **debug** APK, 8,299,143 bytes, SHA-256
  `67f8d14f82afa657572f75d347ec1fe7b3d37b1f3ce68eb32ade3905e80019ed`.
  Archive inventory identified the compiled manifest, two DEX files,
  Capacitor configuration and packaged web assets. Android SDK `aapt dump
  badging` and `aapt dump xmltree` inspected the merged manifest. No
  app was installed. REA archive inspection did not decompile DEX because
  the required caller-supplied JADX integration was unavailable.
- The merged manifest declares `INTERNET`, `VIBRATE` and the package-scoped
  `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. The latter two do not appear in
  the app's own [source manifest](../../android/app/src/main/AndroidManifest.xml).
  `MainActivity` is exported for the launcher; `BrowserControllerActivity`
  and both providers are non-exported. AndroidX `ProfileInstallReceiver` is
  exported but permission-protected by `android.permission.DUMP`. The
  manifest sets `allowBackup=false` and `usesCleartextTraffic=false`.
  `debuggable=true` is appropriate for this debug APK; a release APK/AAB,
  its merged manifest, WebView debugging and signing were **not** assessed.
- The app uses bundled web content and Capacitor plugins. The inspected
  [shared configuration](../../capacitor.config.json),
  [native bridge](../../mobile/native-bridge.js),
  [Android file-provider roots](../../android/app/src/main/res/xml/file_paths.xml),
  [iOS plist](../../ios/App/App/Info.plist),
  [scene delegate](../../ios/App/App/SceneDelegate.swift), and
  [Swift package](../../ios/App/CapApp-SPM/Package.swift) are source evidence,
  not evidence of device behavior. The Xcode target specifies iOS 16.4; the
  SPM package's iOS 16 declaration is not the final app deployment target.
- The iOS app source has no `NSAppTransportSecurity` exception or URL scheme
  declaration in its plist, and no tracked app-level entitlement or
  `PrivacyInfo.xcprivacy` file was identified. The scene delegate forwards URL
  and universal-link callbacks to Capacitor, which does not by itself register
  a scheme or entitlement. Plugin manifests, resolved entitlements and the
  signed `.app`/IPA remain unknown until built on macOS. Absence of an
  app-level privacy manifest is an assessment item, not by itself proof of a
  store-policy violation.
- No Android device/emulator, macOS/Xcode, iOS device, interception proxy,
  release signing material or store account was available. Owners must use
  synthetic data, isolated builds and authorized devices.

## Control-to-evidence matrix

Each row applies to both platforms unless the scope is stated. The **next
test** column names an owner: **Mobile** means the release/mobile engineer;
**Security** means a qualified mobile security tester; **Privacy** means the
operator/privacy adviser. No dynamic MASTG test below is claimed complete
unless its observation is explicitly described.

| MASVS control and scope | Classification | Evidence and limitation | Next test / owner |
|---|---|---|---|
| STORAGE-1: protect sensitive stored data | Partially verified | Shared wishlists and recent ideas can contain personal recipient information and use web storage; manifest backup flags and local schemas were inspected, not filesystem encryption or extraction on devices. | Mobile/Security: inventory data and inspect WebView storage, backups, logs and file protection on both OSes; [Android 0216](https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0216/) and iOS 0215. |
| STORAGE-2: prevent unintended leakage | Partially verified | Local share/clipboard, image requests and log paths exist; the debug package and source do not demonstrate all runtime copies, caches or log redaction. | Security: inspect synthetic sensitive data in logs, screenshots, clipboard, caches and backups; Mobile: test share cancellation and cleanup. |
| CRYPTO-1: use appropriate cryptography | Not verified | Client uses platform-generated UUIDs; server cryptography is outside this mobile-only assessment. No complete native crypto/inventory or negotiated-TLS assessment occurred. | Security: inspect compiled dependencies, randomness and TLS on representative OS versions; separately assess server cryptography in ASVS. |
| CRYPTO-2: protect and manage keys | Not verified | The app has no identified user-facing key-management implementation; signing keys, transitive SDKs and final packages were not inspected. | Mobile/Security: establish whether client secrets or keys exist in each release, verify platform key storage if applicable and review signing controls without disclosing keys. |
| AUTH-1: secure app authentication and authorization | Not applicable | No end-user login/session is implemented in the inspected app. Public API origin checks and Turnstile are not user authentication. Server admin/provider credentials are a separate server control. | Mobile/Security: reassess if accounts or authenticated endpoints are added. |
| AUTH-2: secure local authentication | Not applicable | No in-app password, biometric or local-authentication feature was identified. OS device unlock is not an app authentication implementation. | Mobile: reassess if local authentication is introduced. |
| AUTH-3: additional authentication for sensitive operations | Not applicable | No authenticated end-user account operation requiring step-up was identified; share, clipboard and purchases navigate to external providers rather than authenticating an app account. | Privacy/Security: reconsider after data classification and whenever account or payment functionality changes. |
| NETWORK-1: protect network communications | Partially verified | Android merged manifest disallows cleartext; no iOS ATS exception appears in the source plist; shared API configuration uses HTTPS. Actual traffic, all SDKs, TLS negotiation, hostname validation and release plist are not tested. | Security: capture synthetic traffic and exercise failure paths; Android [0217](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0217/), [0218](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0218/), [0235](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0235/); iOS [0322](https://mas.owasp.org/MASTG/tests/ios/MASVS-NETWORK/MASTG-TEST-0322/). |
| NETWORK-2: identity pinning for controlled endpoints | Not verified | No app-level pinning configuration was identified in the inspected sources; transitive runtime and release binaries were not fully examined. Standard TLS is not pinning. | Security/operator: decide whether the OWASP L2 pinning profile applies, assess rotation and outage risks, and test [Android 0242](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0242/) and iOS 0385. |
| PLATFORM-1: secure IPC | Partially verified | Actual debug manifest exposes the launcher and a DUMP-protected AndroidX receiver; providers are non-exported. FileProvider roots include external and cache directories, with temporary URI grants; real intent handling and grants were not exercised. | Security: test exported activities/receivers and file grants with a second test app, including [0364](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0364/) and [0366](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0366/); inspect final iOS entitlements and URL handlers. |
| PLATFORM-2: secure WebViews and native bridges | Partially verified | See the conditional bridge boundary below. Source inspection is not an attacker-frame/device test. | Security/Mobile: test the actual bridge on old/current Android WebViews and WKWebView with untrusted-frame fixtures; [Android 0334](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0334/), [iOS 0376](https://mas.owasp.org/MASTG/tests/ios/MASVS-PLATFORM/MASTG-TEST-0376/), iOS 0332/0333. |
| PLATFORM-3: protect sensitive UI | Not verified | Shared UI and share flows were inspected; OS-generated task snapshots, screen recording and notifications were not tested. | Mobile/Privacy: classify recipient content and test snapshots, screen sharing and disclosure behavior on devices. |
| CODE-1: supported platform versions | Partially verified | Debug manifest min SDK 24, target SDK 36; Xcode app target 16.4. These facts do not establish that all OS versions receive security updates or are commercially supported. | Mobile/operator: publish and maintain a risk-based OS/WebView support policy and test minimum/current devices. |
| CODE-2: enforce updates where required | Not verified | Store distribution and mandatory-update mechanism were not verified. Offline use and older installed clients are intentional compatibility concerns. | Mobile/operator: determine whether a forced-update policy is necessary; exercise compatible update and rollback paths before release. |
| CODE-3: dependencies without known vulnerabilities | Partially verified | The earlier npm audit reported no advisories for its snapshot, but native transitive dependency/SBOM, package provenance, unreported vulnerabilities and current release binaries remain unverified. | Mobile/Security: produce signed release SBOMs and dependency/advisory scans for Gradle, SPM and npm at release time. |
| CODE-4: validate untrusted inputs | Partially verified | Shared source has bounded validation and tests for selected forms, provider offers and frame messages. This does not cover every native intent, bridge method, deep link or WebView origin. | Security: adversarially test all release bridge/intent entry points with device-based fixtures. |
| RESILIENCE-1: platform integrity | Not verified | No device root/jailbreak integrity test or formal threat-based requirement was established. | Security/operator: decide applicability and acceptable trade-offs under the OWASP resilience profile; test if required. |
| RESILIENCE-2: anti-tampering | Not verified | Debug archive inspection is not a release tampering or signature-verification test. | Security/Mobile: inspect release signing and perform authorized modified-package tests if threat model requires them. |
| RESILIENCE-3: resistance to static analysis | Not verified | DEX decompilation was blocked; no release obfuscation assessment. Obfuscation is not a substitute for server-side controls. | Security: evaluate the release artifact against the chosen threat model. |
| RESILIENCE-4: resistance to dynamic analysis | Not verified | No instrumented device or runtime bypass testing was performed. | Security: assess runtime hooks/debugging only if the optional resilience profile is adopted. |
| PRIVACY-1: minimize access to sensitive resources | Partially verified | Compiled Android debug permissions were enumerated; no camera, contacts or location permission appeared. Data transmitted to providers, plugin capabilities and final iOS disclosures need runtime verification. | Privacy/Mobile: inventory data and SDK flows and exercise permission prompts on devices. |
| PRIVACY-2: limit user identification | Not verified | Anonymous design and salted server counters do not establish anonymity; IP addresses, third-party network requests and possible provider-side correlation remain. | Privacy: assess actual network flows, retention, linkability and third-party processing. |
| PRIVACY-3: transparent collection and use | Partially verified | Published privacy documentation exists; actual SDK processing, app-store disclosures and contractual accuracy are not independently validated. | Privacy/operator: reconcile real flows and release declarations with all processors and store forms. |
| PRIVACY-4: user control over data | Partially verified | Shared local data and clearing behavior have source/test coverage; deletion, backups, third-party recipients and device-specific persistence are not completely verified. | Privacy/Mobile: exercise deletion and persistence across reinstall, backups, sharing and connected services. |

## WebView bridge trust boundary: investigation, not an exploit finding

Capacitor's installed Android source prefers an origin-allowlisted WebMessage
listener and checks `isMainFrame`. Its legacy `addJavascriptInterface`
fallback does not show the same main-frame gate. The app embeds a hosted
verification iframe; **whether that iframe can invoke sensitive native
functionality on a particular WebView version is unverified**. Android
`FileProvider` is non-exported despite its broad configured roots; an actual
URI disclosure has not been demonstrated.

The inspected iOS `WKScriptMessageHandler` implementation does not visibly
check `message.frameInfo.isMainFrame`, while Capacitor injects its JavaScript
into the main frame. That does not establish whether an embedded frame can
reach the registered native handler. Test a controlled untrusted frame against
the actual signed build, record exposed methods, and verify origin/frame and
user-gesture enforcement. Do not enable a new integration or weaken existing
origin checks to perform this test.

## Device and release gates

Before asserting mobile security, a mobile engineer and independent tester
should inspect the actual release APK/AAB and IPA, merged manifests,
permissions, signing/debug flags, all bundled privacy manifests and
entitlements; run the applicable MASTG tests; inspect backup/restore and
WebView storage; test hostile deep links, native messages and TLS failures;
and validate real accessibility, lifecycle and provider flows. Device testing
and iOS compilation are **Blocked** in this environment. No claim is made
that every optional resilience test is necessary for this product.
