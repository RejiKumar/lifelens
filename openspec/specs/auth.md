# LifeLens — Authentication Specification

## 0. Locked Architecture (MVP)

Decision date: 2026-09-07. This architecture is LOCKED for the auth-v1 implementation.

```
Mobile (Supabase Auth SDK)
  ├─ Email/password  ──────┐
  ├─ Google OAuth   ───────┤→ Supabase session (JWT)
  └─ Anonymous Auth ───────┘        │
                                    ▼
                           FastAPI (backend)
                                    │
                     server-side JWT verification (PyJWT + JWKS)
                                    │
                                    ▼
                            Supabase (RLS, storage, Postgres)
```

- **Identity provider**: Supabase Auth only. No custom identity system.
- **Mobile → Supabase**: the mobile app authenticates through the official Supabase client SDK (email/password, Google OAuth, and **Supabase Anonymous Auth** for the Guest tier).
- **Mobile → FastAPI**: every request carries the Supabase JWT as a Bearer token. FastAPI verifies the JWT server-side on every request (see below).
- **Guest mode uses Supabase Anonymous Auth** (`signInAnonymously`). No custom device-token system will be built. Guest JWTs carry `is_anonymous: true` and are scoped server-side to restricted capabilities.
- **Upgrade/linking** (guest → authenticated, email ↔ Google linking) is designed separately in the **auth-v1** OpenSpec change. It is NOT part of this document's scope.
- AI credentials and service-role keys NEVER exist on the mobile client.

### 0.1 FastAPI JWT Verification Rules

- Verify with **PyJWT** (python-jose is explicitly rejected — unpatched CVEs). Fetch the Supabase project's `.well-known/jwks.json` and validate RS256/ES256 signatures, issuer, and audience.
- Distinguish anonymous vs authenticated via the `is_anonymous` claim to apply restricted guest scope.
- Never log tokens, passwords, or OAuth secrets.

---

## 1. Overview

LifeLens supports three authentication modes: **Guest** (no account), **Email/Password**, and **Google OAuth**. All authentication is handled through Supabase Auth. JWT tokens manage sessions. Every API request carries a token — there are no unauthenticated endpoints in production.

---

## 2. Authentication Methods

### 2.1 Guest Mode

Guest mode allows users to experience the core product without creating an account.

| Property | Behavior |
|---|---|
| Account creation | None. A anonymous session ID is generated and stored in device-local storage. |
| Data storage | `AsyncStorage` only. All scan data, preferences, and history are stored locally on the device. |
| Scan quota | 5 scans per day (configurable server-side) |
| Cloud sync | None. Data is not associated with any server-side identity. |
| Persistence | Data survives app restarts but is lost on app uninstall or data clear. |
| Authentication token | Guest receives a limited-scope JWT from **Supabase Anonymous Auth** (`signInAnonymously`). No local-only fallback token exists. Guests are identified server-side via the `is_anonymous` JWT claim. |
| Upgrade path | Guest can create an account at any time. On signup, local scan history is offered for import. |

**Guest token scope**: Read-only access to AI analysis endpoint. No write access to user data, no chat endpoint access, no data export.

### 2.2 Email/Password

| Property | Behavior |
|---|---|
| Registration | Email + password + name. Email verification required before full access. |
| Login | Email + password. Rate-limited to 5 attempts per 15 minutes per email. |
| Password requirements | Minimum 8 characters. Must contain at least one uppercase, one lowercase, and one number. |
| Password reset | Email-based reset link. Link expires in 1 hour. Single-use. Invalidates all existing sessions on successful reset. |
| Email verification | Sent immediately on registration. User can access app in unverified state with reduced quota (10 scans/day). Full quota restored after verification. |

### 2.3 Google OAuth

| Property | Behavior |
|---|---|
| Flow | OAuth 2.0 via Supabase Auth Google provider. |
| Scope | `openid email profile` |
| Account linking | If a Supabase user already exists with the same email, the Google identity is linked to that account. Otherwise, a new account is created. |
| First login | Name and email are populated from Google profile. No additional fields required. |
| Token handling | Supabase handles the OAuth token exchange. The app receives a Supabase session token. |

---

## 3. Guest Mode — Detailed Behavior

### 3.1 Guest Experience

```
User opens app (no existing session)
    → Splash
    → Onboarding (if first launch)
    → Home screen with guest banner: "You're browsing as a guest"
    → User captures/selects image
    → Image preview → Scan → Result
    → Result saved to local history only
    → User attempts follow-up chat
        → Blocked: "Sign up to ask follow-up questions"
    → User approaches scan limit (3/5)
        → Warning: "You have 2 scans remaining today. Sign up for more."
    → User exhausts limit (5/5)
        → "Daily scan limit reached. Sign up for 20 scans/day — it's free."
        → [Create Account] [Stay as Guest]
```

### 3.2 Guest → Authenticated Conversion

When a guest creates an account (email or Google):

1. **Pre-signup prompt**: Before registration form, show: "Want to keep your scans? Create an account and we'll save your history."
2. **Registration/login**: Standard auth flow (see sections 4.2, 4.3).
3. **Post-auth handoff**: After successful auth:
   - Check `AsyncStorage` for guest scan history.
   - If scans exist: "We found X scans from your guest session. Import them to your account?" [Import All] [Start Fresh]
   - If no scans: Proceed to Home.
4. **Import process**: Guest scans are migrated to the authenticated user's cloud storage. Local guest data is retained until explicit deletion or app reinstall.
5. **Guest banner removed**: After authentication, the guest banner is permanently dismissed.

### 3.3 Guest Session Expiration

| Scenario | Behavior |
|---|---|
| Guest session idle > 30 days | Prompt to create account or acknowledge data may be lost |
| Guest session on new device | No data available. Clear indication that guest data is device-local. |
| App reinstall | Guest data lost. Onboarding re-shown. |

---

## 4. Authentication Flows

### 4.1 Supabase Auth Integration

All authentication is delegated to Supabase Auth. The app never handles raw OAuth secrets or manages its own session tokens.

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   LifeLens   │────▶│  Supabase Auth   │────▶│  Identity       │
│   App        │◀────│  (auth service)  │◀────│  Providers      │
│              │     │                  │     │  (Google, etc.) │
└──────────────┘     └──────────────────┘     └─────────────────┘
       │                       │
       │                  JWT Token
       │                       │
       ▼                       ▼
  AsyncStorage          Supabase API
  (token storage)       (RLS policies)
```

### 4.2 Registration Flow (Email)

```
User taps "Sign Up"
    → Register screen
    → User enters: name, email, password, confirms password
    → Client-side validation:
        - Email format valid
        - Password meets requirements (8+ chars, uppercase, lowercase, number)
        - Passwords match
        - Terms of service accepted
    → POST /auth/register { name, email, password }
    → Server creates Supabase Auth user
    → Server sends verification email
    → Client receives success response
    → User redirected to Home (unverified state, reduced quota)
    → Banner: "Verify your email to unlock full access"
    → User clicks verification link in email
    → Supabase confirms email
    → Next API call reflects verified status
    → Full quota enabled
```

### 4.3 Login Flow (Email)

```
User taps "Log In"
    → Login screen
    → User enters: email, password
    → POST /auth/login { email, password }
    → Server authenticates via Supabase Auth
    → Rate limit check: 5 attempts per 15 minutes per email
        → If exceeded: "Too many attempts. Please try again in X minutes."
    → Success: server returns JWT token
    → Client stores token in expo-secure-store
    → Client fetches user profile via GET /auth/me
    → User redirected to Home
```

### 4.4 Google OAuth Flow

```
User taps "Continue with Google"
    → Client calls Supabase Auth signInWithOAuth({ provider: 'google' })
    → Supabase generates OAuth URL
    → System browser / in-app browser opens Google consent screen
    → User authorizes access
    → Google redirects to Supabase callback URL
    → Supabase completes token exchange
    → Supabase redirects back to app with session data
    → Client receives JWT token
    → Client stores token in expo-secure-store
    → Client fetches user profile via GET /auth/me
    → If first login: User redirected to Home with welcome message
    → If returning user: User redirected to Home
```

### 4.5 Password Reset Flow

```
User taps "Forgot Password?"
    → Forgot Password screen
    → User enters email
    → POST /auth/forgot-password { email }
    → Server sends password reset email via Supabase
    → Success screen: "Check your email for a reset link"
    → User clicks link in email
    → Supabase password reset page opens
    → User enters new password
    → Supabase invalidates all existing sessions for this user
    → User redirected to Login screen
    → Message: "Password updated. Please log in again."
```

### 4.6 Logout Flow

```
User taps "Log Out" (in Settings)
    → Confirmation dialog: "Are you sure you want to log out?"
    → Client clears token from expo-secure-store
    → Client clears user state
    → POST /auth/logout (informs server to revoke refresh token)
    → Client navigates to Home (guest state)
    → Guest banner shown
```

---

## 5. Token Management

### 5.1 JWT Structure

Supabase issues JWTs with the following claims:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "app_metadata": {
    "provider": "email"
  },
  "user_metadata": {
    "name": "User Name",
    "avatar_url": "https://..."
  },
  "exp": 1234567890,
  "iat": 1234567800
}
```

### 5.2 Token Storage

| Token | Storage Location | Purpose |
|---|---|---|
| Access token (JWT) | `expo-secure-store` (encrypted) | Sent with every API request |
| Refresh token | `expo-secure-store` (encrypted) | Used to obtain new access tokens |
| Session data | React state (in-memory) | User profile, quota, preferences |

**Storage keys**:
- `lifelens_access_token`
- `lifelens_refresh_token`
- `lifelens_user_profile` (cached, not source of truth)

### 5.3 Token Refresh

```
Access token expires (default: 1 hour)
    → Next API call receives 401
    → Client interceptor catches 401
    → Client uses refresh token to obtain new access token
    → POST /auth/refresh { refresh_token }
    → Server returns new access + refresh token pair
    → Client stores new tokens in expo-secure-store
    → Original request is retried with new token
    → User experiences no interruption
```

**Refresh failure scenarios**:

| Scenario | Behavior |
|---|---|
| Refresh token expired | Redirect to Login screen. Show: "Your session has expired. Please log in again." |
| Refresh token revoked (server-side) | Same as above. |
| Network unavailable during refresh | Queue request. Retry when network available. If token was expired >24h, force re-login. |
| Both tokens invalid | Clear all auth state. Redirect to Login. |

### 5.4 Session Persistence

| Event | Behavior |
|---|---|
| App killed and reopened | Tokens remain in secure storage. User stays logged in. |
| Device restart | Tokens persist. Session restored. |
| Token expired but refresh valid | Transparent refresh, no user interruption. |
| Token expired and refresh expired | Force re-login. |
| Logout | Both tokens deleted from secure storage. |

---

## 6. Server-Side Enforcement

### 6.1 API Middleware

Every API endpoint is protected by authentication middleware. There are no unauthenticated endpoints in production.

```
Request → Auth Middleware → Route Handler
                │
                ├── Extract token from Authorization header
                ├── Validate JWT signature
                ├── Check token expiration
                ├── Attach user context to request
                └── Reject with 401 if invalid
```

### 6.2 Middleware Types

| Middleware | Scope | Behavior |
|---|---|---|
| `requireAuth` | All authenticated endpoints | Validates JWT, attaches `req.user`. Rejects with 401 if missing/invalid. |
| `requireGuest` | Guest analysis endpoint | Validates guest token or allows unauthenticated with rate limiting. Rejects with 403 if guest quota exceeded. |
| `requirePro` | Premium endpoints | Extends `requireAuth`. Checks `user.role === 'pro'`. Rejects with 403 if not Pro. |
| `requireVerified` | Account management | Extends `requireAuth`. Checks `user.email_confirmed`. Rejects with 403 if unverified. |

### 6.3 Endpoint Protection Matrix

| Endpoint | Middleware | Description |
|---|---|---|
| `POST /auth/register` | None | Public. Account creation. |
| `POST /auth/login` | None | Public. Session creation. |
| `POST /auth/google` | None | Public. OAuth callback. |
| `POST /auth/forgot-password` | None | Public. Password reset request. |
| `POST /auth/refresh` | None | Public. Token refresh. |
| `POST /auth/guest` | Rate limit | Create guest session. Rate limited by device fingerprint. |
| `POST /auth/logout` | `requireAuth` | Invalidate session. |
| `GET /auth/me` | `requireAuth` | Get current user profile. |
| `POST /scans/analyze` | `requireAuth` or `requireGuest` | Submit image for AI analysis. Guest has reduced quota. |
| `GET /scans` | `requireAuth` | List user's scan history. |
| `GET /scans/:id` | `requireAuth` | Get single scan detail. |
| `DELETE /scans/:id` | `requireAuth` | Delete a scan. |
| `POST /scans/:id/chat` | `requireAuth` | Send follow-up message. Free: 5/day. Pro: unlimited. |
| `GET /scans/:id/chat` | `requireAuth` | Get chat history for a scan. |
| `GET /quota` | `requireAuth` | Get current usage and limits. |
| `POST /account/upgrade` | `requireAuth` | Upgrade to Pro. |
| `POST /account/delete` | `requireAuth`, `requireVerified` | Delete account and all data. |

### 6.4 Authorization Checks

Beyond authentication, every endpoint enforces resource-level authorization:

```typescript
// Example: Fetching a scan
async function getScan(req, res) {
  const user = req.user;
  const scanId = req.params.id;

  const scan = await db.scans.findById(scanId);

  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  // Owner check
  if (scan.user_id !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.json(scan);
}
```

**Rules**:
- Users can only read/write their own scans.
- Users can only access their own chat history.
- Users can only delete their own account.
- Guest scans are scoped to the guest session ID and cannot be accessed by authenticated users (and vice versa).
- Admin endpoints (if any) require a separate admin role check — not part of MVP.

---

## 7. Security Rules

### 7.1 Secrets and Sensitive Data

| Rule | Enforcement |
|---|---|
| Never log passwords | Client-side: password fields use `secureTextEntry`. Server-side: password fields are excluded from any logging middleware. |
| Never log tokens | Client-side: tokens are never written to console/logs in production builds. Server-side: auth headers are redacted in request logs. |
| Never log OAuth secrets | Supabase manages OAuth secrets. App never has access to Google client secret. Server logs redact any OAuth-related values. |
| No client-trusted auth state | Server re-validates JWT on every request. Client-side role/quota is for UI only — never used for authorization decisions. |
| No hardcoded secrets | API keys, Supabase URL, and anon key are stored in environment variables. Never committed to version control. |

### 7.2 Token Security

| Property | Value |
|---|---|
| Storage mechanism | `expo-secure-store` (iOS Keychain / Android Keystore) |
| Access level | `WhenUnlocked` (iOS), `ThisDeviceOnly` (both) |
| Biometric protection | Optional. User can enable Face ID / fingerprint to access app. Does not protect individual API calls — protects app launch. |
| Token transmission | Always over HTTPS. Certificate pinning recommended for production. |
| Token expiration | Access: 1 hour. Refresh: 30 days. |

### 7.3 Rate Limiting

| Endpoint Category | Limit | Window | Response |
|---|---|---|---|
| Login | 5 attempts | 15 minutes per email | 429 + retry-after header |
| Register | 3 attempts | 1 hour per IP | 429 |
| Password reset | 3 attempts | 1 hour per email | 429 |
| Guest scan | 5 scans | 24 hours per device | 403 + quota message |
| Authenticated scan | Per plan limit | 24 hours (resets midnight UTC) | 403 + quota message |
| Follow-up chat | Per plan limit | 24 hours per scan | 403 + quota message |

### 7.4 Input Validation

| Field | Validation |
|---|---|
| Email | RFC 5322 format. Normalized to lowercase. |
| Password | Min 8 chars. At least 1 uppercase, 1 lowercase, 1 number. No common passwords (checked against Have I Been Pwned API or similar). |
| Name | 1-100 characters. Stripped of HTML tags. |
| Scan image | File type whitelist (JPEG, PNG, HEIC, WebP). Size limit 15MB. Dimensions validated server-side. |
| Chat message | Max 500 characters. Stripped of control characters. |

### 7.5 Account Deletion

```
User initiates deletion (Settings → Account → Delete Account)
    → Re-authentication required (password or biometric)
    → Confirmation screen lists all data to be deleted:
        - Account credentials
        - All scan history and results
        - All chat messages
        - All usage statistics
        - Payment subscription (cancelled)
    → "This action is irreversible. Your data will be permanently deleted."
    → 30-second cooldown timer (prevents accidental clicks)
    → User confirms deletion
    → POST /account/delete
    → Server:
        1. Cancels any active subscription
        2. Deletes all scan records and images from storage
        3. Deletes all chat messages
        4. Deletes Supabase Auth user record
        5. Deletes associated database records
        6. Invalidates all active tokens
    → Client clears all local data
    → Redirect to Home (guest state)
    → Message: "Your account has been deleted. We're sorry to see you go."
```

**Post-deletion**: A confirmation email is sent to the deleted account's email (last chance to contact support if deletion was unauthorized). The email address is available for re-registration after 30 days.

---

## 8. API Reference

### 8.1 POST /auth/register

Register a new account with email and password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "Jane Doe"
}
```

**Response (201 Created)**:
```json
{
  "user": {
    "id": "uuid-1234",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "free",
    "email_verified": false,
    "created_at": "2026-01-15T10:30:00Z"
  },
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "abc...",
    "expires_in": 3600,
    "token_type": "bearer"
  },
  "message": "Account created. Please verify your email."
}
```

**Error Responses**:
- `400` — Invalid input (missing fields, weak password, invalid email format)
- `409` — Email already registered
- `429` — Rate limit exceeded

---

### 8.2 POST /auth/login

Authenticate with email and password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK)**:
```json
{
  "user": {
    "id": "uuid-1234",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "free",
    "email_verified": true,
    "avatar_url": "https://...",
    "created_at": "2026-01-15T10:30:00Z"
  },
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "abc...",
    "expires_in": 3600,
    "token_type": "bearer"
  }
}
```

**Error Responses**:
- `400` — Missing email or password
- `401` — Invalid credentials
- `403` — Account deleted or suspended
- `429` — Too many login attempts (includes `retry-after` header)

---

### 8.3 POST /auth/google

Handle Google OAuth callback. Called by Supabase client SDK after OAuth flow completes — not called directly by the user.

**Request** (handled by Supabase client SDK):
```json
{
  "provider": "google",
  "access_token": "google-oauth-access-token",
  "refresh_token": "google-oauth-refresh-token"
}
```

**Response (200 OK)** — Same shape as `/auth/login`:
```json
{
  "user": {
    "id": "uuid-5678",
    "email": "user@gmail.com",
    "name": "Jane Doe",
    "role": "free",
    "email_verified": true,
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "created_at": "2026-01-15T10:30:00Z"
  },
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "xyz...",
    "expires_in": 3600,
    "token_type": "bearer"
  },
  "is_new_user": true
}
```

**Notes**:
- If a Supabase user already exists with the same email, the Google identity is linked and the existing user is returned.
- `is_new_user` flag helps the client determine whether to show onboarding or welcome-back UI.

**Error Responses**:
- `400` — Missing or invalid OAuth tokens
- `403` — Google account suspended or restricted

---

### 8.4 POST /auth/guest

Create a guest session. Returns a limited-scope token for anonymous analysis requests.

**Request**:
```json
{
  "device_id": "device-fingerprint-hash"
}
```

**Response (201 Created)**:
```json
{
  "guest_id": "guest-uuid-9012",
  "session_token": "eyJ...",
  "expires_in": 2592000,
  "token_type": "bearer",
  "quota": {
    "daily_limit": 5,
    "used_today": 0,
    "resets_at": "2026-01-16T00:00:00Z"
  }
}
```

**Notes**:
- Guest tokens are longer-lived (30 days) but limited in scope.
- Rate limited by device fingerprint to prevent abuse.
- A new guest token is issued on each app launch if no valid one exists.

**Error Responses**:
- `429` — Device has exceeded guest creation rate limit

---

### 8.5 POST /auth/logout

Invalidate the current session.

**Request**:
```json
{
  "refresh_token": "abc..."
}
```

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200 OK)**:
```json
{
  "message": "Logged out successfully"
}
```

**Notes**:
- Server revokes the refresh token, invalidating all future refresh attempts.
- The current access token remains valid until expiration (short-lived, so minimal risk).
- Client immediately clears tokens from secure storage.

**Error Responses**:
- `401` — Invalid or missing token (still returns 200 to client for graceful logout)

---

### 8.6 POST /auth/refresh

Obtain a new access token using a refresh token.

**Request**:
```json
{
  "refresh_token": "abc..."
}
```

**Response (200 OK)**:
```json
{
  "access_token": "eyJ...new",
  "refresh_token": "def...new",
  "expires_in": 3600,
  "token_type": "bearer"
}
```

**Notes**:
- The old refresh token is invalidated after use (rotation).
- Client must store the new tokens immediately.
- This endpoint is public (no auth header needed) — it validates via the refresh token itself.

**Error Responses**:
- `400` — Missing refresh token
- `401` — Refresh token expired, revoked, or invalid

---

### 8.7 GET /auth/me

Get the current authenticated user's profile and status.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200 OK)**:
```json
{
  "user": {
    "id": "uuid-1234",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "free",
    "email_verified": true,
    "avatar_url": "https://...",
    "created_at": "2026-01-15T10:30:00Z",
    "quota": {
      "daily_limit": 25,
      "used_today": 7,
      "resets_at": "2026-01-16T00:00:00Z"
    },
    "subscription": {
      "plan": "free",
      "status": null,
      "current_period_end": null
    }
  }
}
```

**Notes**:
- This is the primary endpoint for syncing user state after app launch or token refresh.
- Quota information is included to avoid extra API calls.
- Subscription details are included for UI rendering.

**Error Responses**:
- `401` — Invalid or missing token
- `404` — User not found (account deleted but token not yet expired)

---

## 9. Client-Side Auth Architecture

### 9.1 Auth State Machine

```
┌─────────────┐
│   UNKNOWN   │  (app launch, checking stored tokens)
└──────┬──────┘
       │
       ├── tokens found ──▶ GET /auth/me ──▶ success ──▶ AUTHENTICATED
       │                            │
       │                            └── failure ──▶ GUEST
       │
       └── no tokens ──▶ GUEST
```

```
┌─────────────┐         ┌──────────────────┐
│    GUEST    │────────▶│  AUTHENTICATED   │
│             │ signup/ │                  │
│             │ login   │                  │
└─────────────┘◀────────└──────────────────┘
                            logout/401
```

### 9.2 Auth Context Provider

```typescript
interface AuthContext {
  state: 'loading' | 'authenticated' | 'guest';
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

### 9.3 Token Interceptor

Every API request goes through an interceptor that:

1. Reads the access token from secure storage.
2. Attaches it as `Authorization: Bearer <token>`.
3. If the response is `401`:
   - Attempts a token refresh using the stored refresh token.
   - If refresh succeeds: stores new tokens and retries the original request.
   - If refresh fails: clears auth state, redirects to Login.
4. If the response is `429`: displays a rate limit message with retry-after information.

### 9.4 Auth-Gated Navigation

```typescript
// Navigation guard
function AuthGate({ children }) {
  const { state } = useAuth();

  if (state === 'loading') {
    return <SplashScreen />;
  }

  // Guest users see Home but with limited features
  // Authenticated users see Home with full features
  // Login/Register are always accessible
  return children;
}
```

No screen is fully blocked for guests — the guest experience degrades gracefully with banner messaging and feature gating at the action level (e.g., tapping "Follow Up" shows a signup prompt rather than the feature being invisible).
