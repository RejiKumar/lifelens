# Proposal: scan-v1 — Guest-First Visual Scanning (Point → Understand → Act)

## Why

LifeLens has no working core loop. The product promise is **Point → Understand → Act**: a user captures or selects an image, the app analyzes it, and returns structured, actionable understanding. The mobile app is still an Expo template, the backend only serves `/healthz`, and the specs contain 14 contradictions (documented in `explore-report.md` §5) — most critically, an async-style endpoint contract that conflicts with the locked synchronous MVP, a guest-storage model that contradicts itself, and an `image_url` return that violates the no-public-URLs invariant. scan-v1 ships the end-to-end guest-first scan experience and reconciles those specs so later changes (auth, quota, Gemini, history) can build on a clean foundation.

## What Changes

- **Mobile — Camera-first shell**: camera-first Home entry plus new `camera` → `preview` → `scan` → `analysis/:id` routes on the existing Expo Router app; the template Home/Explore tabs are replaced.
- **Mobile — Capture & selection**: Expo Camera live viewfinder (30fps, scan-indicator frame, capture/flash/flip, permission request + graceful-denial flows per scan.md §3), gallery via `expo-image-picker`, and device/web file upload incl. HEIC/HEIF.
- **Mobile — Client image processing**: resize (longest edge ≤2048px, aspect preserved), JPEG q85 compression (WebP when supported), EXIF stripping, ≤10MB output, done off the UI thread.
- **Mobile — Preview & sync analyze**: preview screen (retake/analyze, file info, overlay), one synchronous `POST /scan/analyze` returning the result in the same response; client idempotency key + content-hash duplicate suppression; upload timeout (60s), bounded retry (3× 1s/2s/4s), cancel, and full loading/error/retry/empty/success states.
- **Mobile — First-pass result UI**: title, confidence, category, summary, observations, actions, warning(s), risk level, when-to-seek-help, and a follow-up question entry point; glassmorphism + Aurora visual system; light/dark/system themes; accessible; reduced-motion safe; performant on Pixel 6a-class.
- **Backend — Synchronous analysis endpoint**: `POST /scan/analyze` (multipart image + idempotency key + source) validates, normalizes, runs the analysis seam, persists, and returns the validated result in one 200 response; `GET /scan/{id}` retained; no queues/workers/polling/job IDs.
- **Backend — Image validation & normalization**: Pillow enforces formats/size/dimensions, re-encodes to a normalized JPEG/WebP, strips EXIF server-side; no permanent public URLs — display uses short-TTL signed URLs from a server endpoint.
- **Backend — Contracts, not systems**: `AIProvider` interface + stub, auth/identity verify seam (stub), optional quota field, analytics event seam, safety metadata passthrough — none implemented (their changes are later).
- **Backend — Persistence**: `scans` + `analyses` rows and the image object written with path `{user_id|guest-session}/{scan_id}/{filename}`; guest rows carry 7-day TTL metadata (deferred cleanup — no background purge job in MVP).
- **Spec reconciliation**: delta updates to `scan`, `ai-analysis`, `storage-privacy` resolving the 14 conflicts per the locked MVP decisions.

## Capabilities

### New Capabilities

None — scan-v1 implements and reconciles the existing `scan` capability; no new spec-level behavior area is introduced.

### Modified Capabilities

- `scan`: sync `POST /scan/analyze` contract replaces the split upload(201)/analyze(202)/GET flow; client compress ≤2048px/q85/≤10MB; server accepts ≤15MB (normalizes to JPEG/WebP ≤2048px); `image_url` returns removed in favor of signed URLs; server-side re-sanitization added; HEIC→JPEG; idempotency + content-hash duplicate handling.
- `storage-privacy`: guest scan persistence clarified as server-side **temporary** storage (not local-only), 7-day TTL enforced by TTL metadata; recurring purge/cleanup **deferred** (no background jobs in MVP) while the TTL contract stands.
- `ai-analysis`: structured `AnalysisResult` is returned inline within `POST /scan/analyze` (sync request/response per §1.1) superseding the 202/GET example shapes; validation + safety ordering preserved.

## Impact

- **Mobile** (`mobile/`): new `src/features/scan/` (presentation/domain/data), camera-first Home, app shell routes; new deps `expo-haptics`, `expo-image-manipulator`, `expo-crypto`; dev deps `jest-expo`, `@testing-library/react-native`; `app.json` camera/image-picker plugin + permission config; new test scripts (`lint`, `test`).
- **Backend** (`backend/`): `app/api/scan`, `app/schemas/scan`, `app/services/analysis`, `app/repositories/*`, `app/providers/*`, `app/models/*`; new dep `pillow`; migrations added for scan-related tables per `storage-privacy.md` (scans/analyses + TTL metadata); auth/quota/AI-provider as seams.
- **Contracts**: `POST /scan/analyze` (multipart), `GET /scan/{id}`, `GET /scan/{id}/signed-url`; response includes analysis + safety metadata; optional `quota` placeholder.
- **Tests**: backend pytest (`api`, `schema`, `auth`/seam-stub, `safety` passthrough, `ai_provider_mock`); mobile Jest + RNTL first harness for scan domain/data logic + key components.
- **Out of scope (not implemented)**: auth-v1, Gemini, safety engine, quota/subscriptions/AdMob, history UI + follow-up chat, onboarding.