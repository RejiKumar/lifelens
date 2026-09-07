# Usage Quota Specification

> LifeLens — Scan Quota Management, Enforcement & Rewarded Ads

---

## 1. Overview

LifeLens enforces per-user daily scan quotas to manage AI processing costs and tier service levels. All quota logic is server-side. The client displays quota state but never determines or enforces it. This specification defines plan tiers, enforcement mechanics, concurrency handling, reset behavior, rewarded ad integration, and the relevant API endpoints.

---

## 2. Plan Types

### 2.1 GUEST

- **Authentication**: None (unauthenticated).
- **Daily scan limit**: 5 scans per device per day.
- **Data persistence**: Local-only. No cloud storage.
- **Identification**: Device ID (hashed, privacy-preserving).
- **Quota scope**: Per device, not per IP or per session.
- **Limitations**: No scan history, no cloud sync, no export.

### 2.2 FREE

- **Authentication**: Required (email/password, social auth).
- **Daily scan limit**: 20 scans per user per day.
- **Data persistence**: Cloud-persisted. Syncs across devices.
- **Identification**: User ID.
- **Quota scope**: Per user account.
- **Features**: Full scan history, cloud sync, basic export.

### 2.3 PRO

- **Authentication**: Required.
- **Daily scan limit**: 100 scans per user per day.
- **Data persistence**: Cloud-persisted with priority processing.
- **Identification**: User ID.
- **Quota scope**: Per user account.
- **Features**: All FREE features plus increased quota, priority AI processing (future), advanced analysis modes (future), enhanced export capabilities (future).

### 2.4 Configuration

The daily limits above are **server-side configuration defaults** (locked for MVP), not hardcoded values. They are stored as plan configuration in the backend (mirrored in `openspec/config.yaml` under `quota.plans`) and can be adjusted without redesigning the architecture.

---

## 3. Quota Enforcement

All quota enforcement is server-side. The client is a display layer only.

### 3.1 Enforcement Principles

1. **Server-side only**: The backend is the sole authority on quota state. Client-side quota displays are informational and may be stale.
2. **Check before AI call**: Quota is verified before the AI model is invoked. If quota is exhausted, the request fails fast with a clear error — no AI resources are consumed.
3. **Decrement after success**: Quota is decremented only after a successful analysis is returned. If the AI call fails, the analysis is incomplete, or the response is rejected, quota is not consumed.
4. **Client never trusted**: The client may report a quota number, but the backend ignores it and uses its own authoritative count.

### 3.2 Request Flow

```
Client sends scan request
       ↓
Backend authenticates user (or identifies device for GUEST)
       ↓
Backend checks current quota count against plan limit
       ↓
  [Quota available] → Proceed to AI analysis
  [Quota exhausted] → Return 429 Too Many Requests with quota details
       ↓
AI analysis executes
       ↓
  [Analysis succeeds] → Decrement quota, return result + updated quota
  [Analysis fails] → Return error, quota unchanged
```

### 3.3 Error Response (Quota Exhausted)

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily scan limit reached for your current plan.",
    "quota": {
      "limit": 20,
      "used": 20,
      "remaining": 0,
      "reset_at": "2026-09-08T00:00:00Z",
      "plan": "FREE"
    },
    "upgrade_url": "/plans/upgrade",
    "bonus_available": true,
    "bonus_url": "/quota/bonus"
  }
}
```

---

## 4. Concurrency Handling

### 4.1 Atomic Operations

Quota check and decrement must be atomic. The system uses database transactions to prevent race conditions where concurrent requests could both read an available quota and both proceed, resulting in over-consumption.

### 4.2 Transaction Pattern

```
BEGIN TRANSACTION
  SELECT current_used_count FROM quotas WHERE user_id = ? FOR UPDATE
  IF current_used_count >= plan_limit
    ROLLBACK
    RETURN quota_exceeded_error
  UPDATE quotas SET current_used_count = current_used_count + 1 WHERE user_id = ?
COMMIT
```

The `FOR UPDATE` clause locks the row for the duration of the transaction, preventing concurrent modifications.

### 4.3 Concurrent Request Behavior

- Each concurrent request is evaluated independently against the current quota count.
- If two requests arrive simultaneously when only one scan remains, exactly one will succeed and one will receive a quota exceeded error.
- There is no queuing or batching — each request is atomic.

### 4.4 Optimistic Locking

For high-throughput scenarios, optimistic locking may be used as an alternative:

- The quota row includes a version number.
- On read, the version is noted.
- On write, the update includes a `WHERE version = ?` clause.
- If the version has changed (another request modified the row), the transaction retries with the new version.
- Retry limit: 3 attempts before failing with a transient error.

### 4.5 Bonus Scan Handling

Bonus scans (from rewarded ads) share the same atomic counter as base scans. There is no separate counter for bonus vs. base scans — the system tracks total available scans per day.

---

## 5. Quota Reset

### 5.1 Daily Reset

- Quotas reset daily at **UTC midnight (00:00:00 UTC)**.
- The reset is not instantaneous for all users — it is processed as a batch job that runs at UTC midnight with a rolling window.

### 5.2 Configurable Reset Interval

- Default: 24 hours (daily).
- Future plans may support custom reset intervals (e.g., weekly quotas for enterprise).
- Reset interval is stored as part of the plan configuration, not hardcoded.

### 5.3 Timezone Grace Period

- Users in late-timezone UTC offsets (e.g., UTC-12) may experience a brief window where their "day" overlaps with the UTC reset.
- A 15-minute grace period is applied: the old quota persists until 00:15 UTC to avoid abrupt mid-use quota loss.
- After the grace period, the new day's quota is available.

### 5.4 Reset Notification

- The API response always includes `reset_at` — the ISO 8601 timestamp when the next quota reset occurs.
- The client may use this to display a countdown or "resets in X hours" indicator.

---

## 6. Rewarded Ads

### 6.1 Overview

Users may watch a rewarded advertisement to earn bonus scans beyond their plan's daily limit. This is a monetization mechanism that provides value to both the user (more scans) and the platform (ad revenue).

### 6.2 Bonus Scan Configuration

| Parameter | Default Value | Configurable |
|-----------|---------------|--------------|
| Bonus scans per ad | +3 | Yes (per plan) |
| Maximum bonus scans per day | 10 | Yes (per plan) |
| Bonus scan expiry | 24 hours from grant | Yes |
| Cooldown between ads | 60 seconds | Yes |

### 6.3 Ad Flow

```
User taps "Watch Ad for More Scans"
       ↓
Client requests ad placement from AdMob SDK
       ↓
AdMob serves rewarded ad
       ↓
User watches complete ad
       ↓
AdMob SDK delivers reward callback to client
       ↓
Client sends completion proof to backend (POST /quota/bonus)
       ↓
Backend verifies with AdMob server-side callback
       ↓
  [Verification passes] → Grant bonus scans, return updated quota
  [Verification fails] → Return error, no bonus granted
```

### 6.4 Server-Side Verification

- Ad completion is **never** trusted from the client alone.
- The backend verifies the reward with Google AdMob's server-side API using the reward token provided by the AdMob SDK.
- Verification includes: ad placement ID, reward amount, completion status, timestamp.
- If verification fails, no bonus scans are granted and the event is logged for review.

### 6.5 Bonus Scan Expiry

- Bonus scans expire 24 hours after they are granted.
- Expired bonus scans are silently removed from the user's available count.
- The expiry is tracked per-bonus-grant, not as a lump sum. If a user earns +3 at 10:00 and +3 at 14:00, the first +3 expires at 10:00 the next day and the second at 14:00.

### 6.6 Anti-Abuse Measures

- Cooldown between rewarded ad requests: 60 seconds minimum.
- Maximum bonus scans per day capped (default: 10).
- Device-level tracking for GUEST users to prevent multi-account abuse.
- Anomalous patterns (e.g., rapid sequential ad completions from same device) are flagged for review.

---

## 7. Quota Display

### 7.1 Client Display Requirements

The client must display:

- **Remaining scans**: Current available scans for the period (base + active bonus).
- **Plan type**: Current plan (GUEST, FREE, PRO).
- **Reset time**: When the quota resets (displayed as relative time, e.g., "resets in 5 hours").
- **Bonus status**: If bonus scans are active, show bonus scan count and expiry.

### 7.2 Client Polling

- The client fetches quota status after each scan action (included in scan response).
- The client may poll `GET /quota/status` at a maximum rate of once per 30 seconds.
- On app launch, the client fetches quota status as part of the initialization sequence.

### 7.3 Low Quota Warning

When remaining scans drop below a threshold (default: 3), the client displays a visual indicator:

- **Banner or toast**: "Only X scans remaining today."
- **Color**: Yellow/amber for low, red for critical (1 remaining).
- **Position**: Persistent in the UI until quota resets or user upgrades.

### 7.4 Quota Exhausted State

When the user has 0 remaining scans:

- Scan button is disabled or replaced with an upgrade CTA.
- Display shows: "Daily limit reached. Upgrade to Pro for more scans or watch an ad for bonus scans."
- Two action buttons: "Upgrade to Pro" and "Watch Ad for +3 Scans" (if rewarded ads are available for the plan).

---

## 8. API Endpoints

All endpoints require authentication unless operating in GUEST mode (device ID in header).

### 8.1 GET /quota/status

Returns the current quota state for the authenticated user or device.

**Request Headers:**
- `Authorization: Bearer <token>` (authenticated users)
- `X-Device-ID: <device_id>` (GUEST users)

**Response:**
```json
{
  "quota": {
    "plan": "FREE",
    "limit": 20,
    "used": 14,
    "remaining": 6,
    "bonus_active": true,
    "bonus_remaining": 3,
    "bonus_expires_at": "2026-09-08T14:30:00Z",
    "reset_at": "2026-09-08T00:00:00Z",
    "period": "daily"
  }
}
```

**Error Responses:**
- `401 Unauthorized` — Missing or invalid authentication.
- `429 Too Many Requests` — Status endpoint rate-limited (should not occur with normal usage).

### 8.2 POST /quota/consume

Atomically checks and decrements the quota. Returns the updated quota state. This is the primary endpoint called after a successful AI analysis.

**Request Headers:**
- `Authorization: Bearer <token>` (authenticated users)
- `X-Device-ID: <device_id>` (GUEST users)

**Request Body:**
```json
{
  "analysis_id": "analysis_abc123"
}
```

**Response (success):**
```json
{
  "quota": {
    "plan": "FREE",
    "limit": 20,
    "used": 15,
    "remaining": 5,
    "bonus_active": true,
    "bonus_remaining": 3,
    "bonus_expires_at": "2026-09-08T14:30:00Z",
    "reset_at": "2026-09-08T00:00:00Z",
    "period": "daily"
  },
  "consumed": true
}
```

**Error Responses:**
- `401 Unauthorized` — Missing or invalid authentication.
- `429 Quota Exceeded` — No scans remaining.
- `409 Conflict` — Analysis ID already consumed (idempotency protection).

### 8.3 POST /quota/bonus

Adds bonus scans from a completed rewarded ad. Requires server-side ad verification.

**Request Headers:**
- `Authorization: Bearer <token>` (authenticated users)
- `X-Device-ID: <device_id>` (GUEST users)

**Request Body:**
```json
{
  "ad_reward_token": "admob_reward_token_xyz789",
  "ad_placement_id": "ca-app-pub-xxx/yyy",
  "reward_amount": 3
}
```

**Response (success):**
```json
{
  "quota": {
    "plan": "FREE",
    "limit": 20,
    "used": 14,
    "remaining": 6,
    "bonus_active": true,
    "bonus_remaining": 6,
    "bonus_expires_at": "2026-09-08T16:45:00Z",
    "reset_at": "2026-09-08T00:00:00Z",
    "period": "daily"
  },
  "bonus_granted": 3
}
```

**Error Responses:**
- `401 Unauthorized` — Missing or invalid authentication.
- `400 Bad Request` — Invalid reward token or ad placement.
- `403 Forbidden` — Ad verification failed with AdMob.
- `429 Too Many Requests` — Cooldown not met or daily bonus cap reached.
- `409 Conflict` — Reward token already used (idempotency protection).

### 8.4 GET /quota/history

Returns usage history for the last 30 days.

**Request Headers:**
- `Authorization: Bearer <token>` (authenticated users only; GUEST users receive `403 Forbidden`).

**Query Parameters:**
- `days` (optional, integer, default: 30, max: 30) — Number of days to return.

**Response:**
```json
{
  "history": [
    {
      "date": "2026-09-07",
      "scans_used": 12,
      "scans_limit": 20,
      "bonus_scans_used": 3,
      "bonus_scans_granted": 6
    },
    {
      "date": "2026-09-06",
      "scans_used": 20,
      "scans_limit": 20,
      "bonus_scans_used": 3,
      "bonus_scans_granted": 3
    },
    {
      "date": "2026-09-05",
      "scans_used": 8,
      "scans_limit": 20,
      "bonus_scans_used": 0,
      "bonus_scans_granted": 0
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` — Missing or invalid authentication.
- `403 Forbidden` — GUEST users cannot access history.

---

## 9. Edge Cases

### 9.1 Plan Upgrade Mid-Day

When a user upgrades from FREE to PRO mid-day:

- The new quota limit (100) applies immediately.
- The user's current `used` count is preserved (not reset).
- `remaining` is recalculated: `new_limit - used`.

### 9.2 Plan Downgrade Mid-Day

When a user downgrades from PRO to FREE mid-day:

- The downgrade takes effect at the next quota reset, not immediately.
- Until the reset, the user retains their PRO quota for the current period.

### 9.3 Account Deletion

- When a user deletes their account, their quota record is soft-deleted.
- If the user recreates an account, they start fresh with a new quota record.

### 9.4 Device Switching (GUEST)

- GUEST quota is per device ID, not per IP.
- Switching devices resets the effective quota (each device has its own quota).
- Device ID is hashed before storage for privacy.

### 9.5 Bonus Scan Stacking

- Bonus scans from multiple rewarded ads stack (up to the daily bonus cap).
- Each bonus grant has its own 24-hour expiry.
- When both base scans and bonus scans are available, base scans are consumed first.
