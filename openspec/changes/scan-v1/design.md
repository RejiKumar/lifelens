# Design: scan-v1 — Guest-First Visual Scanning

## Context

See `proposal.md — Why` for motivation. Current state and constraints that shape this design:

- **Backend baseline**: FastAPI 0.141 app in `backend/app/` exposing only `GET /healthz` (`app/main.py`, `app/api/health.py`, `app/core/config.py`). `Settings` (`app/core/config.py`) is pydantic-settings driven with only `app_env`, `app_name`, `debug`, `database_url`, `cors_origins`. No routers beyond health, no models/migrations, no providers or repositories.
- **Mobile baseline**: Expo SDK 57 template. `src/app/_layout.tsx` renders `ThemeProvider` + `AnimatedSplashOverlay` + `AppTabs` (NativeTabs with `index`/`explore`). Theme hooks (`use-theme.ts`), `themed-text`/`themed-view`, `expo-blur`/`expo-glass-effect` already present. Misfit: the current shell is a template, not a camera-first product; scan-v1 restructures it.
- **Locked contract facts (from specs — do not soften)**: one synchronous `POST /scan/analyze` returns the validated analysis in the same 200; client delivers JPEG/WebP ≤2048px/q85/≤10MB; server accepts jpg/jpeg/png/webp ≤15MB/≤8192px and re-encodes to JPEG/WebP ≤2048px stripping EXIF; no permanent public URLs (5-min signed URLs only); idempotent submission via content hash + idempotency key; guest scans persisted server-side with 7-day TTL metadata (`expires_at = created_at + 7 days`, `user_id` NULL), purge job deferred; analysis executes inline with bounded timeout/retry, invalid AI output is rejected.
- **Hard boundaries (AGENTS.md — priority order)**: Safety > Security > Privacy > UX > Performance > Architecture > Features. Backend is authoritative for all entitlement/safety decisions; AI credentials never on client; mobile UI contains no business logic; every async op has loading/success/empty/error/retry.
- **Seam scope**: auth identity, quota, Gemini provider, analytics, and history are seams — contracts only, no implementations. The full scan flow must work for guests without any of them.

## Goals / Non-Goals

**Goals:**

- Define the wire contract and data model once, with a sealed machine-readable error envelope, so later changes (auth-v1, quota-v1, gemini, history) extend rather than reshape scan-v1.
- Make the AI, identity, quota, and analytics boundaries real interfaces with deterministic stubs so the entire pipeline (capture → upload → analyze → persist → result) is testable with no Gemini credentials, no auth system, and no persistence beyond the scan tables.
- Server-authoritative safety: `risk_level` and safety flags materialized by the backend and passed through the analysis result unmodified by the client, with HIGH/CRITICAL warnings non-dismissible in UI.
- A camera-first mobile shell replacing the template, with one obvious flow (Home → camera/preview → analyze → result) and later extensible tabs.
- Both client and server normalize the image (defense in depth), so the client keeps uploads cheap and the server guarantees canonical stored bytes regardless of client behavior.

**Non-Goals:**

- No background purge/scheduler, no auth implementation, no real Gemini or quota logic, no analytics instrumentation, no history UI or follow-up chat, no thumbnails, no model ranking/versioning, no offline mode, no multi-image or burst scans, no E2E test harness (Jest + React Native Testing Library only).
- No write path for follow-up questions (entry point renders but is disabled for guests).
- No changes to device-local guest *history/export* semantics (`storage-privacy.md` — "device-local" applies to history/export only, not analysis storage).

## Decisions

### 1. Wire contract: single synchronous multipart POST

`POST /scan/analyze` — multipart form with `image` (file), `idempotency_key` (UUID), `source` (optional enum: `camera|gallery|file`). Returns 200 with `ScanResponse` (`id`, `status` (`completed`), `created_at`, `analysis`, `safety`, optional `quota`). `GET /scan/{id}` returns the same body shape. `GET /scan/{id}/signed-url` returns `{signed_url, expires_at}`.

- **Rationale**: matches the locked MVP decision and the delta specs; one round trip avoids the complexity and failure modes of jobs + polling for a single-shot consumer feature.
- **Alternatives**: two-phase upload→analyze with 202/GET polling (rejected — explicitly forbidden by `scan.md` §"Synchronous analysis request"; worse UX, more server machinery, and the client would need a poller with its own timeouts); streaming/WebSocket (unnecessary; response body is small JSON, never the image bytes).

### 2. Sealed error envelope

Every non-2xx error body is `{"error": {"code", "message", "details"}}` from `app/schemas/common.py`. Canonical codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` / `EXPIRED_SESSION` (401 — reserved for the auth seam), `NOT_FOUND` (404), `PAYLOAD_SIZE_EXCEEDED` (413), `QUOTA_EXCEEDED` (429, incl. optional nested `quota`), `RATE_LIMITED` (429 — reserved), `ANALYSIS_FAILED`, `INTERNAL_ERROR` (500). Provider errors are mapped to `ANALYSIS_FAILED` with a user-friendly message (never a raw provider message).

- **Rationale**: the client state machine and later monetization/analytics need stable, machine-readable codes regardless of transport status. One envelope keeps ordering predictable and matches the speculation of the `error` handling in the mobile seam.
- **Alternatives**: rely on HTTP status alone (insufficient — 429 vs 413 vs 400 need distinct handling; QUOTA_EXCEEDED needs a nested quota payload); per-error ad-hoc shapes (unmaintainable).

### 3. Client image pipeline (off JS thread)

`expo-image-manipulator`: measure via `Image.getSize`, resize longest edge → 2048px aspect-preserved, JPEG q85 (WebP when supported), EXIF stripped by re-encoding. If output >10MB, step quality down 85→80→75→…→60. PNG with alpha stays PNG; opaque PNG flattened to JPEG. HEIC/HEIF: iOS picker transcodes, Android native conversion, web file picker rejects HEIC with an inline message.

- **Rationale**: matches `scan.md` upload bounds; keeps uploads under the transport and idempotency-hash budget; re-encoding naturally strips EXIF/GPS before anything leaves the device.
- **Alternatives**: server-only resize (rejected — uploads up to 15MB/8192px would dominate latency on mobile networks); browser-side canvas on web (rejected — inconsistent codec/quality vs native manipulator).

### 4. Server image pipeline (Pillow, defense in depth)

Multipart size checked first (413 >15MB). Pillow sniffing magic bytes (never trust content-type), enforce accepted set, reject dimension bombs (`MAX_IMAGE_PIXELS` + ≤8192px before full decode), reject images below the minimum resolution (200×200px per `product.md` §2.3 — too small to analyze meaningfully) with 400, then normalize: strip EXIF, downscale to ≤2048px longest edge, re-encode JPEG q85 or WebP q80. Canonical bytes are what get hashed, analyzed, and stored.

- **Rationale**: the server must not trust client claims (AGENTS.md security rule 7); canonical-bytes-before-hash guarantees dedupe/idempotency is over the exact stored bytes and the same image always yields the same content hash.
- **Alternatives**: reuse the uploaded bytes directly (rejected — accepts spoofed content-types, unnormalized dimensions, and retains EXIF); server-side HEIC conversion via `pillow-heif` (rejected — client already converts, per spec; keeps server deps minimal).

### 5. Idempotency: server-side content hash + client idempotency key

The client sends a UUID `idempotency_key` (one per upload attempt, regenerated on retry intent changes) and computes a SHA-256 of the normalized bytes via `expo-crypto` for same-batch duplicate suppression. Server: unique lookup on normalized image content hash + idempotency key scoped to the session; a hit returns the existing `ScanResponse` (200, no re-analysis), a miss persists.

- **Rationale**: dual key protects retries of the same request (idempotency_key) and exact duplicate uploads (content hash, which also suppresses re-analysis of a repeated capture).
- **Alternatives**: idempotency-key only (misses content-level duplicates); global content-hash dedupe across sessions (rejected — cross-user coupling and privacy leak risk; dedupe is session-scoped).

### 6. Guest identity: session header via auth seam

An `AuthVerifier` seam (Protocol) resolves identity from the request: authenticated users produce `Identity(user_id=...)`; guests produce `Identity(guest_session_id=...)` from a client-generated session UUID sent in a session header. The MVP `GuestVerifier` stub reads that header, minting nothing server-side per request and storing no session records. Later auth-v1 swaps the implementation (JWT + JWKS) without touching the API or storage path logic.

- **Rationale**: storage scoping (`{guest_session_id}/{scan_id}/{file}` vs `{user_id}/{scan_id}/{file}` per `storage-privacy.md`) needs an identity concept *now*, but auth itself must not block scan-v1. The seam keeps both.
- **Alternatives**: anonymous per-request IDs (breaks retries/history and the duplicate-scan-reuse scenario); build auth-v1 first (out of scope; would block the core loop).

### 7. AI provider seam

`AIProvider` Protocol with `analyze_image(normalized_bytes, mime, context) -> RawAnalysis`; `StubProvider` returns a deterministic, plausible, schema-shaped analysis (fixed risk level, example observations matching whatever fixture) selected by `AI_PROVIDER=stub`; `GeminiProvider` arrives in a later change. Calls bounded: 45s timeout, bounded retries, before returning. Output passes through a normalizer/clamp that rejects or coerces invalid output per `ai-analysis.md` (invalid AI output is never presented).

- **Rationale**: the whole pipeline is runnable and testable end-to-end without credentials; the interface is the seam `AIProvider → GeminiProvider` promised in AGENTS.md AI rules.
- **Alternatives**: wire Gemini now (violates the seam decision and security rule 1); a fake merged into the service (tight coupling — would have to be rewritten when Gemini lands).

### 8. Persistence: scans + analyses rows, private bucket object

Alembic migration adds `scans` (`id` UUID PK, `user_id` nullable, `guest_session_id` nullable, `status` `completed|failed`, `idempotency_key`, `content_hash`, `storage_path`, `created_at`, `expires_at` nullable) and `analyses` (1:1 via `scan_id`, all `AnalysisResult` fields as typed columns + materialized `risk_level` and safety flag columns). Image object in a private bucket (`scan-images-qa` / `scan-images-prod` per env), path `{user_id|guest_session_id}/{scan_id}/{filename}`, filename sanitized to `^[a-z0-9_]+\\.(jpg|jpeg|png|webp)$`.

- **Rationale**: typed columns let SQLAlchemy enforce the schema clamps at the boundary and let future safety/history queries index `risk_level`; the private bucket satisfies "no public URLs" by construction.
- **Alternatives**: single `scans` table with analysis JSONB (rejected — looser schema, unindexable safety fields, harder migrations later); public bucket + RLS (rejected — violates the permanent-public-URL invariant).

### 9. TTL semantics and read-side expiry

Guests: `expires_at = created_at + 7 days`. Authenticated: `expires_at` NULL. The MVP records the metadata only (no purge job). Read paths (`GET /scan/{id}`, signed-url issuance) treat `expires_at < now` as `NOT_FOUND`, so expired guest scans are not served even before the deferred cleanup lands.

- **Rationale**: satisfies the spec's TTL contract while honoring the locked "no background cleanup jobs in MVP"; read-side enforcement is cheap and privacy-preserving.
- **Alternatives**: implement the purge scheduler (out of scope by locked decision); ignore expiry until cleanup exists (rejected — expired guest data would remain fetchable, violating the privacy contract).

### 10. Signed URLs for image display only

`GET /scan/{id}/signed-url` verifies the requester owns the scan (session match), then issues a 5-minute TTL signed URL for the single object. The analysis response and result UI never embed a public URL; the result screen renders from the normalized image via the signed URL when needed.

- **Rationale**: satisfies `scan.md` no-public-URL requirement with the minimal server surface and standard Supabase signed-URL capability.
- **Alternatives**: return signed URLs inline in `ScanResponse` (rejected — spec mandates issuance via a server-side endpoint, and inline URLs tempt caching/public leaks); use a proxy/stream endpoint (more machinery than needed).

### 11. Mobile navigation: root Stack + hidden tabs group

`src/app/_layout.tsx` becomes a Stack. `(tabs)` group (hidden): Home (camera-first), History stub, Settings stub. Root-level modal routes: `/camera`, `/preview`, `/scan` (processing), `/analysis/[id]`. Deep links: `lifelens://camera`, `lifelens://analysis/{id}`.

- **Rationale**: camera/preview need a controlled forward/back flow with full-screen focus (not tab chrome); the analysis result is shareable/reopenable by ID; stubs slot later tabs without restructuring.
- **Alternatives**: nested per-tab stacks (unneeded complexity for one flow); a single screen with internal sub-states (breaks Android back semantics and deep links).

### 12. Mobile scan state machine (presentation layer)

Scan feature owns a state machine: `idle → capturing → processing → preview → uploading → analyzing → success | error` (with `retry`). All async operations expose loading/success/empty/error/retry; a stage-labeled progress indicator reports upload vs analysis (progress bar collapses to indeterminate for reduced motion). Transitions emit analytics seam events. Fetch: multipart FormData to `{EXPO_PUBLIC_API_URL}/scan/analyze`, 60s upload timeout, 3 retries at 1s/2s/4s, `AbortController` cancel on navigation back.

- **Rationale**: maps the mandated async-state discipline to the literal UX of the feature (which stage is the user waiting on); single bounded retry policy avoids infinite loaders.
- **Alternatives**: ad-hoc per-screen loading flags (rejected — inconsistent cancel/retry and no shared analytics hooks); a library like React Query (heavier than needed for one flow; project prefers existing/light dependencies).

### 13. Result screen structure and risk presentation

`AnalysisResultScreen` row order: risk badge → title/category/confidence → summary → observations → next-step actions → warnings banner → when-to-seek-help → follow-up entry point (disabled for guests; history seam) → disclaimer footer. Risk badge maps tokens: `error`=CRITICAL, `warning`=HIGH, `info`=MEDIUM, `success`=LOW. HIGH/CRITICAL warnings render as a non-dismissible banner. 44×44pt touch targets; `AccessibilityInfo.announceForAccessibility` on success. Glassmorphism via existing `expo-glass-effect`/`expo-blur` with solid fallback on unsupported platforms. Light/dark/system (system default) via existing theme hooks.

- **Rationale**: safety rules require prominent, non-silently-dismissable warnings and conservative presentation; the ordering mirrors analysis semantics (identify → understand → act).
- **Alternatives**: collapsible sections (rejected — hides safety-critical content behind interaction); modal warnings (rejected — interrupts the result scan).

### 14. Testing: Jest + RNTL (mobile), pytest (backend)

Mobile: `jest-expo` preset + `@testing-library/react-native`; test the scan domain/data logic (normalization budget, state machine, idempotency key, error mapping) and the key components; `test`/`lint` scripts added to `package.json`. Backend: pytest with `dependency_overrides` for `StubProvider`, an in-memory/fake storage repo, and a test DB; covers API happy path, 400/413/404/429, schema clamps, safety passthrough, idempotent duplicate, filename sanitizer.

- **Rationale**: locked decision (no complex E2E in scan-v1) and AGENTS.md verification discipline; stubs make backend tests deterministic without Gemini.
- **Alternatives**: Detox/Maestro E2E (deferred — cost outweighs MVP need); no mobile harness (rejected — regression risk on the intertwined camera/network/results flow).

### 15. Configuration additions (all env-driven)

Extend `Settings`: `storage_bucket` (per env), `max_upload_bytes=15MB`, `max_input_dimension=8192`, `min_input_dimension=200` (per `product.md` §2.3), `output_dimension=2048`, `output_quality=85`, `guest_ttl_days=7`, `signed_url_ttl_seconds=300`, `analysis_timeout_seconds=45`, `ai_provider=stub`, `supabase_service_role_key`. Secrets remain environment-injected; never logged.

- **Rationale**: every knobby limit in this design is config, so QA/prod differ only by env and nothing is hardcoded at the seam boundary.
- **Alternatives**: hardcode limits (rejected — ops cannot tune in prod without a deploy).

## Risks / Trade-offs

- **A single sync analysis inside a 15–45s request blocks the response** → Mitigation: bounded server timeout (45s) + client upload-timeout (60s) + explicit cancel + stage-labeled progress; a failure returns `ANALYSIS_FAILED` and the user retries. Trade-off is inherent to the locked synchronous contract (`scan.md`, `ai-analysis.md`).
- **Guest session IDs are spoofable until auth-v1 lands** (anyone can claim a guest header) → Mitigation: guest data is scoped to throwaway session IDs, contains no PII expectations, and the signed-url endpoint re-checks session ownership; document that guest records are at risk of cross-session access wear and outlive no auth. Risk is privacy-sensitive — flagged because it slightly exceeds the "storage-path only" seam scope and is resolved by auth-v1.
- **Expired guest objects linger with no purge job** → Mitigation: read-side expiry (expired scans are 404 via `expires_at`) so data is functionally dead; final physical deletion deferred per locked decision and tracked for the scheduled-cleanup change.
- **Content-hash dedupe keyed too broadly would mix sessions** → Mitigation: dedupe is session-scoped; only exact retries within a session reuse analysis, so no cross-user coupling.
- **Pillow dimension-bomb or pathological decode on 8192px input** → Mitigation: magic-byte + bounds check before full decode, `MAX_IMAGE_PIXELS` guard, then downscale; worst-case memory is bounded by the 8192px cap.
- **A sub-minimum image (below 200×200px) yields a meaningless analysis** → Mitigation: server rejects below-minimum images with 400/`VALIDATION_ERROR` before any analysis; the client compression ladder never upscales or downscales below the minimum resolution.
- **10MB uploads on slow networks feel slow** → Mitigation: client compression ladder targets ≤10MB but typically delivers far less; retries + progress + cancel keep it recoverable; acceptable given capture-first UX.
- **`expo-glass-effect` availability is platform-limited** → Mitigation: themed solid fallback so the result screen never renders unreadable.
- **Response never carries image bytes, only thin JSON + signed-URL access** → Trade-off: the result screen needs a signed URL round-trip to show the source image; accepted to honor the no-public-URL invariant.

## Migration Plan

1. **Backend**: add `pillow`; extend `Settings`; write Alembic migration for `scans`/`analyses`; add `common.py` envelope, `scan.py` schemas, `ScanRepository`/`AnalysisRepository`/storage repo, `AnalysisService`, routers `app/api/scan.py`; wire `StubProvider` + `GuestVerifier` stubs into the app factory. Env: create private bucket `scan-images-qa` and set config in QA deployment.
2. **Backend verify**: run pytest (stub-provider-backed), manual curl happy path + 413/400/404/429 with a dev DB.
3. **Mobile**: `npx expo install expo-image-manipulator expo-haptics expo-crypto`; dev deps `jest-expo @testing-library/react-native`; add `test`/`lint` scripts; reference Expo SDK 57 docs before writing code.
4. **Mobile structure**: restructure root Stack + `(tabs)` hidden group; stub History/Settings; update `app.json` camera/image-picker plugins + permission descriptions.
5. **Feature implementation**: domain/data (normalize, hash, idempotency, API client, state machine) → capture/preview screens → `scan` processing route → analysis result screen (risk badge, warning banner, follow-up entry point disabled, fallback glass).
6. **E2E smoke (dev)**: guest scan via camera and via gallery on an emulator + web upload; confirm a duplicate upload returns the same scan; confirm an >10MB client image is tolerated (compression ladder) and an >15MB server rejection is surfaced as 413.
7. **Ship**: feature branch off `qa` → merge to `qa` (deploy QA) → `prod` (deploy PROD; `app_env=prod` disables `/docs`). **Rollback**: the change is purely additive (new endpoints + new tables, nothing removed or altered) — revert the branch and drop `scans`/`analyses` tables; guest data is ephemeral by design, so no data migration is required.

## Open Questions

Deferrable (no effect on specs, approach, or task breakdown):

- Exact header name for the guest session identity (`X-Guest-Session` vs `X-Session-Id`) — implementation detail resolved during tasks.
- Analytics timestamp bucketing boundaries for `analysis_complete(duration_ms)` — later instrumentation change owns the exact log buckets; the seam only defines event names/fields.
- Whether `GET /scan/{id}/signed-url` should also accept an optional `filename`/`disposition` hint for the web viewer — cosmetic, resolvable in tasks.