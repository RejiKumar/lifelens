## 1. Backend — Server-side JWT verification

- [ ] 1.1 Add `SupabaseJWTVerifier` to `app/core/identity.py`: resolves `Identity` from `Authorization: Bearer <JWT>` via PyJWT against the shared project JWKS (RS256/ES256), validating signature, issuer (`{SUPABASE_URL}/auth/v1`), and audience (`authenticated`); authenticated tokens map to `Identity(user_id=<sub>)`, anonymous-auth tokens (`is_anonymous: true`) map to guest scope `Identity(guest_session_id=<sub>)`
- [ ] 1.2 Implement JWKS fetching with bounded HTTP timeout and a short-lived in-process cache (TTL refresh on unknown `kid` then fail closed as unauthenticated on repeat failure)
- [ ] 1.3 Map all verification failures (bad signature, expired, malformed, missing/unknown kid) to the standard unauthenticated error; never emit token material to logs, exceptions, or analytics
- [ ] 1.4 Swap `deps.get_verifier()` from `GuestVerifier` to `SupabaseJWTVerifier`; drop `GuestVerifier` and the `x-guest-session` header path so requests without a valid Bearer token are rejected (breaking change per auth spec)
- [ ] 1.5 Confirm quota keying needs no code change: verify `QuotaService._limit_for`/`commit` and `_owner` flow from the resolved `Identity` (user_id / anon sub), and add an explicit verified-identity test that forged/header-only identity is ignored

## 2. Backend — Reconciled `/auth` surface

- [ ] 2.1 Add `GET /auth/me` returning the resolved identity from the verified Bearer token (authenticated user or guest scope); requires a valid token, takes no credentials
- [ ] 2.2 Ensure no proxied credential endpoints (register/login/google exchange) are exposed; confirm the canonical `/auth/*` credential surface is not implemented on the backend

## 3. Backend — Tests

- [ ] 3.1 Unit tests: valid authenticated JWT → user identity; valid anonymous JWT → guest identity keyed by sub; expired/bad-signature/wrong-issuer/wrong-audience/malformed/missing → unauthenticated (fail closed); unknown `kid` forces JWKS refresh then fails closed
- [ ] 3.2 Unit tests: quota attributed to verified identity only; forged `x-guest-session` header and missing Bearer produce unauthenticated/unauthorized outcomes on quota-bounded endpoints
- [ ] 3.3 Scan/ownership tests: scanned resources bind to verified owner; a token asserting a different `sub` cannot read/list/sign another identity's scans (covers idempotency dedup, history scoping, signed-URL issuance)

## 4. Mobile — Supabase client and auth feature (data/domain)

- [ ] 4.1 Add `@supabase/supabase-js` dependency (add AsyncStorage only if required by the storage adapter; prefer a SecureStore-backed adapter so tokens stay in SecureStore per auth.md §5.2)
- [ ] 4.2 Create `features/auth/` Clean Architecture scaffold (data/domain/presentation) with a Supabase client factory configured from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 4.3 Implement secure token persistence (`lifelens_access_token` / `lifelens_refresh_token` in `expo-secure-store`) and session restore/refresh
- [ ] 4.4 Implement anonymous sign-in bootstrap for guests (replaces `features/scan/data/guest-session.ts`), plus email/password `signIn`/`signUp` and Google OAuth via `expo-web-browser`
- [ ] 4.5 Implement guest → account upgrade/linking via Supabase anonymous upgrade APIs, with guest-scan import behavior per design D6 (surface anon sub scans for import; fallback re-save path honors dedup and TTL)

## 5. Mobile — Auth state machine and context

- [ ] 5.1 Implement `AuthContext` per auth.md §9.2: `state: 'loading' | 'authenticated' | 'guest'`, `signIn`, `signUp`, `signInWithGoogle`, `signOut`, `refreshUser`
- [ ] 5.2 Wire `AuthProvider` at the app root; drive splash/onboarding auth gating per auth.md §9.4 (no screen fully blocked for guests; action-level prompts)
- [ ] 5.3 Add unit tests for the auth state machine and context transitions (loading→authenticated, loading→guest, guest→authenticated, sign-out→guest)

## 6. Mobile — Token interceptor and API-layer migration

- [ ] 6.1 Create a shared request layer (e.g. `features/auth/data/token-provider.ts` or `core/api/`) that attaches `Authorization: Bearer`, refreshes on 401 once, retries, and falls back to guest + sign-in prompt on refresh failure per auth.md §9.3
- [ ] 6.2 Migrate `features/scan/data/scan-api.ts`: replace all `x-guest-session` headers and `sessionId` parameters with the interceptor (`uploadScan`, `fetchScanById`, `fetchSignedUrlById`, `postFollowUp`, `fetchChatHistory`, `fetchScanHistory`)
- [ ] 6.3 Delete `features/scan/data/guest-session.ts`
- [ ] 6.4 Update callers of the migrated scan API to drop now-removed sessionId arguments

## 7. Mobile — UI screens and guest experience

- [ ] 7.1 Add auth screens per mobile-ui delta and mobile-ui §7.11: sign in, sign up, forgot/reset password, Google option, with inline validation and error handling (duplicate account, invalid credentials, network failures)
- [ ] 7.2 Add account screen content in Settings (name, email, avatar, sign-out) and the guest banner on Home with dismissible behavior per auth.md §3.1
- [ ] 7.3 Add the limit-reached prompt (create account / stay as guest) and near-limit warning per auth.md §3.1; add the guest→account import prompt (Import All / Start Fresh) per auth.md §3.2
- [ ] 7.4 Ensure accessibility and reduced-motion compliance for the new screens (touch targets, contrast, screen-reader labels, reduced-motion animation)

## 8. Config and environment

- [ ] 8.1 Add `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` to `.env.example`, `.env.qa.example`, `.env.prod.example`, and document in `docs/deployment.md`
- [ ] 8.2 Add the Supabase client config required by `eas.json` build/CI profiles and confirm no new project or credentials are introduced (shared single-project model)
- [ ] 8.3 Update smoke scripts to attach a real Supabase Bearer JWT (anonymous sign-in) instead of `x-guest-session`

## 9. Verification

- [ ] 9.1 Backend `ruff check .` and `mypy app` pass; new verifier/quota/ownership tests green
- [ ] 9.2 Mobile `tsc --noEmit` and jest suite green (auth state machine, interceptor, migrated scan API)
- [ ] 9.3 Full backend smoke against production Supabase with a real anonymous JWT: analyze 200, follow-up 200, chat-history 200, scan get 200, history 200, quota keyed to the verified anon sub
- [ ] 9.4 Confirm requests without Bearer (and with only `x-guest-session`) fail as unauthenticated; quota cannot be forged
- [ ] 9.5 (Device E2E) Validate Google OAuth flow, guest→account upgrade, and guest-scan import on a physical device