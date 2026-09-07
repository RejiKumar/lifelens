# Release Specification

## 1. Android Release Process

### 1.1 Build Tool: Expo EAS

All Android builds are produced with Expo Application Services (EAS) Build. EAS handles cloud compilation, signing, and artifact generation. Local builds are not used for release artifacts.

The build pipeline is defined in `eas.json` at the project root. The `expo` CLI and EAS CLI are pinned to compatible versions in `package.json` and the CI workflow.

### 1.2 Application ID

The Android application ID (package name) is `com.lifelens.app`. This ID is declared in the app config (`app.json` / `app.config.ts`) and must never change after first Play Store publication, as it is the immutable platform identifier.

### 1.3 Version Naming: Semantic Versioning

App versions follow semantic versioning `MAJOR.MINOR.PATCH` (e.g., `1.0.0`):

- **MAJOR**: incompatible feature changes or significant redesigns.
- **MINOR**: backward-compatible new features.
- **PATCH**: backward-compatible bug fixes.

The `version` field in the app config is updated to the semantic version for every release. Version numbers in the app config and the Play Store listing must always match.

### 1.4 Build Codes: Incrementing Integer

Every build is assigned a unique, monotonically increasing integer build number (`android.buildNumber` in EAS / `versionCode` in Gradle):

- Increments by exactly 1 for each submitted build.
- Is never reused, even for a rolled-back release.
- Is tracked in EAS and mirrored in the store listing.
- CI verifies the new build number is greater than the last uploaded one before submission to prevent upload rejection.

## 2. EAS Build Configuration

### 2.1 eas.json with Preview and Production Profiles

`eas.json` defines separate build profiles that map to environments and artifact types. Each profile configures its own environment variables, credentials, and settings.

### 2.2 Preview Profile: QA Builds (APK for Testing)

The `preview` profile produces an **APK** suitable for direct sideloading/internal QA:

- Build target: `apk` (installable, not store-bound).
- Environment variables: QA set (QA API URL, QA AdMob IDs, QA Firebase config, test billing products).
- `channel: preview` for runtime updates.
- Credentials: EAS-managed QA/development keystore.
- Distribution: internal testers via URL or artifact, not the Play Store.

QA builds from the `preview` profile are triggered on pushes to the `qa` branch and for manual QA builds.

### 2.3 Production Profile: AAB for Play Store

The `production` profile produces an **AAB** (Android App Bundle) for submission to Google Play:

- Build target: `aab` (store-submission format).
- Environment variables: PROD set (production API URL, production AdMob IDs, production Firebase config, live billing products).
- `channel: production` for runtime updates.
- Credentials: EAS-managed production keystore.
- Distribution: Google Play only.

Production builds are triggered only from the `prod` branch / release tags.

### 2.4 Android Keystore Managed by EAS

EAS Build manages the Android keystore for both profiles:

- EAS generates and stores keystore credentials.
- Keystore credentials are never stored in the repository or committed to source.
- A backup of the keystore is maintained and documented; losing it would prevent updates to the existing app ID.
- Fingerprints are verified before production submission.

### 2.5 Environment Variables per Profile

Each profile injects its own complete set of environment variables (see the Environments Specification):

- `qa` profile → QA variables.
- `production` profile → PROD variables.

Variables are defined in `eas.json` (referencing CI secrets, not committed values) and/or injected by the CI step. Cross-environment leakage is prevented by keeping QA and PROD variable sets distinct.

## 3. Build Types

### 3.1 Development

A `development` build type used for local development:

- Runs with Metro/debug tooling enabled (live reload, debugger).
- Uses development environment variables.
- Not distributed to end users.
- Installed directly on a developer device/simulator.

### 3.2 Preview (QA Testing)

The `preview` build type:

- Installed internally (APK) by QA/testers.
- Uses QA environment variables and test ad/billing IDs.
- Enables QA analytics and verbose logging.
- Serves as the validation gate before any production release.

### 3.3 Production (Play Store Release)

The `production` build type:

- Submitted as an AAB to the Google Play Console.
- Uses production environment variables and live IDs.
- Enables production analytics with minimal logging.
- Is the only artifact with the production signing key and store listing.

## 4. Google Play Release Stages

All production releases follow a staged rollout through the Play Console tracks.

### 4.1 Internal Testing

- Audience: the core development/QA team.
- Purpose: immediate install via opt-in link; rapid validation of a build before broader exposure.
- Characteristic: releases to this track are immediate.
- This track receives the first production-signed build for final smoke testing before any broader distribution.

### 4.2 Closed Testing

- Audience: a limited, managed group of beta testers.
- Purpose: controlled beta exposure; gather feedback and crash data from a slightly larger, trusted set.
- Characteristic: gradual/managed rollout, tester-approval required.
- This is the first track where real-world production analytics and crash data are observed.

### 4.3 Production (Staged Rollout)

The public production track uses a **staged rollout**:

1. Release to **10%** of users.
2. Monitor crash rate, analytics, and Play Console metrics.
3. Expand to **50%**.
4. Monitor again; if stable, promote to **100%**.

Rollout is paused or rolled back at any stage if crash thresholds, error rates, or user-reported issues exceed acceptable limits.

## 5. Store Listing Requirements

The Google Play listing must be complete and accurate before production submission.

| Requirement | Specification |
|-------------|---------------|
| App icon | 512x512 PNG |
| Feature graphic | 1024x500 PNG |
| Screenshots | Minimum 2, recommended 4–8; high-resolution, representative of actual UI |
| Short description | ≤ 80 characters |
| Full description | ≤ 4000 characters |
| Category | Tools / Productivity |
| Content rating | IARC questionnaire completed accurately |
| Privacy policy URL | Hosted (HTTPS), required |
| Terms of service URL | Hosted (HTTPS) |
| Support URL | Hosted (HTTPS) |
| Data Safety form | Completed accurately, reflecting actual data collection |

All URLs (privacy, terms, support) must be reachable HTTPS pages that describe LifeLens data practices and support channels in plain language consistent with the app's consent flows.

## 6. Subscription Configuration

### 6.1 Products Created in Google Play Console

Subscription products are created in the Play Console under the monetization/Products section before release, and their product IDs match the in-app configuration.

### 6.2 Subscription Plans

- **Monthly**: recurring monthly subscription.
- **Yearly**: recurring yearly subscription (typically priced at a discount relative to monthly).

Each plan has an associated product ID and is referenced by the in-app billing and entitlement code.

### 6.3 Free Trial Period (If Applicable)

If a free trial is offered:

- Trial length (e.g., 7 days) is configured per product in the Play Console.
- Trial eligibility rules are enforced by the store; the app reflects the trial state in its UI and entitlement logic.
- Entitlement code grants pro status during the active trial and reverts at expiry.

### 6.4 Family Sharing Settings

Family sharing availability and settings are configured per product in the Play Console. The app's entitlement logic respects the store's shared-family result (a shared entitlement grants access appropriately).

### 6.5 Pricing per Region

Regional pricing is configured in the Play Console per product. The app reads the store-resolved price for display and does not hard-code prices. Price display in the paywall reflects the user's local currency and store-provided price.

## 7. Pre-Release Checklist

Every production build must pass the full checklist before submission. The checklist is enforced in CI and/or by the release manager.

- [ ] All tests passing (mobile + backend suites, including critical E2E)
- [ ] Lint clean
- [ ] TypeCheck clean
- [ ] No `console.log` in production code paths
- [ ] No debug flags enabled (dev-mode toggles, fake data, mock provider)
- [ ] Environment configuration correct for PROD
- [ ] AdMob IDs are production IDs (not test IDs)
- [ ] Firebase config is production (`lifelens-prod`)
- [ ] API URL is production (`api.lifelens.app`)
- [ ] Billing products are live (not test products)
- [ ] Signing key correct (production keystore)
- [ ] Version bumped (semantic version) and matches the listing
- [ ] Build number incremented above the last submitted
- [ ] Changelog updated with user-facing changes

## 8. Post-Release

After a production release ships:

### 8.1 Monitor Crash Reports

- Review Crashlytics in the production project for new crashes and spike in crash-free sessions.
- Triage critical crashes (crash-free session drop) within the defined SLA.
- New crash clusters are correlated with the released build number.

### 8.2 Monitor Analytics

- Track the staged rollout funnel (launch, onboarding completion, scan completion, conversion).
- Watch for regression in key events relative to the previous release.
- Alerts fire on abnormal event volume or error-event spikes.

### 8.3 Monitor Play Store Reviews

- Review Play Store ratings and reviews daily during rollout.
- Respond to user-reported problems and correlate them with analytics/crash data.
- Escalate systemic issues to the hotfix process.

### 8.4 Hotfix Process

For urgent production defects:

1. Apply the fix on the `qa` branch.
2. Build and validate a QA/preview build.
3. Cherry-pick the fix to the `prod` branch.
4. Build a production build with an incremented build number and an appropriate PATCH version bump.
5. Release through the staged rollout, starting small.

### 8.5 Rollback Plan

- The previous production AAB is retained (EAS artifact + Play Console) and available for redeployment.
- Rollback is triggered if a release crosses crash/error thresholds or produces critical user-facing breakage.
- Rollback proceeds by promoting the previous known-good build (new build number) rather than reusing a consumed number.

## 9. iOS Compatibility

### 9.1 Codebase Must Remain iOS-Compatible

The shared React Native/Expo codebase must remain free of Android-only assumptions so a future iOS release is not blocked by code-level limitations.

### 9.2 iOS Release is NOT Part of the First Store Release

The first store release is Android-only. An iOS App Store release is a future milestone and is explicitly out of scope for the initial production launch.

### 9.3 Test on iOS Simulator During Development

- The app is regularly run and exercised on the iOS simulator in addition to Android emulators/devices.
- Cross-platform components, navigation, and styling are validated on both platforms during development to prevent drift.

### 9.4 iOS-Specific Code Behind Platform Checks

Any platform-specific code (camera permissions, billing, ad SDKs, analytics config) must be gated with platform checks (e.g., `Platform.OS === 'ios'`) so behavior is well-defined and doesn't break the Android build. Platform-specific logic is isolated into modules with a shared interface.

### 9.5 Future iOS Release Will Use the Same EAS Workflow

When iOS is released, it will reuse the same EAS build profiles and release pipeline. The `eas.json` profiles will be extended with iOS targets (`.ipa` for App Store) and iOS signing (managed or defined) following the same profile-per-environment pattern. The staged-release and checklist practices carry over to the App Store release process.
