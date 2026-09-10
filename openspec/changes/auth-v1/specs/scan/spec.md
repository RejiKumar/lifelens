# Deltas for auth-v1 — capability `scan`

## ADDED Requirements

### Requirement: Scan and analysis ownership binds to verified identity

Every scan, analysis, and follow-up conversation SHALL be owned by the server-verified identity presented on the request — the authenticated user's `sub`/`user_id` or the anonymous-auth `sub` for guests. The device-generated guest session id header SHALL NO LONGER be used as an ownership key. Ownership SHALL be applied server-side from the verified identity and SHALL govern history scoping, idempotency dedup scope, access to stored scans, and signed-url issuance.

#### Scenario: Scans recorded against verified owner

- **WHEN** a scan is created under a verified Bearer token
- **THEN** the stored scan is recorded against that verified identity (`user_id`, or `sub` for anonymous) and cannot be retrieved, listed, or re-signed by any other identity

#### Scenario: History scoped to verified owner

- **WHEN** a verified user or anonymous guest lists their scan history
- **THEN** the listing contains only scans owned by that verified identity; no cross-identity or header-forged history is possible

### Requirement: Guest scan lifecycle restated on anonymous identity

Guest scan data SHALL be attributed to the anonymous-auth `sub` and SHALL follow the temporary-storage rules of the storage/privacy spec (7-day TTL, read-side expiry, `expires_at` metadata, deferred purge). The anonymous `sub` SHALL replace the legacy `guest_session_id` as the guest-identity key for storage paths and dedup constraints. A guest scan is eligible for account-side import only through the anonymous upgrade/linking flow (see `user-auth`), not by re-sending the legacy guest header.

#### Scenario: Temporary guest storage on anonymous sub

- **WHEN** an anonymous-auth user creates a scan
- **THEN** the scan is stored under the anonymous identity with guest TTL/expiry semantics, and reads return 404 after the TTL

#### Scenario: No header-based guest access after change

- **WHEN** a client presents only an `x-guest-session` header, or a `sub` that is not the one in its verified token
- **THEN** the backend rejects access to scan/history/signed-url resources as unauthenticated or unauthorized