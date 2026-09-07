# LifeLens Monetization Specification

## 1. Revenue Model

LifeLens uses a **freemium** model with hybrid monetization:

| Tier / Source          | Description                                              |
|------------------------|----------------------------------------------------------|
| Free tier              | Core functionality is free.                             |
| Ad-supported           | The free tier shows ads to monetize non-paying users.   |
| Subscription (Pro)     | Paid Pro tier for power users.                          |
| Rewarded ads           | Optional ads that grant bonus scan usage to free users. |

- **Freemium**: The core capture → analyze → understand loop is free. Pro removes limitations (quota, ads) and unlocks future advanced capabilities.
- **Ad-supported free tier**: Free users see banner and capped interstitials.
- **Subscription**: Pro is a recurring subscription (Section 5).
- **Rewarded ads**: Free users can voluntarily watch rewarded ads to earn bonus scans (Section 2).

## 2. AdMob Integration

Ads are served through **Google AdMob**.

### 2.1 Banner Ads

- Displayed at the **bottom of certain screens**: **Home and History**.
- Non-intrusive placement outside primary interaction zones; content remains readable.
- Respect safe areas and do not cover the tab bar or FAB.
- Banner refresh per Section 2.5.

### 2.2 Interstitial Ads

- Shown **between scan-flow steps** (e.g. after analysis completes and before returning to Home), **with a frequency cap**.
- Frequency cap: **maximum 1 interstitial per 5 minutes** (Section 3).
- Never interrupting the scan flow mid-action (ad restrictions, Section 3).

### 2.3 Rewarded Ads

- **Optional**, only when the **user initiates** the action (e.g. taps "Watch ad for bonus scan").
- Grants a bonus scan to the free-tier quota.
- Standard rewarded flow: show advert → user watches to completion → **reward granted only on full completion**.
- Reward is verified server-side before the bonus count increments (Section 8).

### 2.4 Ad Load Timing

- **Preload** ad units (banner, interstitial, rewarded) when the app **becomes active** (foreground).
- Interstitial is loaded ahead of the point where it is shown so it is ready when triggered.
- Rewarded ads are preloaded in the background after the app becomes active.
- Loading is failure-tolerant: if an ad fails to load, show flow proceeds without it (no blocking).

### 2.5 Ad Refresh

- **Banner ads refresh every 60 seconds**.
- Interstitial and rewarded ads are one-shot per load; refreshed/reloaded after each display.

## 3. Ad Restrictions (Non-Negotiable)

The following restrictions are **absolute and cannot be relaxed** in any configuration or tier. They exist to protect user trust, safety, and the core product experience.

1. **NEVER show ads during camera capture.** No ad of any type may appear while the camera viewfinder is active.

2. **NEVER show ads during active AI analysis.** No ad may appear while an analysis is being processed.

3. **NEVER show ads on analysis result viewing during the first 10 seconds.** The initial 10 seconds after an analysis result appears is ad-free. Interstitials may only appear after this 10-second window has elapsed.

4. **NEVER show ads on safety warnings.** Any screen presenting a risk warning or safety-critical information is entirely ad-free.

5. **NEVER show ads on auth screens.** Login, registration, and account screens never contain ads.

6. **Maximum 1 interstitial per 5 minutes.** Interstitial frequency is hard-capped; no more than one interstitial may appear in any rolling 5-minute window regardless of user activity or multiple triggers.

7. **Rewarded ad only shown when the user initiates.** Rewarded ads appear only after an explicit, user-initiated action. They are never auto-shown.

These restrictions are enforced:

- In the ad-serving layer (frequency caps, screen gating).
- Via a single **visibility state machine** that classifies the current screen/phase (camera, analyzing, result, warning, auth, normal) and blocks ad display for restricted phases.
- By tests asserting no ad can be triggered during restricted states.

## 4. Ad Configuration

### 4.1 Ad Unit IDs by Environment

Ad unit IDs are separated by environment:

| Build / Env  | Ad Unit Source            | Behavior                        |
|--------------|---------------------------|---------------------------------|
| QA            | **Test ad unit IDs**      | Test IDs used; no real revenue  |
| Production    | **Production ad unit IDs**| Real IDs; real revenue          |
| Development   | (AdMob disabled)          | No ads load or display          |

### 4.2 Storage

- Ad unit IDs are stored in **environment configuration** (e.g. app config / build-time env variables), **not** hard-coded in source.
- The build type (dev/QA/prod) selects the correct set of IDs.
- Configuration is injected at build time.

### 4.3 Disabled in Development Builds

- AdMob is **disabled in development builds**.
- Development builds never load, request, or display ads.
- This prevents accidental test traffic, invalid impressions, and policy violations.
- `Make sure ad unit IDs are `"test"`-only in QA.

## 5. Google Play Billing

Subscriptions are processed via **Google Play Billing**.

### 5.1 Products

| Product ID  | Name        | Billing period | Notes                 |
|-------------|-------------|----------------|-----------------------|
| `pro_monthly` | Pro Monthly | Monthly        |                       |
| `pro_yearly`  | Pro Yearly  | Yearly         | Discounted vs monthly |

### 5.1.1 Pricing (DRAFT)

The following prices are **draft values** and will be revisited before Play Store launch:

| Plan      | Product ID              | Draft price |
|-----------|-------------------------|-------------|
| Pro Monthly | `com.lifelens.pro.monthly` | $4.99 / month |
| Pro Yearly  | `com.lifelens.pro.yearly`  | $39.99 / year |

Rules:
- Prices are configured in the Play Console per region/currency. The app always displays the **store-resolved local price** and never hardcodes prices.
- Final pricing is confirmed during the Play Console release process (see `release.md`).

### 5.2 Yearly Discount

- **Pro Yearly** offers a **discount** versus paying monthly.
- The discount is applied to the yearly price (e.g. ≈ 2 months free), configured in the Play Console.
- The UI presents monthly and yearly options and clearly communicates the yearly savings.

### 5.3 Upgrade Flow

```
Show pricing → Google Play → verify → grant
```

1. **Show pricing**: Present Pro benefits and both pricing options.
2. **Google Play**: User confirms and pays through the Google Play purchase sheet.
3. **Verify**: The backend verifies the purchase via the **Google Play Developer API** (Section 8).
4. **Grant**: Upon verified purchase, the user's entitlement is granted server-side and the app reflects Pro status immediately.

### 5.4 Restore Purchases

- **Restore purchases** is available **on auth screens** (and in Settings).
- Restore queries the Google Play API for the user's active purchases and re-grants entitlements without a new charge.
- Useful for reinstallation, device change, or after account re-login.

### 5.5 Family Sharing (Future)

- Family Sharing support is specified for a **future release**.
- When enabled, entitlement would recognize purchases shared via Google Play Family Library and grant Pro to family members.

## 6. Pro Subscription Benefits

| Benefit                           | Free          | Pro               |
|-----------------------------------|---------------|-------------------|
| Daily scan quota                  | Base quota    | **5× daily quota** |
| Ads                               | Ad-supported  | **No ads**         |
| Priority processing               | No            | **Yes (future)**   |
| Advanced analysis modes           | No            | **Yes (future)**   |
| Export results                    | No            | **Yes (future)**   |

- **5× daily scan quota**: Pro subscribers can perform up to five times the free daily quota of scans.
- **No ads**: Pro removes all banner, interstitial, and rewarded-ad appearances.
- Future benefits are marked as such and staged behind feature flags; they do not block launch of the core Pro entitlement.

## 7. Conversion Points

Conversion points are UX opportunities to present the Pro value proposition. They must never be coercive or interrupt safety-critical flows.

### 7.1 Quota Exhausted

- When the free daily quota is **exhausted**, show an **upgrade prompt**.
- Present the Pro tier as the resolution to the immediate limitation.
- Include both upgrade and (for free users) the option to earn bonus scans via rewarded ads.

### 7.2 After N Scans — Pro Feature Preview

- After a user completes **N scans** (configurable threshold), present a **Pro feature preview**.
- The preview highlights Pro benefits (higher quota, no ads, advanced modes).
- Present at most once per threshold value (not repeatedly) to avoid nagging.

### 7.3 Settings — Subscription Management

- In **Settings**, a **Subscription** section provides access to:
  - Managing/upgrading the current plan.
  - Viewing current plan and renewal status.
  - Restore purchases (Section 5.4).
- Non-subscribers see the upgrade entry point here.

### 7.4 After High-Value Analysis — Pro Upsell

- After a **high-value analysis** (e.g. one ranked informative/useful by the product), present a **subtle** Pro upsell.
- Presentation is non-blocking (e.g. a card or banner), dismissible, and never overlays results in the first 10 seconds (ad-restriction principle).

All conversion prompts respect the ad restrictions and the no-interruption rules for camera/analysis/safety screens.

## 8. Revenue Protection

Revenue and entitlement integrity are enforced primarily **server-side**.

### 8.1 Backend Verifies All Purchases

- The client never self-grants entitlements.
- On purchase, the client sends the purchase token to the backend.
- The backend verifies the purchase **against the Google Play Developer API** using the **service account**. Only on a valid, non-revoked, non-consumed purchase does the backend grant the entitlement.
- A failed or unverifiable purchase results in no entitlement.

### 8.2 Entitlements Expire Correctly

- Entitlements carry an `expires_at` (see data model).
- Expiry is enforced **server-side** at read time and via a scheduled job:
  - When a user's `expires_at` passes, their status becomes `expired` and Pro privileges are revoked.
  - The app re-checks entitlement on relevant actions and on becoming active.
- Renewals (Play auto-renew) update the entitlement's `expires_at` on the next verification.

### 8.3 Refund Handling via Google Play Webhook

- Google Play pushes **real-time developer notifications (RTDN)** via a webhook.
- Events handled:
  - `SUBSCRIPTION_PURCHASED` → grant/refresh entitlement.
  - `SUBSCRIPTION_RENEWED` → extend `expires_at`.
  - `SUBSCRIPTION_CANCELED` → mark `canceled`; keep access until paid-through date.
  - `SUBSCRIPTION_EXPIRED` → mark `expired`.
  - `SUBSCRIPTION_REVOKED` → mark `expired` and revoke immediately.
  - `SUBSCRIPTION_RESTARTED` → restore active status.
- The webhook signature is validated to ensure it originates from Google.
- Refunds/revocations are applied promptly so the user cannot retain Pro after a refund.

### 8.4 Subscription State Synchronized

- Subscription/entitlement state is the **source of truth on the backend** and is synchronized to the client.
- Client entitlement is re-fetched and validated on: app become-active, sign-in, opening Settings/Subscription, and quota-affecting actions.
- On any mismatch between client and server entitlement, the server state wins; the client refreshes accordingly.
- This synchronization prevents the client from operating on stale or fabricated entitlement state.
