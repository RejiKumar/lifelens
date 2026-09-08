## 1. Backend foundation

- [x] 1.1 Add `pillow` to `backend/pyproject.toml` and pin within support matrix
- [x] 1.2 Extend `backend/app/core/config.py` `Settings` with env-driven keys: `storage_bucket`, `supabase_service_role_key`, `max_upload_bytes=15MB`, `max_input_dimension=8192`, `min_input_dimension=200`, `output_dimension=2048`, `output_quality=85`, `guest_ttl_days=7`, `signed_url_ttl_seconds=300`, `analysis_timeout_seconds=45`, `ai_provider=stub` (secrets stay env-injected, never logged)
- [x] 1.3 Add `backend/app/schemas/common.py` with sealed `ErrorResponse` envelope `{"error": {"code", "message", "details"}}` and canonical error codes (`VALIDATION_ERROR`, `UNAUTHORIZED`/`EXPIRED_SESSION`, `NOT_FOUND`, `PAYLOAD_SIZE_EXCEEDED`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `ANALYSIS_FAILED`, `INTERNAL_ERROR`)
- [x] 1.4 Add `backend/app/core/errors.py` for typed project exceptions mapped to envelope codes

## 2. Backend persistence and storage

- [x] 2.1 Define SQLAlchemy models (`backend/app/models/*.py`): `scans` (`id` UUID PK, `user_id` nullable, `guest_session_id` nullable, `status` `completed|failed`, `idempotency_key`, `content_hash`, `storage_path`, `created_at`, `expires_at` nullable) and `analyses` (1:1 `scan_id`, typed `AnalysisResult` columns + materialized `risk_level` and safety flag columns)
- [x] 2.2 Add Git-compatible Alembic migration creating `scans` and `analyses` with session-scoped unique index on (`guest_session_id`/`user_id`, `idempotency_key`) and (`guest_session_id`/`user_id`, `content_hash`)
- [x] 2.3 Implement `ScanRepository` (create, get by id with session scope, find by idempotency key / content hash, read-side expiry filter `expires_at >= now`) using the async engine in `backend/app/core/database.py`
- [x] 2.4 Implement `AnalysisRepository` for create + fetch-by-scan
- [x] 2.5 Implement storage repository (`backend/app/repositories/storage.py`) over supabase-py service role: upload, signed URL (5-min TTL), path builder `{user_id|guest_session_id}/{scan_id}/{filename}`, filename sanitizer regex `^[a-z0-9_]+\\.(jpg|jpeg|png|webp)$`

## 3. Backend image pipeline

- [x] 3.1 Implement `backend/app/services/image_utils.py`: magic-byte sniffing (never trust content-type), format allowlist jpg/jpeg/png/webp, size cap ≤15MB (413), dimension cap ≤8192px with `MAX_IMAGE_PIXELS` decompression-bomb guard, minimum-resolution rejection (<200×200px → 400/`VALIDATION_ERROR`), EXIF strip, downscale to ≤2048px, re-encode JPEG q85 / WebP q80, canonical-bytes return
- [x] 3.2 Unit tests for image_utils: bad magic bytes rejected, oversized dims rejected, below-minimum (<200×200) image rejected with 400, dimensions normalized to ≤2048, EXIF (GPS/device) removed from output

## 4. Backend providers and seams

- [x] 4.1 Define `AIProvider` Protocol (`analyze_image(normalized_bytes, mime, context) -> RawAnalysis`) in `backend/app/providers/base.py`
- [x] 4.2 Implement `StubProvider` (deterministic, schema-shaped analysis, config-selected via `AI_PROVIDER=stub`) in `backend/app/providers/stub.py`
- [x] 4.3 Define `AuthVerifier` Protocol + `GuestVerifier` stub resolving guests from the session header into `Identity(user_id|guest_session_id)`; wire via dependency injection (no auth implementation)
- [x] 4.4 Add `QuotaInfo` placeholder schema (structure only) and a no-op quota context used by the 429 `QUOTA_EXCEEDED` branch — backend stays the authority, client never trusted

## 5. Backend scan API and analysis service

- [x] 5.1 Add `backend/app/schemas/scan.py`: `ScanResponse` (`id`, `status`, `created_at`, `analysis`, `safety`, optional `quota`), `AnalysisResult` with clamps (title≤200, category≤100, summary≤2000, confidence 0..1, risk_level enum, observations 1–20, actions 0–10, warnings 0–10, when_to_seek_help, follow_up_suggestions 0–5), `SafetyMetadata`, `ScanSource` enum (`camera|gallery|file`)
- [x] 5.2 Implement `AnalysisService` pipeline order: identity seam → multipart size/format guards (413/400) → Pillow normalization → session-scoped dedupe (content hash + idempotency key returns existing `ScanResponse`, 200; a content-hash or idempotency-key match in a *different* session is a new scan, never a cross-session reuse) → bounded `AIProvider.analyze_image` (45s timeout, bounded retries) → normalize/clamp output (invalid output rejected, never presented) → safety metadata passthrough/materialization → persist `scans`+`analyses` rows + storage object (`expires_at = created_at + 7 days` for guests, NULL authenticated) → respond
- [x] 5.3 Add router `backend/app/api/scan.py` (prefix `/scan`): `POST /scan/analyze` (multipart `image`, `idempotency_key`, `source`; 200 / 400 / 413 / 404 / 429 with nested `quota` / 401 reserved / 500 `INTERNAL_ERROR`)
- [x] 5.4 Add `GET /scan/{scan_id}` returning stored `ScanResponse` (200/404, expired reads 404 via read-side TTL)
- [x] 5.5 Add `GET /scan/{scan_id}/signed-url` (ownership-checked, 5-min single-object signed URL `{signed_url, expires_at}`; 200/404)
- [x] 5.6 Wire `/scan` router + provider/verifier overrides into `backend/app/main.py`; map provider exceptions to `ANALYSIS_FAILED` with a user-friendly message

## 6. Backend tests

- [x] 6.1 `tests/api/test_scan_api.py`: happy-path `POST /scan/analyze` (dependency-overriden `StubProvider`, fake storage, test DB) returns validated analysis + safety in one 200; 400 missing/invalid image; 413 >15MB; 404 unknown scan; duplicate content hash / replayed idempotency key returns existing result without re-analysis
- [x] 6.2 `tests/api/test_scan_schema.py`: schema clamps reject oversized/out-of-range `AnalysisResult` fields; `ScanResponse` serializes correctly
- [x] 6.3 `tests/api/test_auth_seam.py`: `GuestVerifier` resolves session header; missing header still produces a resolvable guest identity
- [x] 6.4 `tests/api/test_safety_passthrough.py`: risk_level + safety flags preserved through the service
- [x] 6.5 `tests/api/test_ai_provider_mock.py`: `StubProvider` shape validity; invalid provider output rejected by the normalizer
- [x] 6.6 Run full pytest suite green against dev DB (no Gemini credentials required) — 32 passed, ruff + mypy clean

## 7. Mobile dependencies and project config

- [x] 7.1 Add deps via `npx expo install expo-image-manipulator expo-haptics expo-crypto` and dev deps `jest-expo @testing-library/react-native` (verify against Expo SDK 57 docs before writing code, per mobile AGENTS.md)
- [x] 7.2 Add `test` (jest-expo preset + RNTL) and `lint` scripts to `mobile/package.json`; add jest config
- [x] 7.3 Update `mobile/app.json`: camera + photo-library config plugins with permission descriptions; keep `com.lifelens.app`/projectId unchanged

## 8. Mobile app shell and navigation

- [x] 8.1 Restructure `src/app/_layout.tsx` to root Stack with hidden `(tabs)` group (Home camera-first, History stub, Settings stub) and modal routes `/camera`, `/preview`, `/scan`, `/analysis/[id]`
- [x] 8.2 Add deep links `lifelens://camera` and `lifelens://analysis/{id}`
- [x] 8.3 Replace template index/explore with camera-first Home (primary capture CTA, gallery entry) and History/Settings stubs; remove template components no longer referenced

## 9. Mobile scan domain and data layer

- [x] 9.1 Implement `src/features/scan/domain`: normalization budget (longest edge ≤2048, JPEG q85/WebP, EXIF-stripped, ≤10MB via quality ladder 85→80→75→…→60), HEIC→JPEG rules (iOS picker transcode, Android native, web rejects with inline message)
- [x] 9.2 Implement `src/features/scan/data`: `expo-image-manipulator` off-thread resize/re-encode, `Image.getSize` measurement, `expo-crypto` SHA-256 content hash + UUID idempotency key per attempt
- [x] 9.3 Implement API client: multipart FormData to `{EXPO_PUBLIC_API_URL}/scan/analyze`, 60s upload timeout, 3 retries at 1s/2s/4s, `AbortController` cancel, signed-url fetch for result screen, error mapping onto the envelope codes
- [x] 9.4 Implement `src/features/scan/presentation` state machine: `idle/capturing/processing/preview/uploading/analyzing/success/error/retry` with stage-labeled progress (indeterminate under reduced motion) and cancel-on-back
- [x] 9.5 Add analytics seam (`scan_start(mode)`, `scan_capture`, `scan_gallery_select`, `scan_upload`, `analysis_start(mode)`, `analysis_complete(duration_ms)`, `analysis_error(error_category)`, `analysis_risk_level(risk_level)`, `quota_low`, `error_occurred`) — no-op implementation until instrumentation change

## 10. Mobile capture and selection screens

- [x] 10.1 `/camera`: `expo-camera` `CameraView` at 30fps, flash off/on/auto (persisted user preference), scan-indicator frame overlay, capture CTA with `expo-haptics`, camera flip, focus state
- [x] 10.2 Camera permission request + graceful denial flow (settings prompt, inline empty state) per camera permissions rules
- [x] 10.3 Gallery via `expo-image-picker` and web file upload (drag-drop/click) with HEIC handling per spec

## 11. Mobile preview and analysis screens

- [x] 11.1 `/preview`: image display, file info (dimensions/size/format), retake + analyze CTAs, client normalization status
- [x] 11.2 `/scan` processing route: progress indicator, cancel, retry; on success deep-link to `/analysis/[id]`

## 12. Mobile result screen

- [x] 12.1 `/analysis/[id]`: row order risk badge → title/category/confidence → summary → observations → actions → warnings banner → when-to-seek-help → follow-up entry point (disabled for guests) → disclaimer footer; glassmorphism via `expo-glass-effect`/`expo-blur` with solid fallback; light/dark/system via existing theme hooks
- [x] 12.2 Risk badge tokens (`error`=CRITICAL, `warning`=HIGH, `info`=MEDIUM, `success`=LOW); HIGH/CRITICAL warnings as non-dismissible banner per safety rules
- [x] 12.3 Accessibility: 44×44pt touch targets, `AccessibilityInfo.announceForAccessibility("Analysis complete…")` on success, reduced-motion-safe progress, screen-reader labels for all sections

## 13. Mobile tests

- [x] 13.1 Jest + RNTL tests for scan domain/data: normalization budget bounds, content hash + idempotency key generation, error-code mapping, state machine transitions
- [x] 13.2 Component tests for result screen (risk badge mapping, warning banner visibility), preview CTAs, and camera-permission denial state
- [x] 13.3 `npm run lint` and `npm run test` green

## 14. End-to-end verification

- [x] 14.1 Backend: manual local curl happy path + 400/413/404/429 against dev Supabase; duplicate submission returns existing scan, no re-analysis — verified live via curl (200 happy; 400 missing image; 413 >15MB; 404 unknown/expired; duplicate idempotency_key returns same scan id)
- [x] 14.2 Mobile: guest scan via camera and gallery on emulator + web upload; HEIC gallery select converts; >10MB image hits compression ladder; server-side >15MB rejection surfaces as 413 — VERIFIED on real device (OnePlus/Android 13, Expo Go): gallery pick → Photo Picker → preview (normalized) → Analyze → POST /scan/analyze 200 → result screen rendered; camera (permission grant → capture → preview → Analyze → 200 → result) also verified. Root cause found & fixed: Expo SDK 57 winter/fetch rejected the legacy `{uri,name,type}` FormData part ("Unsupported FormDataPart implementation"); `buildFormData` now appends `expo-file-system` `File` (real Blob). Remaining env-dependent items not re-verified here: web upload (browser flow; web branch of `buildFormData` unchanged/type-checked), HEIC conversion (iOS-specific), >10MB ladder & in-app 413 surfacing (covered by mobile unit tests + backend 14.1 live 413)
- [x] 14.3 Confirm no permanent public image URLs anywhere (response inspection + bucket policy check) and no Gemini/AI credentials on the client — verified: bucket `scan-images-qa` public=false; no `*_url`/public-URL code paths; signed-url is the sole image access; no AI creds on client
- [x] 14.4 Confirm guest rows carry `expires_at = created_at + 7 days` and authenticated paths leave it NULL; expired reads return 404 — verified live: guest row ttl ≈7 days; after manually expiring, `GET /scan/{id}` and `/signed-url` both return 404
- [ ] 14.5 Full mobile `lint`/`test` and backend `pytest` green before merge to `qa` — suites are green (mobile lint/test + backend pytest); awaiting explicit merge approval per workflow rules