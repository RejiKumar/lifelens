# Proposal: Auth-v1 — Real Supabase Authentication

## Why

LifeLens today ships with `GuestVerifier` (see `backend/app/core/identity.py`): every request is
accepted as a device-local guest via an `x-guest-session` header with **no authentication at
all** — the documented acceptable MVP risk. There is no account identity, no cross-device
history, no guest-to-account upgrade, and quota is keyed to a client-generated random id that
any caller can forge or duplicate. `auth.md` §0 already locks the architecture (Supabase Auth
SDK on mobile + server-side JWT/JWKS verification). Auth-v1 implements it, making identity and
quota trustworthy and opening the upgrade path the product depends on.

## What Changes

- **Backend: replace `GuestVerifier` with a real JWT verifier.** New `SupabaseJWTVerifier`
  resolves `Identity` from the `Authorization: Bearer <JWT>` header using PyJWT + the shared
  Supabase project's JWKS (RS256/ES256, issuer/audience validated). Authenticated users map to
  `user_id`; Supabase **anonymous-auth** JWTs (`is_anonymous: true`) map to guest scope. The
  verifier is swapped behind the existing `AuthVerifier` seam in `deps.get_verifier()` — API
  contracts, storage paths, and business logic do not move. **BREAKING**: the `x-guest-session`
  header is no longer accepted for identity; every scan request must carry a Bearer token.
- **Mobile: Supabase Auth client instead of a self-issued session id.** Add `@supabase/supabase-js`:
  anonymous sign-in on first launch (replaces the SecureStore-UUID `guest-session.ts`), email/password
  sign-up and login, and Google OAuth (in-app browser via `expo-web-browser`). Tokens persist in
  `expo-secure-store` (`lifelens_access_token` / `lifelens_refresh_token` per `auth.md` §5.2), a
  request layer attaches `Authorization: Bearer`, and a 401 interceptor refreshes transparently.
- **Auth state machine + context.** Mobile auth feature with `loading | authenticated | guest`
  states, `AuthContext`, splash/onboarding gating, guest banner, and Settings logout — the
  state machine already specified in `auth.md` §9.
- **Quota keyed by verified identity.** `QuotaService._limit_for`/`_owner` now key on the
  verified JWT identity (`user_id`, or the anonymous `sub` for guests) instead of the
  forgeable header id. Guest 5 / FREE 20 / PRO 100 limits remain; PRO stays reserved until
  monetization.
- **Guest → account upgrade (linking).** Anonymous users can sign up/log in and link the
  anonymous identity to the email/Google account; guest scans are importable into the account
  (`auth.md` §3.2). Supabase anonymous upgrade APIs are the mechanism — no custom identity
  system (per `auth.md` §0).
- **Reconcile the `/auth` surface.** `auth.md` mixes direct-SDK flows (§0) with backend
  `/auth/*` endpoints (§8). Auth-v1 resolves this: mobile talks to Supabase Auth directly for
  sign-up/login/OAuth; the backend verifies JWTs and exposes only identity-aware read/login
  helpers (e.g. `/auth/me`) rather than proxying credential endpoints. `auth.md` requirements
  are amended accordingly.
- **No** new entitlement model, no Pro plans, no billing, no history-wide features beyond the
  guest-off-canvas import above.

## Capabilities

### New Capabilities
- `user-auth`: the mobile authentication experience — Supabase client integration, anonymous
  sign-in for guests, email/password and Google sign-in, secure token storage and transparent
  refresh, the auth state machine/context, guest→account upgrade and linking, and logout.

### Modified Capabilities
- `auth`: the backend identity model changes from header-guest to server-verified Supabase
  JWT/JWKS; endpoint protection is enforced from the resolved `Identity`; the `/auth/*`
  server surface is reconciled to direct-SDK flows; guest scope is derived from the
  `is_anonymous` claim (BREAKING — no unauthenticated endpoints).
- `usage-quota`: quota/usage buckets are keyed by verified Supabase identity (`user_id` / anon
  `sub`) rather than the forgeable `x-guest-session`; limit source (guest/free/pro) is derived
  from the verified identity, not client headers.
- `scan` (and analysis ownership): scan/analysis ownership now binds to the verified identity —
  authenticated `user_id` or anonymous-auth `sub` — replacing the device-generated guest session
  id; guest TTL and history scoping rules are restated on this basis.
- `mobile-ui`: add auth screens (sign in, sign up, forgot/reset, account, guest-to-account
  import prompt) and wire the guest banner per `auth.md`; onboarding/splash auth gating lands
  here.

## Impact

- **Backend:** new `SupabaseJWTVerifier` in `app/core/identity.py` + JWKS fetching/caching; swap
  `deps.get_verifier()`; optionally `GET /auth/me` (and identity-only helpers); quota owner keying;
  tests for JWT verify (valid/invalid/expired/anonymous) and quoted identity; no DB schema change
  required for identity (scans already carry `user_id`/`guest_session_id`).
- **Mobile:** add `@supabase/supabase-js` (+ `expo-web-browser` already present) incl. AsyncStorage
  adapter or SecureStore-backed storage; new `features/auth/` (data/domain/presentation), auth
  context and interceptor in the scan/API layer; remove `guest-session.ts`; screens + theme tokens;
  tests.
- **Env/config:** the shared single Supabase project already provides `SUPABASE_URL` +
  `SUPABASE_ANON_KEY`; the anon key is safe for the client; no new project or credentials.
- **Security:** tokens never logged/committed; JWKS fetched over HTTPS; anonymous auth strictly
  scoped; existing `never log / never commit / backend-authoritative` rules carry over.
- **Specs/docs:** new `user-auth` spec; deltas to `auth`, `usage-quota`, `scan`, `mobile-ui`.
- **Operational risk dec:** closed — unauthenticated guest-only identity is replaced by verified
  Supabase identity; device-forged quota ids are no longer possible.