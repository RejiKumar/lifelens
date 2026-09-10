# Exploration Report: scan-v1 — Guest-First Visual Scanning (Point → Understand → Act)

Status: **VERDICT — READY FOR PROPOSE** (proposal to be built against the confirmed decisions in §6)

Date: 2026-09-07
Phase: EXPLORE (workflow `explore.md`). No application code modified, no dependencies installed.

---

## 1. Purpose

Explore the scan-v1 change: the guest-first visual scanning experience — capture (camera / gallery / upload) → compress → preview → sync analyze → result — i.e. the "Point → Understand → Act" core loop. Record findings, locked constraints, conflicts between existing specs, and the decisions PROPOSE must confirm. Nothing implemented.

## 2. Change scope (per user direction)

**In scope for the proposal** (does not preclude later changes):
- Mobile: Camera viewfinder (Expo Camera), gallery selection (expo-image-picker), upload path, image processing (resize/compress/format/EXIF strip), preview, scan-in-progress state, and a result view for the sync response.
- Backend: sync scan/analyze endpoint + storage writes (scan/analysis rows + image object) + AIProvider contract placeholder (no Gemini implementation) + safety metadata passthrough (no engine). Auth/quota applied as contract seams, not enforcement.
- Contract placeholders only (no implementation): AI analysis, safety policy, quota, analytics hooks.

**Explicitly out of scope for scan-v1** (separate changes, locked): auth-v1 (all auth implementation), Gemini/real AI provider, safety policy engine, quota/subscriptions/AdMob, history/scan-detail screens + follow-up chat, onboarding/Settings, guest→account linking, iOS first release. MVP stays **synchronous** — no queues/workers/polling/jobs (ai-analysis §1.1).

## 3. Current state (verified on disk)

### Backend (`backend/`)
- FastAPI 0.141, Pydantic v2, SQLAlchemy async + asyncpg, `supabase>=2.31`, `pyjwt`, `httpx`. `pyproject.toml` with ruff/mypy/strict/pytest-asyncio. `app/main.py` mounts **only** `/healthz`. No auth, no image/AI libs (`pillow`, `google-generativeai` absent). Layered layout per `config.yaml` (api/schemas/services/repositories/models/providers/policies) — empty beyond `core/` + `api/health.py`. Tests: `tests/test_health.py` only.

### Mobile (`mobile/`)
- Expo SDK 57 template: Expo Router tabs `Home` (`src/app/index.tsx`) + `Explore` (`explore.tsx`), NativeTabs in `app-tabs.tsx`, themed via `constants/theme.ts` + `hooks/use-theme.ts`. `app.json` has **no camera/image-picker plugin config or permission strings** yet.
- Deps present: `expo-camera`, `expo-image-picker`, `expo-file-system`, `expo-image`, `expo-blur`, `expo-glass-effect`, `expo-symbols`, `expo-secure-store`, `expo-constants`, `expo-device`, `expo-router`, `react-native-reanimated` + `worklets`, gesture-handler, safe-area, screens, web.
- **Missing** for scan spec implementation: `expo-haptics` (capture haptic), `expo-image-manipulator` (resize/compress/crop/EXIF), `expo-crypto` (content hash + idempotency key). Also no test infra: no `jest-expo`, no `lint`/`test` scripts in `package.json`, no MSW. EAS profiles define `EXPO_PUBLIC_API_URL` (dev `http://localhost:8000`, QA `https://api-qa.lifelens.app`, prod `https://api.lifelens.app`).
- Root junk logs `metro.err.log` / `metro.out.log` present (noted, not touching).

### Enforcement context
`openspec/config.yaml` encodes quality gates (backend ruff/mypy/pytest; mobile lint/tsc — mobile gates not yet wired), quota defaults (GUEST 5 / FREE 20 / PRO 100), safety risk set, no-ads-in-scan rules.

## 4. Locked constraints the proposal must honor

- **Sync MVP** (scan.md; ai-analysis.md §1.1): result returned in the same HTTP response; no queues/workers/polling/WebSockets in MVP.
- **AI via backend only**: mobile never calls Gemini/OpenAI; all AI through FastAPI (AGENTS.md AI rules).
- **Auth §0 locked**: Guest = Supabase **Anonymous Auth** (`signInAnonymously`); JWT Bearer on every request; FastAPI verifies with **PyJWT + JWKS**; `is_anonymous` claim scopes guests; **no unauthenticated endpoints in production** (auth.md §6.1). (Implementation lives in auth-v1 — scan-v1 only defines the seam.)
- **Quota server-authoritative** (usage-quota §3): check before AI, decrement after success; client display-only. Guest 5/day.
- **Storage/privacy invariants** (storage-privacy §1/§3): private buckets `scan-images-qa`/`scan-images-prod`; path `{user_id}/{scan_id}/{filename}`; filename regex `^[a-z0-9_]+\.(jpg|jpeg|png|webp)$`; guest TTL 7 days; **no permanent public URLs ever**; access via server-issued 5-min signed URLs; EXIF stripped; no raw images in logs/analytics.
- **Safety backend-authoritative** (safety §4.1): client rendering only; HIGH/CRITICAL non-dismissible; medical disclaimer mandatory; no dangerous instructions.
- **Risk/status conventions**: risk levels LOW/MEDIUM/HIGH/CRITICAL; AnalysisResult schema (ai-analysis §3) is the canonical structured output.
- **Performance targets** (product §5.1, Pixel 6a baseline): camera→live preview <500ms; capture→preview <300ms; preview→scan <200ms; scan→first result <8s; 30fps viewfinder; meaningful loading states (no bare spinner); reduced-motion support; 44pt touch targets; WCAG AA.
- Mobile `AGENTS.md`: consult Expo SDK 57 docs before writing mobile code.

## 5. Findings & spec conflicts (must be resolved in the proposal)

1. **Endpoint contract is async-shaped, model is sync.** `scan.md` §8 defines `POST /scan/upload` → 201 then `POST /scan/analyze` → 202 processing then `GET /scan/:id`; `ai-analysis.md` §8.1 shows 202 + "200 if already analyzed". The locked model (ai-analysis §1.1) returns the final result in the same response. **Recommendation**: single synchronous endpoint (e.g. `POST /scan/analyze`, multipart JSON result in one 200) superseding the split/code-202 flow; keep `GET /scan/{id}` and a signed-url endpoint. Normalize the delta spec accordingly.
2. **Guest persistence contradiction across specs.** `usage-quota.md` §2.1, `auth.md` §2.1, `product.md` §4.1 say guest = device-local only, **no cloud storage**. `storage-privacy.md` §1.3 explicitly stores guest images server-side for **7-day TTL** with `scans.user_id NULL` + purge job. The scan pipeline *must* upload to the server for AI (creds server-side), so "local-only" cannot be literal for processing. **Recommendation (needs user confirmation)**: guest images/rows ARE stored server-side temporarily (storage-privacy governs); "local-only" refers to *history/export features* (persisted history list screen). Either way the delta spec must state it explicitly.
3. **Scheduled jobs vs "no background jobs in MVP".** Guest 7-day purge (storage-privacy §1.3) and quota midnight reset (usage-quota §5.1) are recurring jobs, which the sync-MVP lock excludes. **Recommendation**: defer both to later changes; scan-v1 documents retention policy without building the purge job (and the proposal states enforcement of the TTL lands in a separate "operations jobs" change).
4. **File-size / dimension mismatch.** Client compression target (scan.md §4.2): quality 85%, longest edge ≤2048px, ≤10MB JPEG/WebP. Server acceptance (product.md §2.3, auth.md §7.4): ≤15MB, max 8192×8192px, min 200×200px. **Recommendation**: client emits ≤10MB/≤2048px; server accepts up to 15MB and re-validates (no silent contradiction).
5. **Guest identity header vs anon-JWT.** `usage-quota.md` §8 guests identify via `X-Device-ID` (hashed); `auth.md` §0 says guests carry anon-auth JWTs (no device-token system). **Recommendation**: identity = anon JWT `sub` (auth.md is the locked authority); hashed device ID only as an anti-abuse *rate-limit* hint, never as identity.
6. **`image_url` in scan.md §8.1/§8.3 vs no-public-URL invariant.** Upload response returns `"image_url":"https://..."` and GET returns it — contradicts storage-privacy §1.6/§1.7. **Recommendation**: never return image_url; return scan/analysis IDs + fetch display via server signed-url endpoint only.
7. **EXIF stripping is specified both client- and server-side** (scan.md §4.4, storage-privacy §3.1/6). **Recommendation**: strip on client before transmission (privacy) AND re-sanitize server-side (defense-in-depth).
8. **Server lacks image library for sanitize/thumbnail.** storage-privacy §1.5 requires `thumb.webp` (512px, q80). **Recommendation**: either add `pillow` server-side in scan-v1 (thumbnail + EXIF re-strip) or defer thumbnail generation to the history change (keep it out of the MVP response contract). Confirm in proposal.
9. **Scan/analysis persistence is in-scope.** ai-analysis §1.1 requires results persisted server-side (that's what makes a future async migration non-breaking), and storage-privacy defines the tables. **Recommendation**: scan-v1 writes `scans` + `analyses` rows and the image object; no history *endpoints* (quota/history change later).
10. **Auth enforcement is not buildable in scan-v1** (auth-v1 is a separate change) yet the Scan endpoints must be auth-gated in production. **Recommendation**: define the verify seam (`Authorization: Bearer`, identity resolution, `is_anonymous` handling) as an interface; ship a dev/test stub; real PyJWT/JWKS verification arrives in auth-v1 without changing the Scan contract.
11. **Quota is not buildable in scan-v1** (quota change separate) but the scan response should eventually carry quota. **Recommendation**: response includes optional `quota` field as contract placeholder; enforcement + decrement land with the quota change. 429/`QUOTA_EXCEEDED` envelope already defined (usage-quota §3.3).
12. **Analytics events are contractually required but analytics isn't initialized** (no consent yet; onboarding not built). **Recommendation**: define the event names/params (analytics.md §2.4–2.5) as constants + a logging seam that no-ops until Firebase init exists. Never log image data or content.
13. **Missing mobile deps (expo-haptics, expo-image-manipulator, expo-crypto) + no mobile test/lint infra.** Add deps and (minimal) test setup in APPLY, or defer mobile test harness to a later quality change. Confirm.
14. **Tab/navigation restructure.** Current shell is a 2-tab template (`index`/`explore`). Product shell is Home(camera-first)/History/Quota/Settings with `/camera → /preview → /scan → /analysis/:id` stack. **Recommendation**: scan-v1 introduces the Camera-first Home + camera/preview/scan/result stack on the existing router; build-only tabs for other features.

## 6. Decisions to confirm (user / REVIEW) before/at PROPOSE

1. **Guest persistence model** — confirm: server-side temporary storage (7-day TTL, storage-privacy governs) vs pure device-local stream-through. (Recommended: server-side temp store; TTL enforcement deferred.)
2. **Sync endpoint shape** — single `POST /scan/analyze` (multipart, one 200 with analysis+safety+optional quota) vs two-call (upload then blocking analyze). (Recommended: single call.)
3. **Server image processing** — add `pillow` for server-sanitize + `thumb.webp` in scan-v1, or defer thumbnails to history change. (Recommended: include sanitize; defer thumbnail if it bloats scope.)
4. **Mobile test/lint harness** — stand up jest-expo + lint scripts in scan-v1, or defer to a quality change. (Recommended: minimal — at least the jest-expo unit setup for the scan pipeline logic.)
5. **Scope of result UI** — read-only result view for the sync response (recommended) vs defer all result UI to an analysis-results change.

## 7. Risks / constraints noted

- **Privacy/security gate**: any image handling change is reviewed against storage-privacy §3.2 + AGENTS.md security rules; no public URL, no raw-image logging anywhere.
- **Performance:** scan→result <8s wall-clock on Pixel 6a-class is the sync MVP budget (upload 60s / AI 30s / total 45s, ai-provider §6.1) — client must show stage-labeled progress, cancel + bounded retry (1s/2s/4s, ≤3).
- **Cross-spec drift risk:** the proposal should ship a delta spec reconciling §5 items (endpoint contract, guest storage wording, file-size limits) so main specs aren't left contradictory.
- **Do-not-implement scope creep:** auth, Gemini, safety engine, quota, history, ads, onboarding are explicitly excluded; guard against accidental inclusion in tasks.

## 8. Recommended proposal scope (sketch for PROPOSE)

- **Mobile (`mobile/src/features/scan/`)**: camera screen (Expo Camera, 30fps, capture/flash/flip/perm-request flows per scan.md §3), selection (gallery/upload incl. web drag-drop), processing (resize≤2048, q85, EXIF-strip, HEIC→JPEG), preview with retake/analyze, sync upload+analyze request with idempotency + cancel/retry/duplicate-prevention, result view rendering analysis + safety non-dismissible warnings. Theme tokens, reduced motion, a11y labels throughout. Update Home to camera-first + stack routes.
- **Backend (`backend/app/`)**: `api/scan` (sync endpoint + `GET /scan/{id}` + signed-url endpoint), `schemas/scan.py` (AnalysisResult + response envelope), `services/analysis.py` orchestrator (validate → provider.stub → normalize → safety passthrough → persist → return), `providers/` AIProvider interface + stub impl (real Gemini in a later change), `repositories/` for scans/analyses + storage upload via service role, storage sanitize + path construction `{user_id}/{scan_id}/{filename}`, auth/identity seam (stub verify), optional quota field placeholder. Unit/api tests per testing.md §3.
- **Spec deltas**: reconcile §5 conflicts (endpoint contract, guest storage, size limits, image_url removal, jobs deferral).

## 9. Next steps

- **REVIEW** this report (workflow `review.md`): confirm §6 decisions.
- **PROPOSE** `scan-v1` with the §8 sketch, incorporating confirmed decisions + delta specs.
- Apply only after review approval.

## 10. Files read during exploration

`AGENTS.md`, `openspec/README.md`, `openspec/config.yaml`, all 15 specs (`scan`, `ai-analysis`, `ai-provider`, `storage-privacy`, `auth`, `usage-quota`, `safety`, `analytics`, `product`, `mobile-ui`, `environments`, `entitlements`, `monetization`, `release`, `testing`), archived `foundation-v1/explore-report.md`, `backend/app/**`, `backend/pyproject.toml`, `mobile/app.json`, `mobile/eas.json`, `mobile/package.json`, `mobile/src/app/*`, `mobile/src/components/*`, `mobile/src/hooks/*`.