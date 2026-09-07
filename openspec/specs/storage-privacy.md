# LifeLens Storage and Privacy Specification

## 1. Image Storage

### 1.1 Supabase Storage

LifeLens persists all user-captured images in Supabase Storage. Supabase Storage provides object storage with built-in authentication, row-level security integration, and signed URL generation, making it the single source of truth for all image persistence.

The storage bucket is **private** (access granted only through policies and signed URLs). There are no public buckets used anywhere in the system.

### 1.2 Storage Path Structure

Images are stored under a hierarchical path that scopes access to individual users and scans:

```
{user_id}/{scan_id}/{filename}
```

| Segment   | Description                                                       |
|-----------|-------------------------------------------------------------------|
| `user_id` | The authenticated user's UUID, or the guest session identifier.   |
| `scan_id` | The UUID of the scan record this image belongs to.                |
| `filename`| The sanitized original filename or a generated identifier.        |

Every image is stored inside a user-scoped and scan-scoped directory. This guarantees that object paths never collide across users and that storage policies can enforce access at the directory level.

Filename sanitization rules:

- All filenames are normalized to lowercase.
- Non-alphanumeric characters are replaced with underscores.
- Path traversal sequences (`..`, `/`, `\`) are stripped or rejected.
- The final filename matches the regex `^[a-z0-9_]+\.(jpg|jpeg|png|webp)$`.

### 1.3 Guest Image Storage (Temporary)

Images captured by unauthenticated (guest) users are considered **temporary**:

| Property             | Value                                    |
|----------------------|------------------------------------------|
| Retention            | 7 days from the upload timestamp         |
| Purge mechanism      | Scheduled job, runs automatically        |
| Purge target         | All guest images older than the TTL      |
| Access               | Same signed URL access as authenticated  |
| Upgrade               | Guest scans may be migrated on sign-up    |

Guest images expire exactly **7 days** after creation. A recurring scheduled task (invoked at minimum once per day) scans for guest images and guest-owned scan records whose `created_at` exceeds the TTL, then issues a hard delete of both the storage objects and the associated database rows.

The TTL of **7 days** is fixed and is not configurable per-user. Guest data is ephemeral by design; users are encouraged to create an account to persist their scans.

### 1.4 Authenticated Image Storage (Persistent)

Images belonging to authenticated users are **persistent**. They are never deleted automatically and remain available indefinitely, subject to the account deletion flow described in Section 4.

Authenticated images are only removed in these circumstances:

- The user explicitly deletes a scan from the app.
- The user requests account deletion (Section 4).
- Manual administrative action required by legal or moderation policy.

### 1.5 Image Variants

Each uploaded image produces up to two storage variants:

| Variant     | Visibility | Purpose                                    | Producer       |
|-------------|------------|--------------------------------------------|----------------|
| Original    | Private    | The full-resolution source image           | Client upload  |
| Thumbnail   | Private    | Small, compressed preview (max 512px)      | Server/Edge    |

**Original (private)**: The untouched upload, retained at full resolution. Used only for analysis and for download/export operations.

**Thumbnail (generated)**: A downscaled, compressed version generated automatically after upload. Thumbnails power list views (History, Home), where loading full-resolution originals would be wasteful and slow.

Generation rules:

- Thumbnail long edge is capped at **512 pixels**.
- Thumbnail is encoded as WebP at quality 80.
- Thumbnail is stored at `{user_id}/{scan_id}/thumb.webp`.
- Thumbnails may be cached on the client after first fetch.

### 1.6 No Public URLs

**No image in the system is ever exposed through a permanent public URL.** This is a hard, non-negotiable invariant.

- The storage bucket is private.
- There is no public-read policy on the bucket or any object.
- Client code never constructs or relies on permanent URLs pointing at an image.
- Image URLs are never embedded in shared content, notifications, or emails (existing images referenced in emails must use short-TTL signed URLs).

### 1.7 Signed URLs

Client access to any image is always mediated through **short-lived signed URLs**:

| Property        | Value                                    |
|-----------------|------------------------------------------|
| TTL             | 5 minutes                                |
| Issued by       | Server-side (Supabase service role)      |
| Scope           | Single object or single scan directory   |
| Revocation      | Automatic on expiry; no manual revoke    |

Signed URLs:

- Are generated server-side only; `supabaseUrl`/`anonKey` never appear in client code for storage creation.
- Expire after **5 minutes** to bound the window of exposure.
- Are regenerated on demand when an image is displayed and the prior URL has expired.
- Must be requested through a server endpoint (e.g. `GET /api/storage/signed-url`), never constructed with the client's anon key.

The 5-minute TTL balances the need to display images during a session against the principle of least exposure.

## 2. Data Model

All relational data lives in Supabase Postgres. The following tables are the canonical schema.

### 2.1 `users`

| Column         | Type               | Constraints        | Notes                         |
|----------------|--------------------|--------------------|-------------------------------|
| `id`           | `uuid`             | PK, default `gen_random_uuid()` | Primary identifier       |
| `email`        | `text`             | Unique, not null   | Normalized to lowercase       |
| `name`         | `text`             | nullable           | Display name                  |
| `avatar_url`   | `text`             | nullable           | Federated avatar URL (Google) |
| `auth_provider`| `text`             | not null           | `email` or `google`           |
| `created_at`   | `timestamptz`      | not null, default `now()` |           |
| `updated_at`   | `timestamptz`      | not null, default `now()` |           |

`updated_at` is maintained by a trigger that sets it to `now()` on every update.

### 2.2 `scans`

| Column      | Type          | Constraints      | Notes                                   |
|-------------|---------------|------------------|-----------------------------------------|
| `id`        | `uuid`        | PK               |                                         |
| `user_id`   | `uuid`        | **nullable**, FK → `users.id` | Null for guest scans      |
| `image_path`| `text`        | not null         | Storage path: `{user_id}/{scan_id}/{filename}` |
| `created_at`| `timestamptz` | not null, default `now()` |               |

`user_id` is nullable to support guest scans. Guest scans have `user_id = NULL` and are identified by their matching (non-user-scoped) storage path. Guest rows are purged by the 7-day TTL job.

Index: `scans(user_id)` for history queries.

### 2.3 `analyses`

| Column        | Type          | Constraints          | Notes                              |
|---------------|---------------|----------------------|------------------------------------|
| `id`          | `uuid`        | PK                   |                                    |
| `scan_id`     | `uuid`        | FK → `scans.id`, not null | One analysis per scan          |
| `result_json` | `jsonb`       | not null             | Structured analysis result         |
| `risk_level`  | `text`        | not null             | See risk levels below              |
| `created_at`  | `timestamptz` | not null, default `now()` |                            |

`risk_level` is one of: `low`, `moderate`, `high`, `critical`.

Index: `analyses(scan_id)`.

### 2.4 `chat_messages`

| Column        | Type          | Constraints            | Notes                              |
|---------------|---------------|------------------------|------------------------------------|
| `id`          | `uuid`        | PK                     |                                    |
| `analysis_id` | `uuid`        | FK → `analyses.id`, not null | Parent analysis              |
| `role`        | `text`        | not null               | `user` or `assistant`             |
| `content`     | `text`        | not null               | Message text                       |
| `created_at`  | `timestamptz` | not null, default `now()` |                            |

Index: `chat_messages(analysis_id, created_at)` for chat retrieval.

### 2.5 `entitlements`

| Column       | Type          | Constraints | Notes                              |
|--------------|---------------|-------------|------------------------------------|
| `id`         | `uuid`        | PK          |                                    |
| `user_id`    | `uuid`        | FK → `users.id`, not null |                      |
| `plan`       | `text`        | not null    | `free`, `pro_monthly`, `pro_yearly`|
| `status`     | `text`        | not null    | `active`, `expired`, `canceled`, `trialing` |
| `expires_at` | `timestamptz` | nullable    | Null when lifetime/active-without-expiry |
| `updated_at` | `timestamptz` | not null, default `now()` |                    |

Index: `entitlements(user_id)`.

### 2.6 `quota_usage`

| Column        | Type          | Constraints | Notes                                    |
|---------------|---------------|-------------|------------------------------------------|
| `id`          | `uuid`        | PK          |                                          |
| `user_id`     | `uuid`        | FK → `users.id`, not null |                        |
| `date`        | `date`        | not null    | The UTC calendar day of usage            |
| `scan_count`  | `integer`     | not null, default 0 | Number of scans used by the quota |
| `bonus_count` | `integer`     | not null, default 0 | Scans granted via rewarded ads or other bonuses |

Unique constraint: `(user_id, date)`. Each (user, day) pair has exactly one row; counts are incremented as usage occurs.

## 3. Privacy Rules

The following rules are **non-negotiable invariants** and apply globally, regardless of user tier or build configuration.

### 3.1 Privacy Invariants

1. **Images are private by default, always.** There is no opt-in that makes an image public, and no feature that publishes images. Privacy is the default and only state.

2. **Never expose permanent public image URLs.** All image access is via private storage and short-TTL signed URLs (Section 1.7). Permanent public URLs are prohibited.

3. **Never log raw image data.** Application logs, crash reports, and analytics must never include image binaries, base64 payloads, or image file content. Logs may reference object paths and IDs only.

4. **Never send raw images to analytics.** Analytics SDKs (e.g. analytics/crash/attribution tooling) never receive image data in any form. Only non-image events and metadata are tracked.

5. **Never expose AI API keys.** Provider API keys and secrets live only in server-side environment variables / secret stores. They are never embedded in client builds, logs, responses, or error messages. All AI calls are proxied server-side.

6. **EXIF data is stripped on upload.** Before any image is stored or transmitted to the AI provider, EXIF metadata (GPS location, device, timestamp, author) is removed server-side. Storage is performed on the sanitized image.

7. **Image metadata is not stored beyond path and size.** The database does not retain EXIF-derived fields. The only stored image metadata are the storage `image_path` and, where relevant, file size. No location, device, or camera metadata is persisted.

### 3.2 Enforcement

These invariants are enforced at multiple layers:

- **Server-side processing**: EXIF stripping and signed-URL generation happen only server-side; clients cannot bypass them.
- **Code review checklist**: any change touching image handling is reviewed against this section.
- **Automated tests**: tests assert that no endpoint returns a permanent image URL, and that stored objects have no public ACL.

## 4. Account Deletion

### 4.1 User-Initiated Flow

```
Settings > Delete Account > Confirmation > Email Verification > Grace Period > Purge
```

1. **Request**: The user initiates deletion from Settings → Delete Account.

2. **Confirmation**: A confirmation screen explains that deletion is permanent, irreversible, and results in loss of all scans and analysis history. The user must confirm.

3. **Email verification**: The user must verify the deletion via a link sent to their registered email address. Deletion does not begin until the email link is clicked. This prevents accidental or malicious deletion.

4. **Grace period**: After email verification, a short grace period (the purge must complete within 30 days, per Section 4.3) begins during which the user's data is retained but marked for deletion.

### 4.2 Purge Scope

The purge removes, for the requesting user:

- The `users` record.
- All associated `scans` rows.
- All associated storage images (originals and thumbnails) under `{user_id}/`.
- All associated `analyses` rows.
- All associated `chat_messages` rows.
- Associated `entitlements` and `quota_usage` rows.

Non-image data (subscription entitlement state) is handled through Google Play synchronization (Section 4.3).

### 4.3 Timeline

| Stage                   | When                                           |
|-------------------------|------------------------------------------------|
| Deletion requested      | User clicks email verification link            |
| **Data purged**         | **Within 30 days** of verification             |
| Entitlement cancellation| Via Google Play API at verification time       |
| Audit log retention     | 90 days (anonymized), then destroyed           |

The implementation schedules the purge to occur promptly; the 30-day window is the **upper bound** guaranteed to the user.

### 4.4 Entitlement Cancellation

When deletion is confirmed, the backend calls the **Google Play Developer API** to cancel the user's active subscription, preventing continued billing after account removal.

- The subscription is canceled server-side via the Play Developer API.
- The `entitlements` row is marked `canceled`.
- Billing stops and the user is not charged further.

### 4.5 Irreversibility

Deletion is **irreversible**. Once the purge completes, data cannot be recovered; there is no recycle bin or restore path for deleted accounts. This is made explicit in the confirmation UI.

### 4.6 Audit Log

For compliance and fraud review, an **anonymized audit log** is retained for **90 days** after deletion, then destroyed:

- Contains: deletion timestamp, anonymized user reference (e.g. hashed ID), number of scans/images purged, and entitlement cancellation status.
- Contains **no** personal data, no email addresses, no image content, and no message content.
- Used only for legal/compliance investigation if required.

## 5. Data Export (Future)

The following functionality is specified for a future release and is designed to satisfy GDPR right to data portability.

### 5.1 Export Scope

Users can request an export of all their personal data. The export includes all database records associated with the account.

### 5.2 Format

- All relational data delivered as **JSON** files, one per entity type (`users.json`, `scans.json`, `analyses.json`, `chat_messages.json`, `entitlements.json`, `quota_usage.json`).
- A top-level `manifest.json` describes the dataset, export timestamp, and schema version.

### 5.3 Images

- All images (originals) are included as a **single downloadable archive** (ZIP).
- The archive is downloadable via a short-TTL signed URL.
- Archive generation is asynchronous; the user is notified by email/in-app when ready.

### 5.4 Delivery

- Exports are available for a limited download window (e.g. 7 days) from a signed URL.
- Export links expire after the window.

## 6. GDPR Compliance

### 6.1 Data Processing Consent on Registration

- Registration requires explicit, affirmative consent to the processing of personal data for the purpose of providing LifeLens services.
- Consent is captured at sign-up with a checkbox referencing the full Privacy Policy.
- Consent record (timestamp, version of policy) is stored to demonstrate compliance.
- Consent can be withdrawn (via account deletion).

### 6.2 Right to Access

- Users can access their own data at any time through the app (e.g. History, Scan Detail).
- A full data request returns all stored personal data (see Section 5 for the export mechanism).

### 6.3 Right to Erasure (Account Deletion)

- Account deletion (Section 4) satisfies the right to erasure.
- Data is purged within 30 days as required.

### 6.4 Right to Data Portability

- Satisfied via the Data Export feature (Section 5) delivering data in a structured, machine-readable (JSON) format.

### 6.5 Privacy Policy Link

- The app's Settings screen includes a prominent link to the full Privacy Policy.
- The Privacy Policy is also linked on the registration and onboarding screens.
- The link is also linked from the auth screen.

## 7. Supabase Configuration

### 7.1 Row Level Security (RLS)

**Row Level Security (RLS) is enabled on all tables.** No table allows unrestricted reads or writes.

| Table             | RLS Enabled |
|-------------------|-------------|
| `users`           | Yes         |
| `scans`           | Yes         |
| `analyses`        | Yes         |
| `chat_messages`   | Yes         |
| `entitlements`    | Yes         |
| `quota_usage`     | Yes         |

### 7.2 Policies Enforce User-Scoped Access

Policies restrict access to rows owned by the requesting user:

- `scans`: `USING (user_id = auth.uid())` for select/insert/update/delete. Guest rows (`user_id IS NULL`) are only accessible via service role (server-side).
- `analyses`: joined through `scans` — a user can only see analyses belonging to their own scans.
- `chat_messages`: joined through `analyses` → `scans` — user-scoped.
- `entitlements`: `USING (user_id = auth.uid())`. Users can read only their own entitlement state.
- `quota_usage`: `USING (user_id = auth.uid())`. Users can read/count only their own usage.
- `users`: a user may read/update only their own row (`USING (id = auth.uid())`).

### 7.3 Storage Policies Prevent Cross-User Access

Storage (image) access is governed by storage policies that match the object path structure:

- **Insert**: a user may only insert objects whose path begins with their own `user_id`.
- **Select (read via signed URL request)**: server-side confirms the requesting user owns the path before issuing a signed URL.
- No policy permits reading or listing another user's directory. Object paths are scoped so that enumerating paths cannot traverse into another user's data.

### 7.4 Service Role Used Only Server-Side

- The Supabase **service role** key is used **exclusively** in server-side code (API routes, scheduled jobs, background workers).
- It is never embedded in the client app, never shipped in a build, and never exposed to end users.
- All sensitive operations (signed URL issuance, EXIF stripping, guest purge, account deletion purge) run server-side under the service role.
- Client code interacts only through the application API and the anon key with RLS-enforced access.
