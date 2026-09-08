# Deltas for scan-v1 — capability `storage-privacy`

## MODIFIED Requirements

### Requirement: Guest image storage (temporary, server-side)
Guest scans SHALL be persisted server-side on a temporary basis; the authoritative scan store SHALL NOT be device-local. A guest scan SHALL store its image in the private bucket under a guest-scoped path (`{guest_session_id}/{scan_id}/{filename}`) and SHALL record a scan row with `user_id` NULL. Guest data SHALL be retained for at most 7 days from creation. The 7-day limit SHALL be recorded as TTL metadata on the scan row from the MVP; the recurring purge/scheduled-cleanup job SHALL be implemented in a later change, not in the MVP. "Device-local only" SHALL apply to guest history and export features, not to analysis storage.

#### Scenario: Guest scan stored server-side
- **WHEN** a guest completes a scan
- **THEN** the image object and the scan and analysis rows are created server-side under a guest-scoped path with `user_id` NULL

#### Scenario: Guest TTL recorded in metadata
- **WHEN** a guest scan is created
- **THEN** an `expires_at` value equal to `created_at + 7 days` is stored on the scan row

#### Scenario: Purge enforcement deferred
- **WHEN** a guest scan exceeds its 7-day TTL during the MVP
- **THEN** no background purge job removes it yet; enforcement is deferred to a scheduled-cleanup change that consumes the TTL metadata

## ADDED Requirements

### Requirement: TTL metadata on scans
The `scans` table SHALL include an `expires_at` column (`timestamptz`, nullable). Authenticated scans SHALL have `expires_at` NULL, meaning persistent storage subject only to the account-deletion flow. Guest scans SHALL have `expires_at` set to `created_at + 7 days`.

#### Scenario: Authenticated scan persists
- **WHEN** an authenticated user's scan is created
- **THEN** `expires_at` is NULL and the scan is retained indefinitely subject to account deletion

#### Scenario: Guest scan expiry recorded
- **WHEN** a guest scan is created
- **THEN** `expires_at` is exactly `created_at + 7 days`