# Testing Strategy Specification

## 1. Testing Pyramid

LifeLens follows the standard testing pyramid to keep the suite fast, reliable, and proportionate to risk.

### 1.1 Unit Tests (Fast, Many)

The largest layer. Unit tests verify individual functions and pure logic in isolation with no network, no database, and no UI dependencies. They run in milliseconds and form the bulk of the suite. Targets: utility functions, quota math, data transformations, validators, and parsers.

### 1.2 Integration Tests (Moderate, Some)

A smaller middle layer. Integration tests exercise real interactions between components: API client against mocked HTTP, backend service against a real test database, auth flow against a test Supabase instance. They are slower and fewer than unit tests but still deterministic.

### 1.3 E2E Tests (Slow, Critical Paths Only)

The smallest layer. End-to-end tests drive the full application through its critical user journeys using a device/simulator and real (or near-real) backends. They are slow and brittle, so they are reserved exclusively for the highest-value flows defined in Section 2.6.

## 2. Mobile Testing

Mobile tests (Expo / React Native) are split into unit, component, API, navigation, accessibility, and critical E2E categories.

### 2.1 Unit Tests

Pure logic and data-layer tests that need no renderer.

- **Utility functions**: date formatting, image resize metadata, risk-level color mapping, theme helpers.
- **Business logic**: quota calculations (bonus scans, remaining counts, reset at midnight), permission state machines, onboarding state machine, and pro-entitlement transitions.
- **Data transformations**: mapping backend JSON responses to typed in-app models; normalizing inconsistent field shapes.
- **API response parsers**: converting raw API payloads into validated domain objects; throwing typed errors on malformed responses.

### 2.2 Component Tests

Component tests render single components with a test renderer and assert behavior.

- **Individual components render correctly**: verify expected text, styles, and conditional branches (empty vs. populated states, loading vs. error states).
- **Component interactions**: simulate press, text input, and scroll gestures; assert resulting state or callbacks are fired with correct arguments.
- **Theme rendering**: verify light/dark/system themes produce the correct colors and contrast for each component.
- **Accessibility labels present**: assert `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` are set on interactive elements so screen readers can announce them.

### 2.3 API Tests

Tests for the API client layer, run against a mocked HTTP layer (MSW) so no real network is used except where intentionally permitted.

- **API client functions**: each endpoint wrapper (scan upload, analysis, follow-up, history fetch, profile) returns correctly parsed data and attaches required headers/auth.
- **Request/response handling**: correct content types, JSON encoding, and error status mapping.
- **Error handling**: timeouts, network failures, and HTTP error codes map to typed app errors with user-readable messages.
- **Token refresh logic**: expired access token triggers a refresh; refresh failure triggers logout; concurrent requests during refresh are queued and retried once.

### 2.4 Navigation Tests

Tests of the navigation container and routing.

- **Screen transitions**: navigating from camera to preview to result updates the history stack and renders the correct screen.
- **Deep linking**: external deep links (e.g., `lifelens://scan/123`) navigate to the correct screen with the correct params.
- **Back navigation**: hardware/back gesture returns to the prior screen and preserves state.
- **Tab switching**: switching between Camera, History, and Settings tabs renders each and retains per-tab state.

### 2.5 Accessibility Tests

Automated checks complementing manual screen-reader review.

- **Screen reader compatibility**: verify role/label/hint coverage for all interactive components (see 2.2).
- **Touch target sizes**: assert tappable elements meet the minimum touch target (44x44 dp); flag undersized targets.
- **Color contrast**: assert text/background pairs meet WCAG AA contrast ratios for both themes.

### 2.6 Critical E2E Tests

The fixed set of end-to-end journeys, run on device/simulator against a staging backend. These are the only E2E tests maintained:

1. **Launch → Camera → Capture → Preview → Analyze → Result**: full happy-path scan producing a result screen.
2. **Auth flow**: register with email → log out → log back in; verify session persistence and profile restoration.
3. **History view → scan detail**: after scans exist, open history, select a scan, and view its detail.
4. **Quota exhaustion → upgrade prompt**: with zero quota remaining, attempt a scan and verify the upgrade/paywall prompt appears.

These tests are the release gate for the critical path and must pass before any production build ships.

**Performance baseline**: All performance-sensitive E2E and profiling work targets a **Pixel 6a-class Android device** (see `product.md` §5.1). Any regression below the locked targets on that device class blocks release.

## 3. Backend Testing

Backend tests (FastAPI / Python) are split into unit, API, schema, auth, quota, entitlement, safety, and AI provider mock categories.

### 3.1 Unit Tests

- **Service logic**: analysis orchestration, report assembly, follow-up handling, and history service behavior.
- **Validation functions**: input validation, required-field checks, image metadata validation, and constraint enforcement.
- **Safety policy rules**: risk-level classification rules, warning-threshold logic, and disclaimer-eligibility rules.
- **Quota calculations**: remaining-scan computations, bonus-scan application, and daily reset boundaries (including timezone edge cases).

### 3.2 API Tests

Exercise HTTP endpoints against a test client with a test database.

- **Endpoint behavior**: each route returns the correct status codes, headers, and body shapes for success cases.
- **Request validation**: malformed, missing, or out-of-range request bodies are rejected with 400/422 and structured errors.
- **Response format**: responses conform to the documented JSON schema (verified against Pydantic response models).
- **Error responses**: 4xx/5xx paths return consistent error envelopes without leaking stack traces or secrets.
- **Authentication middleware**: protected endpoints reject missing/invalid tokens with 401/403; guest endpoints behave as specified.

### 3.3 Schema Tests

- **Pydantic model validation**: In/out models reject invalid input and accept valid input; default values and coercion behave as documented.
- **AI response parsing**: parsing raw model output into structured domain models handles the full range of expected shapes.
- **Structured output compliance**: model responses that omit required fields, use wrong types, or produce out-of-range values are caught and mapped to typed errors rather than crashing.

### 3.4 Auth Tests

- **Registration flow**: valid registration creates an account; duplicate/wrong-strength/invalid inputs are rejected.
- **Login flow**: correct credentials succeed; incorrect credentials fail without leaking account existence.
- **Token refresh**: expired/invalid refresh tokens are handled; refresh issues a new access token; refresh token rotation works.
- **Guest session**: guest creation, guest upgrade-to-account, and guest data retention/merge behavior.
- **Authorization checks**: users can only access their own scans/history; horizontal privilege escalation is rejected.

### 3.5 Quota Tests

- **Quota enforcement**: hitting zero remaining scans blocks new analyzes with the correct error.
- **Concurrency handling**: simultaneous scan requests cannot overspend quota (atomic decrement verified under concurrent load).
- **Reset behavior**: quota resets on schedule (midnight local) and correct counts are returned after reset.
- **Bonus scan application**: rewarded-ad bonus scans increment quota correctly, persist, and cannot be double-applied.

### 3.6 Entitlement Tests

- **Purchase verification**: server verifies purchase receipts/tokens against the store API (test sandbox) and rejects forged/invalid receipts.
- **Entitlement grant/revoke**: granting upgrades the user tier; revoking (expiry, refund, cancellation) downgrades correctly.
- **Webhook handling**: store webhooks (purchase, renewal, cancel, refund) mutate entitlement state correctly and idempotently.
- **Expiry behavior**: expired subscriptions transition user to free tier, and quota reverts to free limits on the correct boundary.

### 3.7 Safety Tests

- **Risk level classification**: known inputs map to the correct low/medium/high/critical buckets.
- **Warning injection**: results meeting warning criteria include the mandated warning text verbatim.
- **Dangerous content filtering**: inputs/content that trigger safety policies are blocked or flagged, never skipped.
- **Medical disclaimer injection**: every result includes the required medical disclaimer; the disclaimer is never absent or malformed.

### 3.8 AI Provider Mock Tests

Run against a mock AI provider implementing the same interface as the real provider.

- **Provider interface compliance**: the orchestration code depends on the interface and works with the mock.
- **Error mapping**: provider errors (rate limit, invalid key, malformed response) map to typed backend errors.
- **Timeout handling**: a hung provider call triggers the client timeout and returns a timeout error, freeing resources.
- **Retry logic**: transient failures retry with correct backoff and limited attempts; persistent failures surface after max retries.
- **Structured output validation**: mock provider returning valid and invalid structured output exercises the full validation path.

## 4. Test Configuration

### 4.1 Jest for Mobile Unit/Component Tests

Mobile unit, component, and (mocked) API tests run under Jest with:

- `jest-expo` preset for Expo/React Native compatibility.
- jsdom or react-native test environment configured for component rendering.
- A separate `test` script and coverage thresholds for core modules.

### 4.2 pytest for Backend Tests

Backend tests run under pytest with:

- A fixtures module providing app instance, test client, and test database.
- Parametrized tests for boundary conditions (quota limits, schema variants).
- Coverage reporting against core services and safety logic.

### 4.3 MSW for API Mocking (Mobile)

Mobile API tests use Mock Service Worker (MSW) to intercept network requests at the HTTP layer. This provides:

- Deterministic, offline API testing.
- Per-test request handlers mimicking real backend responses and errors.
- Assertions that correct requests are made with correct payloads.

### 4.4 Mock AI Provider for Backend Tests

Backend AI-dependent tests use a mock/fake AI provider (see Section 3.8) instead of real provider calls. The mock is injected via dependency override so tests are fast, deterministic, and cost-free. Real-provider smoke tests are separate and opt-in.

### 4.5 Test Database per Environment

Each environment (local, QA) has its own test database, seeded and reset per test run:

- Local: SQLite or ephemeral Postgres used for fast unit/integration runs.
- QA: an isolated QA database with fixture and synthetic data.
- Migrations are applied before the test run and torn down after.

### 4.6 Test Data Fixtures

Centralized fixtures provide consistent seed data:

- Sample user profiles, scan records, and reports.
- Valid and invalid image metadata.
- AI provider canned responses (low/medium/high/critical; malformed; timed-out).
- Store/billing test receipts and webhook payloads.
- Quota boundary states (full, low, exhausted) and entitlement states (free, trial, pro, expired).

Fixtures live under test directories per subsystem and are versioned alongside the code they exercise.
