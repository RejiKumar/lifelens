# Design: Auth-v1 — Real Supabase Authentication

## Context

The current backend resolves identity through the `AuthVerifier` seam in `app/core/identity.py`, implemented by `GuestVerifier`, which trusts an `x-guest-session` header and falls back to an ephemeral UUID (see proposal.md — Why). The seam is the single collision point: `deps.get_verifier()` → `get_identity()`, and `Identity.owner` / `Identity.is_guest` are consumed everywhere (quota keying, scan ownership, storage paths, dedup constraints, history scoping). Mobile currently sends that header from a SecureStore-generated UUID in `features/scan/data/guest-session.ts`.

`auth.md` §0 (locked) already mandates: Supabase Auth SDK on mobile, anonymous auth for guests, server-side PyJWT + JWKS verification, and `is_anonymous`-claim-based guest scoping. `auth.md` §9 defines the mobile state machine, context, interceptor, and auth-gated navigation. The shared single Supabase project already exists; `SUPABASE_URL` and `SUPABASE_ANON_KEY` are already used server-side for storage, so no new project/credentials are needed. Mobile already has `expo-secure-store`, `expo-web-browser`, `expo-crypto`, and a fetch-based API layer in `scan-api.ts` that currently hardcodes the guest header on each call.

## Goals / Non-Goals

**Goals:**
- Replace the header-guest identity seam with server-verified Supabase JWT identity with zero changes to API contracts, storage paths, or business logic (those consume the same `Identity`, which now just resolves from a real token).
- Mobile authenticates through `@supabase/supabase-js` (anonymous, email/password, Google), stores tokens in SecureStore, attaches `Authorization: Bearer`, and refreshes transparently on 401.
- Quota and scan ownership key on the verified identity (`user_id` / anonymous `sub`), eliminating forged quota ids.
- Support guest → account upgrade via Supabase's anonymous upgrade/linking APIs, with guest-scan import offered on upgrade.
- Reconcile the backend `/auth` surface: mobile talks to Supabase Auth directly; backend only verifies and may add identity-aware helpers like `GET /auth/me`.

**Non-Goals:**
- No new entitlement/plan model, no Pro plans or billing (PRO limit stays reserved; this lands in the Monetization change).
- No custom identity/JWT system (locked: Supabase Auth + PyJWT/JWKS only).
- No cross-device history sync beyond what Supabase identity naturally provides; no history-wide feature work.
- No changes to quota limits, scan TTL rules, or storage schema (identity already slots into existing `user_id`/`guest_session_id` columns).

## Decisions

### D1: `SupabaseJWTVerifier` implements the existing `AuthVerifier` seam

Add `SupabaseJWTVerifier` to `app/core/identity.py` (same module, same seam) and swap it in `deps.get_verifier()`. `verify(authorization, guest_session)` ignores the legacy guest header entirely and returns `Identity` from a validated JWT:

- Authenticated token → `Identity(user_id=<sub>)`, `is_guest=False`.
- Anonymous-auth token (`is_anonymous == true`) → guest scope keyed by the token's `sub`: `Identity(guest_session_id=<sub>)`, which keeps `is_guest=True`, `owner=<sub>`, and every downstream storage path/dedup constraint intact. This deliberately reuses the existing `guest_session_id` field for the anonymous `sub` so no storage/business-logic changes are needed.

Rationale: the proposal and AGENTS.md demand the seam be the sole collision point, and reusing the existing `Identity` shape keeps the diff surgical and testable. Alternatives considered: adding a new `sub` field on `Identity` and threading it through all consumers — rejected because it churns storage paths and history queries for zero behavioral gain.

### D2: PyJWT + JWKS via the shared project's `SUPABASE_URL`, with bounded caching

Parse `Authorization: Bearer <token>`. Decode with PyJWT (`algorithms=["RS256","ES256"]`) using JWKS fetched from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Validate `iss` (`{SUPABASE_URL}/auth/v1`) and `aud` (`authenticated`). Treat `is_anonymous` claim as a boolean and gate guest scope on it.

For MVP, fetch JWKS with a small in-process cache (e.g. cache for 5 minutes keyed by URL, using `aiocache`-free simple TTL or `functools.lru_cache` + time check). Rationale: per AGENTS.md "bounded timeout and bounded retry" applies mainly to AI, but verification should also be deterministic and cheap; caching avoids a network round-trip per request. Alternatives: fetch JWKS per request — rejected (latency, reliability); use `authlib`/`jose` — rejected (`auth.md` §0.1 explicitly rejects python-jose and locks PyJWT).

Errors uniformly map to the standard unauthenticated envelope (no token material in logs/exceptions/analytics, per security rules).

### D3: Reuse `guest_session_id` column for the anonymous `sub` (no schema change)

Scans already carry `user_id` + nullable `guest_session_id` and dedup constraints on `(guest_session_id, idempotency_key)` / `(guest_session_id, content_hash)`. Anonymous tokens resolve to `Identity(guest_session_id=<sub>)`, so all existing ownership/TTL/dedup logic works unchanged. Stored `guest_session_id` now holds the anonymous `sub` rather than a device UUID, which is a transparency improvement (server-authoritative, unforgeable).

Rationale: zero-migration path, keeps `expires_at` TTL semantics per the storage/privacy spec. Alternatives: new `anon_sub` column — rejected, no behavioral need.

### D4: Mobile adds `@supabase/supabase-js` with SecureStore token storage, single auth context

Add dependency `@supabase/supabase-js` (plus `@react-native-async-storage/async-storage` only if Supabase's storage adapter needs it — prefer a SecureStore-backed storage adapter so tokens stay in SecureStore per `auth.md` §5.2 keys `lifelens_access_token`/`lifelens_refresh_token`). `expo-web-browser` is already present for Google OAuth. `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` env vars configure the client (anon key is client-safe by design).

New `features/auth/` feature (Clean Architecture: data/domain/presentation) provides `AuthContext` per `auth.md` §9.2 with `state: 'loading' | 'authenticated' | 'guest'`, `signIn`, `signUp`, `signInWithGoogle`, `signOut`, `refreshUser`, plus anonymous bootstrap. A single `AuthProvider` at the app root drives the state machine and gate.

### D5: Request layer migrates from `x-guest-session` to Bearer via an interceptor

Replace the header plumbing in `scan-api.ts` (five call sites hardcoding `x-guest-session`) with a shared API client that: reads the access token from SecureStore, attaches `Authorization: Bearer`, and on 401 attempts a refresh (stored refresh token) then retries the original request once; on refresh failure clears auth state. This mirrors `auth.md` §9.3. `sessionId` parameters are removed from function signatures; `guest-session.ts` is deleted. The interceptor lives in a shared data-layer module (e.g. `features/auth/data/token-provider.ts` or `core/api/`), driving both scan and any future features.

### D6: Guest → account upgrade via Supabase anonymous upgrade APIs

Supabase supports upgrading an anonymous session: email magic-link/password sign-up or OAuth while an anonymous session is active, then `updateUser`/linking APIs relate the anonymous identity to the account. Mobile offers the import prompt (`auth.md` §3.2) after upgrade when local guest scans exist. Because guest scans are server-side under the anonymous `sub` and import target is the authenticated account, the MVP import uses the same anonymous-`sub`-owned data made visible under the account (no duplicate rows or re-upload). Exact Supabase anonymous-upgrade mechanics are validated during implementation against the current Supabase docs (without them, the fallback is to surface guest history from the anon sub during the session and re-save under the user on import).

### D7: Backend `/auth` surface reconciled to identity-aware helpers only

Remove any proxying intent in the canonical `/auth/*` reference (register/login/google credential endpoints in `auth.md` §8): the backend presents no credential proxying endpoints. Optionally add `GET /auth/me` returning the resolved identity from the verified token. This keeps the backend thin and authoritative, and matches the locked direct-SDK architecture.

## Risks / Trade-offs

- Anonymous `sub` reuses `guest_session_id` storage semantics → Mitigation: scan/history/ownership rules already treat `is_guest` uniformly; fallback re-save path in D6 still honors dedup and TTL. Documented in design so implementers don't "clean up" the reuse.
- Refresh-token 401 loops or refresh unavailable → Mitigation: single retry per request (`auth.md` §9.3), state falls back to guest + sign-in prompt; no infinite retries (UX rule).
- JWKS cache staleness after key rotation → Mitigation: bounded TTL cache (5 min) refetches; decode failures on `kid` not found trigger a cache refresh + single retry, then fail closed as unauthenticated.
- Google OAuth on web preview vs native → Mitigation: use `signInWithOAuth` with `expo-web-browser`/deep-link back; verify on physical device per existing E2E directive; web preview path validated in Expo Go.
- Anonymous upgrade API behavior may differ across Supabase versions → Mitigation: implement against current Supabase docs at code time (design is version-agnostic); the import fallback in D6 covers drift. This is the sole area left to validate during apply; it does not change specs, approach, or task breakdown.
- Removing `x-guest-session` is breaking → Mitigation: backend rejects requests without a valid Bearer; both halves ship together in the same change; smoke tests updated to send real (or test) Supabase JWT.

## Migration Plan

- **Backend**: land `SupabaseJWTVerifier` + `deps.get_verifier()` swap + `/auth/me` + quota stays keyed via existing `Identity.owner` (no code change needed there — keying follows automatically). Add JWT verify tests (valid/invalid/expired/anonymous, fail-closed). Update smoke scripts to attach a Bearer token generated from the shared project.
- **Mobile**: add supabase client + `features/auth/`; wire `AuthProvider` at root; port scan-api calls to the interceptor; delete `guest-session.ts`; add auth screens, guest banner, import prompt; remove `sessionId` params.
- **Config**: add `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` to `.env.example`, `.env.qa.example`, `.env.prod.example`, `eas.json`/CI.
- **Verification**: backend unit tests (verifier + quota-identity); mobile jest for auth state machine/interceptor; full backend smoke against production Supabase with a real anonymous JWT; manual device E2E for Google OAuth + upgrade/import.
- **Rollback**: the change is atomic across backend/mobile (Bearer-only). Rollback = revert `deps.get_verifier()` to `GuestVerifier` + restore header on client behind a feature flag if a hard blocker appears; quota keying is automatically consistent since it reads `Identity`. Note: once `x-guest-session` is dropped server-side, old devices cannot analyze until they update — deployment order ships backend first, and QA/Prod are the same single project, so coordinate the mobile release with the backend deploy.

## Open Questions

- None blocking. Supabase anonymous-upgrade mechanics (D6) are validated at apply time and may pick the email-versus-password variant that the current Supabase SDK supports; either satisfies the specs.