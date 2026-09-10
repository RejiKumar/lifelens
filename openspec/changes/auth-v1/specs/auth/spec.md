# Deltas for auth-v1 — capability `auth`

## ADDED Requirements

### Requirement: Backend verifies Supabase JWTs via JWKS

The backend SHALL resolve `Identity` from the `Authorization: Bearer <JWT>` header using PyJWT against the shared Supabase project's JWKS (RS256/ES256), validating signature, issuer, and audience on every request (`auth.md` §0.1). This supersedes the legacy `GuestVerifier` header-based identity: the `x-guest-session` header SHALL NO LONGER be accepted for identity, and every scan/API request SHALL carry a valid Bearer token.

#### Scenario: Valid JWT resolves identity

- **WHEN** a request presents a valid Supabase access token with a correct signature, issuer, and audience
- **THEN** the backend resolves the identity and serves the request with the associated `user_id` scope

#### Scenario: Missing or invalid token rejected

- **WHEN** a request omits the Authorization header, presents a non-Bearer credential, or presents a token that fails signature/issuer/audience validation
- **THEN** the backend returns an unauthenticated error and does not attribute the request to any identity

#### Scenario: Legacy guest header ignored

- **WHEN** a request presents only an `x-guest-session` header with no Bearer token
- **THEN** the backend rejects the request as unauthenticated; the header carries no identity weight

### Requirement: Guest scope derived from the anonymous-auth claim

Guest identity SHALL be derived from Supabase anonymous-auth JWTs: a token whose `is_anonymous` claim is true SHALL map to guest scope keyed by the token's `sub`. Authenticated-user JWTs SHALL map to the user scope keyed by `sub`/`user_id`. The verifier SHALL apply the same bounded guest scope the legacy header system attempted, but now backed by a cryptographically validated identity.

#### Scenario: Anonymous token maps to guest scope

- **WHEN** a request presents a valid JWT with `is_anonymous: true`
- **THEN** the identity is resolved as a guest scoped to their own anonymous `sub`, with guest quota and restricted capabilities

#### Scenario: Authenticated token maps to user scope

- **WHEN** a request presents a valid non-anonymous JWT
- **THEN** the identity is resolved as the authenticated user with their user-level quota and capabilities

### Requirement: Reconciled backend auth surface

The backend SHALL NOT proxy Supabase credential endpoints (sign-up, login, Google token exchange). Mobile SHALL talk to Supabase Auth directly. The backend SHALL expose only identity-aware helpers that operate on the verified token, conservative of the canonical `auth.md` §8 surface. Any identity-only helper (e.g. `GET /auth/me`) SHALL return the resolved identity and SHALL require a valid Bearer token; it SHALL NOT accept credentials or issue tokens.

#### Scenario: Identity helper requires a verified token

- **WHEN** a client calls an identity-viewing backend helper such as `GET /auth/me` with a valid Bearer token
- **THEN** the backend returns the resolved identity derived from the token

#### Scenario: Credential endpoints not proxied

- **WHEN** a client needs to register, log in, or exchange Google credentials
- **THEN** the client performs the flow against Supabase Auth directly; the backend presents no proxied sign-up/login/Google credential endpoint

### Requirement: JWT verification is authoritative and bounded

The verification path SHALL be bounded like all AI/reliability paths: JWKS fetched over HTTPS with caching, verification failures mapped to a standard unauthenticated error, and no token/password material ever emitted to logs, exceptions, or analytics payloads. Verification cost and cached-key lifecycle SHALL be deterministic under load.

#### Scenario: Unverifiable token fails closed

- **WHEN** a token cannot be verified for any reason (bad signature, expired, unknown kid, malformed JSON)
- **THEN** the request is handled as unauthenticated and no identity is attributed