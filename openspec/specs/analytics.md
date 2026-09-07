# Analytics and Crash Reporting Specification

## 1. Firebase Analytics

Firebase Analytics is the primary analytics platform for LifeLens. It is integrated through the Expo Firebase SDK and provides automatic onboarding, screen tracking, event logging, and user property management.

### 1.1 Event Tracking

All user actions that represent meaningful product engagement are tracked as Firebase Analytics events. Events form a complete funnel from acquisition through onboarding, scanning, analysis, and monetization. Each event must be a single, discrete, and nameable user action — never a composite of multiple behaviors.

Event names follow Firebase conventions: lowercase, snake_case, and a maximum length of 40 characters. Events must never contain personal data, image data, AI response content, or any raw content that could identify an individual.

### 1.2 User Properties

User properties are used for cohort and segmentation analysis. The following user properties are set on every eligible session:

| Property | Values | Notes |
|----------|--------|-------|
| `user_tier` | free / pro / trial | Reflects current subscription entitlement |
| `onboarding_complete` | true / false | Whether onboarding flow was finished |
| `auth_method` | email / google / guest | How the user authenticated |
| `app_language` | en / es / fr / etc. | Locale derived from device settings |
| `days_since_first_open` | integer | Rolling counter for retention analysis |

User properties must only contain non-PII categorical or numeric values. No free-text, no emails, no hashed identifiers that can be reversed, and no device-identifying data beyond what Firebase assigns automatically.

### 1.3 Screen Tracking

Screen tracking is automatic through Expo's built-in analytics integration. Expo Router automatically logs a `screen_view` event on every route change using the route name. No manual screen logging is required, and no additional analytics code should be added to individual screens.

Each screen name is derived from the route segment. The set of tracked screens is:

- Onboarding
- Login
- Home (Camera)
- Preview
- AnalyzeResult
- History
- ScanDetail
- Settings
- Account
- ProUpgrade
- QuotaExhausted

### 1.4 No PII in Analytics Events

Strict rule: analytics events must never contain personally identifiable information. This includes, but is not limited to:

- Email addresses
- Phone numbers
- Full names
- Exact geo-coordinates
- Device identifiers beyond Firebase's assigned IDs
- Authentication tokens or session identifiers
- User-generated content (scan descriptions, notes, labels)
- IP addresses (Firebase truncates by default; do not log raw IPs manually)

### 1.5 No Raw Images in Analytics

Raw image data, image buffers, base64-encoded images, file paths to images, and image content hashes must never be attached to any analytics event. Scanning events are tracked as events with metadata only — never with the image payload itself.

## 2. Key Events to Track

The following canonical events are defined for the entire application. Each event lists its trigger condition and any permitted parameters.

### 2.1 Lifecycle Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `app_open` | Application cold start or warm start into foreground | `source` (icon / deep_link / push) |
| `app_background` | Application moves to background | `screen` (current screen name) |
| `app_foreground` | Application returns to foreground | `screen` (current screen name) |

### 2.2 Onboarding Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `onboarding_complete` | User reaches the final onboarding screen | none |
| `onboarding_skip` | User taps "Skip" during onboarding | `step` (onboarding step index) |

### 2.3 Authentication Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `auth_login` | Successful email/password login | `auth_method` = email |
| `auth_register` | Successful account registration | `auth_method` = email |
| `auth_google` | Successful Google sign-in | none |
| `auth_guest` | User proceeds as guest | none |

All auth events must be logged only after a successful result. Failed auth attempts are logged as `error_occurred` with category `auth`, never as successful auth events.

### 2.4 Scan Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `scan_start` | User initiates a scan from the camera screen | `mode` (camera / gallery) |
| `scan_capture` | User captures a photo from the camera | none |
| `scan_gallery_select` | User selects an image from the gallery | none |
| `scan_upload` | Selected/captured image is uploaded for analysis | none |

No scan event may include image data, image dimensions beyond a coarse bucket, or any content-based descriptor.

### 2.5 Analysis Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `analysis_start` | Analysis request dispatched to backend | `mode` (camera / gallery) |
| `analysis_complete` | Analysis returns successfully | `duration_ms` (rounded bucket), `tier` |
| `analysis_error` | Analysis fails | `error_category` (network / server / parse / quota) |

The `duration_ms` parameter must be bucketed (e.g., <1s, 1–3s, 3–10s, >10s) rather than sent as an exact value to reduce fingerprinting risk.

### 2.6 Risk Level Event (Anonymized)

| Event | Trigger | Parameters |
|-------|---------|------------|
| `analysis_risk_level` | Analysis completes with a risk determination | `risk_level` (low / medium / high / critical) |

This event contains only the coarse risk category. It must never include the underlying confidence score, the model's reasoning text, or any excerpt of the image that produced the result.

### 2.7 Follow-Up Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `follow_up_asked` | User asks a follow-up question about a result | none |
| `follow_up_completed` | Follow-up response is returned successfully | none |

Follow-up events must never contain the question text or the response text.

### 2.8 History Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `history_viewed` | User opens the history screen | none |
| `scan_detail_viewed` | User opens a stored scan detail | none |

### 2.9 Quota Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `quota_exhausted` | User attempts an action with zero remaining quota | `action` (scan) |
| `quota_low` | Remaining free scans drops to configured threshold (e.g., 1) | `remaining` |

### 2.10 Monetization Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `pro_viewed` | User opens the Pro upgrade screen | `source` (quota / settings / paywall prompt) |
| `pro_purchase_start` | User initiates a subscription purchase | `plan` (monthly / yearly) |
| `pro_purchase_complete` | Purchase completes successfully | `plan` |
| `pro_purchase_error` | Purchase fails or is cancelled | `plan`, `error_category` (cancel / billing / network) |

### 2.11 Ad Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `ad_impression` | Rewarded ad impression is shown | `placement` (rewarded) |
| `ad_click` | User clicks on an ad | `placement` |
| `ad_rewarded_complete` | User completes the rewarded ad and earns the reward | `placement`, `reward_type` (bonus_scan) |

### 2.12 Settings Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `settings_theme_changed` | User changes the app theme | `theme` (light / dark / system) |
| `settings_support_opened` | User opens the in-app support/contact screen | none |

### 2.13 Account Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `account_deletion_requested` | User requests account and data deletion | none |
| `account_deletion_completed` | Deletion is confirmed as complete | none |

### 2.14 Error Event

| Event | Trigger | Parameters |
|-------|---------|------------|
| `error_occurred` | Any handled or caught error | `category`, `message_code` |

The `category` parameter is one of: `auth`, `network`, `server`, `parse`, `quota`, `billing`, `camera`, `storage`, `analytics`, `unknown`. The `message_code` is a stable, human-defined error code string (e.g., `NETWORK_TIMEOUT`, `PARSE_FAILURE`).

The `error_occurred` event must never include: exception stack traces with file paths, network request bodies, response payloads, image references, tokens, or any user content. All diagnostics go to Crashlytics (non-fatal) with sanitization, not to raw analytics parameters.

## 3. Firebase Crashlytics

Crashlytics captures crash reports and non-fatal errors with context for debugging. Every crash is automatically reported without manual instrumentation at the framework boundary.

### 3.1 Automatic Crash Reporting

Native and JavaScript exceptions that reach the unhandled handler are automatically captured and uploaded by Crashlytics. The Expo Firebase Crashlytics module is initialized at app startup (post-consent) and requires no per-crash code.

### 3.2 Non-Fatal Error Logging

For errors that are caught and handled gracefully, non-fatal reports are recorded via the Crashlytics API. Each non-fatal report includes:

- A named error code (the same `message_code` used by `error_occurred`)
- A sanitized, stable error message (no dynamic user content)
- A custom key set for context (see below)

Non-fatal errors are recorded for: analysis failures, API parsing failures, billing verification failures, and camera errors. They are not recorded for quota exhaustion (expected user state) or for events already captured cleanly by analytics.

### 3.3 Custom Keys for Context

Every Crashlytics report is enriched with custom keys to aid debugging:

| Key | Type | Purpose |
|-----|------|---------|
| `user_id` | string | Anonymous stable user identifier (anon user UUID, never email or token) |
| `screen` | string | Active screen/route name at time of error |
| `feature` | string | Feature area (scan / analysis / auth / billing / history / settings) |
| `app_version` | string | Semantic version of the app |
| `build_number` | int | EAS build number |

`user_id` is a random UUID generated on first launch and persisted locally (registerable for deletion on account deletion). It is never the Firebase Auth UID, email address, or a real-world identifier.

### 3.4 No Sensitive Data in Crash Reports

Crashlytics reports must never contain:

- Raw image data or image content
- AI prompts or AI responses
- Authentication tokens, refresh tokens, or credentials
- API keys or Supabase URLs with project secrets
- User-generated text (scan notes, follow-up questions, descriptions)
- Personal contact information

Error messages passed to non-fatal logging must be constants or sanitized templates. Dynamic strings that could contain user content are redacted before logging.

### 3.5 Breadcrumb Trail

A breadcrumb trail is maintained within Crashlytics to reconstruct the user journey leading to an error. Breadcrumbs are written at key lifecycle and feature boundaries:

- Screen transitions (route names only)
- Scan started / captured / uploaded
- Analysis requested / completed / failed
- Auth success/failure
- Quota state changes
- Purchase attempt outcomes

Each breadcrumb is a short string with no user content. The trail depth is bounded to the last 100 events to control payload size.

## 4. Privacy Rules for Analytics

The following privacy rules are non-negotiable and enforced by code inspection and linting rules.

### 4.1 Never Log Raw Image Data

Images (buffers, base64 strings, file URIs, blob references) are never written to analytics event parameters, Crashlytics breadcrumbs, or log statements. Scanning flow events are metadata-only.

### 4.2 Never Log Image Content or Descriptions

AI-generated descriptions, reports, or paraphrases of an image's content are never logged. The rule applies to the full analysis report text and any summarized or truncated portions of it.

### 4.3 Never Log AI Prompts or Responses in Production

The exact prompt sent to the AI model and the full raw response are never emitted to analytics or logs in production builds. In debug/QA builds, prompts and responses may be logged for development purposes but are stripped from any non-local transport. Production code paths contain no logging of prompt or response content.

### 4.4 Never Log Auth Tokens or Credentials

Access tokens, refresh tokens, Firebase ID tokens, Supabase session tokens, API keys, and credentials are never written to analytics, Crashlytics, or console logs in any build type.

### 4.5 User Consent Required Before Analytics Initialization

Analytics and Crashlytics are not initialized until the user provides consent. Consent is requested during onboarding with a clear, plain-language explanation of what telemetry is collected and why.

- If consent is granted: initialize Firebase Analytics and Crashlytics; begin event tracking.
- If consent is denied: telemetry remains off; the app functions normally without it.
- Consent state is persisted locally and respected across launches.

### 4.6 Opt-Out Available in Settings

A toggle in the Settings screen allows the user to enable or disable analytics and crash reporting at any time.

- When disabled at runtime, event transmission is paused immediately.
- Crashlytics collection is disabled; pending unsent reports are discarded.
- Re-enabling resumes tracking and re-initializes Crashlytics.
- The analytics consent state is part of the account deletion payload so that opting out or deleting the account stops all collection.

## 5. Analytics Configuration

### 5.1 QA Environment

QA builds use a separate Firebase project (`lifelens-qa`) dedicated to testing. Events and crash reports from QA builds never mix with production data.

- GoogleService-Info.plist / google-services.json for QA
- Separate Crashlytics project
- Test campaign data isolated

### 5.2 Production Environment

Production builds use the production Firebase project (`lifelens-prod`). Only approved production build artifacts may use this configuration, to keep telemetry clean.

### 5.3 Debug Mode Logging

- QA / development builds: verbose console logging of analytics initialization, event sends, and screen views is permitted to aid development.
- Production builds: analytics logging is minimal. No event names or parameters are echoed to the console, and any logging of analytics activity is compiled out or disabled.

The `__DEV__` flag controls debug logging. Production logging must be gated so that event payloads never appear in production console output.

### 5.4 Event Batching for Performance

Firebase Analytics performs automatic batching and network flushing in the background. To preserve performance:

- No manual flush calls on the main thread.
- No blocking of UI on analytics transmission.
- Analytics calls are fire-and-forget; failures to transmit are silently retried by the SDK.
- Do not send large or unbounded parameter sets; keep parameter counts minimal per the event table above.
