# Entitlements & Subscriptions Specification

> LifeLens — Subscription Management, Google Play Billing & Entitlement Verification

---

## 1. Overview

LifeLens uses a tiered entitlement system to control feature access. The entitlement layer determines what a user can do based on their current plan state. All entitlement state is stored and verified server-side. The mobile client displays entitlement state but never determines it. This specification covers entitlement states, Google Play Billing integration, verification flows, subscription lifecycle management, and the relevant API endpoints.

---

## 2. Entitlement States

### 2.1 GUEST

- **Authentication**: None.
- **Identification**: Device ID (hashed, privacy-preserving).
- **Storage**: Device-local only. No cloud data.
- **Features available**:
  - Basic image analysis (limited to 5 scans/day).
  - No scan history persistence.
  - No cloud sync.
  - No export.
- **Entitlement source**: Implicit — no account means GUEST.

### 2.2 FREE

- **Authentication**: Required (email/password, social auth).
- **Identification**: User ID.
- **Storage**: Cloud-persisted.
- **Features available**:
  - Standard image analysis (20 scans/day).
  - Full scan history with cloud sync.
  - Basic export (PNG/JPEG).
  - Scan history across devices.
- **Entitlement source**: Account creation grants FREE automatically.

### 2.3 PRO

- **Authentication**: Required.
- **Identification**: User ID.
- **Storage**: Cloud-persisted with priority processing.
- **Features available**:
  - Increased daily scan quota (100/day).
  - Priority AI processing (future).
  - Advanced analysis modes (future).
  - Enhanced export capabilities (future, including batch export and PDF reports).
- **Entitlement source**: Active, verified Google Play subscription.

---

## 3. Google Play Billing Integration

LifeLens integrates with Google Play Billing for Android subscription management. The backend is the authority on purchase validity — client-side purchase callbacks are used for UX flow only and never permanently grant entitlement.

### 3.1 Product IDs

| Product ID | Type | Duration | Price (example) |
|-----------|------|----------|-----------------|
| `com.lifelens.pro.monthly` | Subscription | 1 month | $4.99/month |
| `com.lifelens.pro.yearly` | Subscription | 1 year | $39.99/year |

> **DRAFT**: These prices are draft values and will be revisited before Play Store launch. The store-resolved price is always displayed to users; prices are never hardcoded in the client.

### 3.2 Purchase Flow

```
User taps "Upgrade to Pro"
       ↓
Client initiates Google Play Billing flow
       ↓
Google Play displays purchase dialog
       ↓
User confirms purchase
       ↓
Google Play processes payment
       ↓
Google Play returns purchase token to client
       ↓
Client sends purchase token to backend (POST /entitlements/purchase/verify)
       ↓
Backend verifies purchase with Google Play Developer API
       ↓
  [Verification succeeds] → Grant PRO entitlement in database, return success
  [Verification fails] → Return error, entitlement not granted
       ↓
Client receives server response
       ↓
  [Server granted entitlement] → Update local entitlement cache, show PRO UI
  [Server denied entitlement] → Show error, keep current entitlement
```

### 3.3 Critical Rule: Client Never Grants Pro

- The client-side billing callback (`onPurchasesUpdated`) is used only to obtain the purchase token and advance the UI flow.
- The callback does **not** set entitlement state.
- Entitlement is granted **only** after backend verification with Google Play.
- If the backend is unreachable after purchase, the client enters a "pending verification" state and retries on next launch.

### 3.4 Purchase Token Storage

- Purchase tokens are stored in the database linked to the user account.
- Tokens are used for: verification, webhook correlation, restore purchases, and re-verification.
- Tokens are encrypted at rest.

---

## 4. Entitlement Verification

### 4.1 Verification Methods

#### 4.1.1 On-Purchase Verification

- Triggered by `POST /entitlements/purchase/verify`.
- Backend calls Google Play Developer API (`purchases.subscriptions.get` or `purchases.subscriptionsv2.get`) with the purchase token.
- Verifies: purchase state, expiry time, payment state, cancellation status.
- Grants or denies entitlement based on verification result.

#### 4.1.2 Webhook Verification (Real-Time)

- Google Play sends server-to-server notifications when subscription state changes.
- Endpoint: `POST /entitlements/webhook`.
- Events handled:
  - `SUBSCRIPTION_RENEWED` — Extend entitlement.
  - `SUBSCRIPTION_EXPIRED` — Revoke entitlement.
  - `SUBSCRIPTION_CANCELLED` — Mark for revocation at period end.
  - `SUBSCRIPTION_PAUSED` — Suspend entitlement during pause.
  - `SUBSCRIPTION_IN_GRACE_PERIOD` — Maintain entitlement with warning.
  - `SUBSCRIPTION_RECOVERED` — Reinstate entitlement after failed payment recovery.
- Webhook payload is verified using the Google Play API key to prevent spoofing.

#### 4.1.3 Periodic Re-Verification (Fallback)

- As a safety net, the backend re-verifies all active PRO entitlements periodically.
- Frequency: Once every 24 hours.
- Purpose: Catch missed webhooks or stale state.
- If re-verification discovers an expired subscription, entitlement is revoked and the user is downgraded to FREE.

### 4.2 Verification States

| Google Play State | LifeLens Entitlement | Behavior |
|-------------------|---------------------|----------|
| ACTIVE | PRO | Full PRO access |
| EXPIRED | FREE | Access revoked, downgrade at next launch |
| CANCELLED (before period end) | PRO | Access maintained until period end, then downgrade |
| CANCELLED (after period end) | FREE | Access revoked |
| PAUSED | FREE | Access suspended during pause period |
| IN_GRACE_PERIOD | PRO | Access maintained, user notified of payment issue |
| PENDING | FREE | Awaiting payment confirmation, no PRO access |

### 4.3 Grace Period Handling

- When a subscription enters grace period (payment failed but Google Play is retrying), the user retains PRO access.
- The user is notified of the payment issue via in-app banner.
- Grace period duration is determined by Google Play (typically 3-30 days depending on payment method and region).
- If payment is recovered during grace period, the subscription returns to ACTIVE.
- If grace period expires without recovery, the subscription moves to EXPIRED.

---

## 5. Entitlement Refresh

### 5.1 Mobile App Refresh Triggers

The mobile app refreshes entitlement state in the following scenarios:

| Trigger | Timing | Method |
|---------|--------|--------|
| App launch | On every cold start | `GET /entitlements/status` |
| After purchase flow | Immediately after purchase verify response | Use verify response |
| App foreground | When returning from background (if >5 minutes since last check) | `GET /entitlements/status` |
| After webhook notification | When push notification received indicating entitlement change | `GET /entitlements/status` |
| Manual refresh | Pull-to-refresh on entitlement screen | `GET /entitlements/status` |

### 5.2 Local Entitlement Cache

- Entitlement status is cached locally on the device.
- Cache TTL: 5 minutes.
- Cache includes: entitlement state (`GUEST`, `FREE`, `PRO`), plan type, expiry timestamp.
- If the cache is expired, the app fetches fresh status before rendering entitlement-dependent UI.
- Cache is cleared on logout.

### 5.3 Force Refresh

A force refresh bypasses the TTL and fetches fresh entitlement state from the backend. Force refresh is triggered by:

- Receipt of a push notification indicating subscription state change.
- Completion of a purchase or restore flow.
- User-initiated action (pull-to-refresh or "refresh" button on entitlement screen).
- Detection of inconsistent state (e.g., local cache says PRO but feature access is denied).

---

## 6. Subscription Lifecycle Management

### 6.1 Upgrade (FREE → PRO)

- **Initiation**: User taps "Upgrade to Pro" and selects a plan (monthly or yearly).
- **Flow**: Google Play Billing flow → purchase token → backend verification → entitlement grant.
- **Immediate effect**: PRO entitlement is active immediately after successful verification.
- **Quota**: Daily scan quota increases to PRO level (100/day) immediately.
- **UI update**: Client refreshes entitlement state and unlocks PRO features.

### 6.2 Downgrade (PRO → FREE)

- **Initiation**: User requests downgrade from subscription management.
- **Flow**: User confirms downgrade → backend marks subscription for cancellation at period end.
- **Immediate effect**: User retains PRO access until the current billing period ends.
- **At period end**: Entitlement transitions to FREE. Quota drops to FREE level (20/day).
- **Data**: All scan history and cloud data is preserved. No data is deleted on downgrade.
- **Re-activation**: User may re-subscribe at any time during or after the current period.

### 6.3 Cancel

- **Initiation**: User cancels subscription through Google Play or app settings.
- **Flow**: Cancellation is processed by Google Play → webhook notification to backend.
- **Immediate effect**: Access maintained until current billing period ends.
- **At period end**: Entitlement transitions to FREE.
- **Data**: Preserved. User can continue using FREE features.
- **Re-activation**: User may re-subscribe before or after period end.

### 6.4 Reactivate

- **Initiation**: User with a cancelled (but still active) subscription chooses to reactivate.
- **Flow**: User taps "Reactivate" → Google Play reactivates subscription → webhook confirmation.
- **Effect**: Subscription continues without interruption. No gap in access.
- **Billing**: User resumes regular billing from the next scheduled date.

### 6.5 Restore Purchases

- **Initiation**: User taps "Restore Purchases" (typically on new device or after reinstall).
- **Flow**: Client calls `POST /entitlements/restore` → backend re-verifies all stored purchase tokens with Google Play → returns current entitlement state.
- **Use cases**:
  - User switched devices.
  - User reinstalled the app.
  - Local entitlement cache was cleared.
  - Entitlement state appears stale.
- **Backend behavior**:
  - Iterates through all purchase tokens associated with the user account.
  - Verifies each with Google Play API.
  - Returns the most recent valid entitlement state.
  - Updates local entitlement cache on the client.

---

## 7. Pro Features

Pro features are defined in the product specification. The entitlement system gates access to the following:

### 7.1 Current Pro Features

| Feature | FREE | PRO |
|---------|------|-----|
| Daily scan quota | 20 | 100 |
| Scan history | 7 days | Unlimited |
| Cloud sync | Yes | Yes (priority) |
| Basic export | PNG/JPEG | PNG/JPEG/PDF |

### 7.2 Future Pro Features

| Feature | Status |
|---------|--------|
| Priority AI processing | Planned — PRO scans are processed ahead of FREE in the queue |
| Advanced analysis modes | Planned — detailed breakdowns, multi-image comparison |
| Enhanced export | Planned — batch export, PDF reports, CSV data export |
| API access | Planned — programmatic access for integrations |

Feature availability is controlled server-side. The entitlement check is performed before feature access is granted, regardless of client capability.

---

## 8. API Endpoints

All endpoints require authentication. GUEST users cannot access subscription endpoints.

### 8.1 POST /entitlements/purchase/verify

Verifies a Google Play purchase and grants entitlement if valid.

**Request Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "product_id": "com.lifelens.pro.monthly",
  "purchase_token": "google_play_purchase_token_abc123",
  "platform": "android"
}
```

**Response (success — new purchase):**
```json
{
  "entitlement": {
    "state": "PRO",
    "plan": "com.lifelens.pro.monthly",
    "activated_at": "2026-09-07T14:30:00Z",
    "expires_at": "2026-10-07T14:30:00Z",
    "auto_renew": true,
    "payment_state": "paid"
  },
  "quota": {
    "plan": "PRO",
    "limit": 100,
    "used": 0,
    "remaining": 100,
    "reset_at": "2026-09-08T00:00:00Z"
  },
  "verified": true
}
```

**Response (success — already verified):**
```json
{
  "entitlement": {
    "state": "PRO",
    "plan": "com.lifelens.pro.monthly",
    "activated_at": "2026-09-07T14:30:00Z",
    "expires_at": "2026-10-07T14:30:00Z",
    "auto_renew": true,
    "payment_state": "paid"
  },
  "quota": {
    "plan": "PRO",
    "limit": 100,
    "used": 5,
    "remaining": 95,
    "reset_at": "2026-09-08T00:00:00Z"
  },
  "verified": true,
  "previously_verified": true
}
```

**Error Responses:**
- `400 Bad Request` — Missing required fields (product_id, purchase_token).
- `401 Unauthorized` — Missing or invalid authentication.
- `403 Forbidden` — Purchase verification failed with Google Play (invalid token, revoked purchase, etc.).
- `409 Conflict` — Purchase token already used for a different user.
- `503 Service Unavailable` — Google Play API unreachable. Client should retry with backoff.

### 8.2 GET /entitlements/status

Returns the current entitlement state for the authenticated user.

**Request Headers:**
- `Authorization: Bearer <token>`

**Response (PRO user):**
```json
{
  "entitlement": {
    "state": "PRO",
    "plan": "com.lifelens.pro.monthly",
    "activated_at": "2026-09-07T14:30:00Z",
    "expires_at": "2026-10-07T14:30:00Z",
    "auto_renew": true,
    "payment_state": "paid",
    "cancel_at_period_end": false,
    "grace_period": false
  },
  "quota": {
    "plan": "PRO",
    "limit": 100,
    "used": 12,
    "remaining": 88,
    "reset_at": "2026-09-08T00:00:00Z"
  }
}
```

**Response (FREE user):**
```json
{
  "entitlement": {
    "state": "FREE",
    "plan": null,
    "activated_at": null,
    "expires_at": null,
    "auto_renew": false,
    "payment_state": null,
    "cancel_at_period_end": false,
    "grace_period": false
  },
  "quota": {
    "plan": "FREE",
    "limit": 20,
    "used": 8,
    "remaining": 12,
    "reset_at": "2026-09-08T00:00:00Z"
  }
}
```

**Response (cancelled but active PRO):**
```json
{
  "entitlement": {
    "state": "PRO",
    "plan": "com.lifelens.pro.yearly",
    "activated_at": "2026-01-15T10:00:00Z",
    "expires_at": "2027-01-15T10:00:00Z",
    "auto_renew": false,
    "payment_state": "paid",
    "cancel_at_period_end": true,
    "grace_period": false
  },
  "quota": {
    "plan": "PRO",
    "limit": 100,
    "used": 45,
    "remaining": 55,
    "reset_at": "2026-09-08T00:00:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` — Missing or invalid authentication.

### 8.3 POST /entitlements/webhook

Receives server-to-server notifications from Google Play. This endpoint is not called by the mobile app — it is called by Google Play's backend.

**Request Headers:**
- `X-Goog-Signature: <google_play_signature>` (for payload verification)

**Request Body (Google Play RTDN notification):**
```json
{
  "version": "1.0",
  "package": "com.lifelens",
  "eventTimeMillis": "1694102400000",
  "subscriptionNotification": {
    "version": "1.0",
    "notificationType": 2,
    "purchaseToken": "google_play_purchase_token_abc123",
    "subscriptionId": "com.lifelens.pro.monthly"
  }
}
```

**Notification Types Handled:**

| Code | Type | Backend Action |
|------|------|----------------|
| 1 | SUBSCRIPTION_RECOVERED | Reinstate PRO entitlement |
| 2 | SUBSCRIPTION_RENEWED | Extend PRO entitlement to new expiry |
| 3 | SUBSCRIPTION_CANCELED | Mark entitlement for expiry at period end |
| 4 | SUBSCRIPTION_PURCHASED | Grant PRO entitlement (initial) |
| 5 | SUBSCRIPTION_EXPIRED | Revoke PRO entitlement, downgrade to FREE |
| 6 | SUBSCRIPTION_IN_GRACE_PERIOD | Maintain PRO, set grace_period flag |
| 7 | SUBSCRIPTION_PAUSED | Suspend PRO entitlement |
| 8 | SUBSCRIPTION_PENDING | No change, log event |
| 9 | SUBSCRIPTION_PENDING_CANCELED | No change, log event |

**Response:**
- `200 OK` — Always return 200 to Google Play to acknowledge receipt. Even if processing fails internally, return 200 and handle asynchronously. Google Play retries on non-200 responses, which can cause duplicate processing.

### 8.4 POST /entitlements/restore

Re-verifies existing purchases and restores entitlement state. Used when a user reinstalls, switches devices, or suspects stale entitlement.

**Request Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "purchase_tokens": [
    "google_play_purchase_token_abc123"
  ]
}
```

**Response (active subscription found):**
```json
{
  "entitlement": {
    "state": "PRO",
    "plan": "com.lifelens.pro.monthly",
    "activated_at": "2026-09-07T14:30:00Z",
    "expires_at": "2026-10-07T14:30:00Z",
    "auto_renew": true,
    "payment_state": "paid"
  },
  "restored": true,
  "tokens_verified": 1,
  "tokens_valid": 1
}
```

**Response (no active subscriptions):**
```json
{
  "entitlement": {
    "state": "FREE",
    "plan": null,
    "activated_at": null,
    "expires_at": null,
    "auto_renew": false,
    "payment_state": null
  },
  "restored": true,
  "tokens_verified": 1,
  "tokens_valid": 0
}
```

**Error Responses:**
- `401 Unauthorized` — Missing or invalid authentication.
- `503 Service Unavailable` — Google Play API unreachable. Client should retry.

### 8.5 POST /entitlements/upgrade

Initiates an upgrade flow. Returns the product options available for the user's region. Does not complete the purchase — the client uses this to populate the upgrade screen before invoking Google Play Billing.

**Request Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "current_state": "FREE",
  "plans": [
    {
      "product_id": "com.lifelens.pro.monthly",
      "name": "Pro Monthly",
      "price": "$4.99/month",
      "price_micros": 4990000,
      "currency": "USD",
      "billing_period": "monthly"
    },
    {
      "product_id": "com.lifelens.pro.yearly",
      "name": "Pro Yearly",
      "price": "$39.99/year",
      "price_micros": 39990000,
      "currency": "USD",
      "billing_period": "yearly",
      "savings": "33%"
    }
  ],
  "trial_available": false
}
```

**Error Responses:**
- `401 Unauthorized` — Missing or invalid authentication.
- `409 Conflict` — User already has an active PRO subscription.

---

## 9. Edge Cases

### 9.1 Multiple Subscriptions

- A user may have only one active PRO subscription at a time.
- If a user attempts to purchase a second subscription while one is active, the backend rejects the verification with `409 Conflict`.
- The user must cancel or let their current subscription expire before subscribing to a different plan.

### 9.2 Plan Switch (Monthly ↔ Yearly)

- Switching between monthly and yearly is handled as a cancellation of the current plan and a new purchase of the target plan.
- The new plan takes effect immediately. The old plan's remaining time is not refunded but access is maintained until the old plan's period end (or the new plan's start, whichever is later).
- Google Play handles proration automatically per their billing policies.

### 9.3 Expired Subscription Data

- When a subscription expires and the user is downgraded to FREE, all scan history and cloud data are preserved.
- The user can access their data but cannot use PRO-only features.
- If the user re-subscribes within 90 days, their data is immediately accessible again.
- After 90 days, data is subject to standard retention policies.

### 9.4 Webhook Ordering

- Google Play webhooks may arrive out of order.
- The backend uses the `eventTimeMillis` timestamp and event type to determine the correct final state.
- For example, a `RENEWED` event with a later timestamp always supersedes an earlier `CANCELED` event.
- A state transition table prevents invalid transitions (e.g., EXPIRED → ACTIVE requires a new purchase, not just a webhook).

### 9.5 Network Failure During Purchase

- If the client loses connectivity after Google Play confirms payment but before the backend verifies:
  - Google Play has charged the user.
  - The backend has not granted entitlement.
  - The client enters a "pending verification" state.
  - On next launch or connectivity restoration, the client sends the purchase token to `POST /entitlements/purchase/verify`.
  - The backend verifies and grants entitlement if valid.
  - The purchase token is valid indefinitely until verified or expired per Google Play policy.

### 9.6 Subscription Paused

- Google Play allows users to pause subscriptions (available in select regions).
- When paused, the user's entitlement is set to FREE for the pause duration.
- The user is notified of the pause in-app.
- When the pause period ends, the subscription resumes automatically and entitlement is restored to PRO.
