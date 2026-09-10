# Deltas for auth-v1 — capability `user-auth`

## Purpose

Defines the mobile authentication experience: Supabase client integration, anonymous sign-in for guests, email/password and Google sign-in, secure token storage with transparent refresh, the auth state machine and context, guest-to-account upgrade and linking, and logout.

## ADDED Requirements

### Requirement: Guests sign in anonymously via Supabase Anonymous Auth

The mobile client SHALL obtain its identity for the Guest tier through Supabase Anonymous Auth (`signInAnonymously`) on first launch, replacing the self-issued SecureStore session id. The resulting JWT SHALL carry `is_anonymous: true`. The client SHALL NOT construct, forge, or persist a custom guest session identifier, and SHALL NOT call any backend endpoint without a Bearer token.

#### Scenario: First launch starts an anonymous session

- **WHEN** the app launches with no stored Supabase session
- **THEN** the client signs in anonymously through the Supabase client, stores the resulting session securely, and proceeds in guest state with a Bearer token attached to subsequent API calls

#### Scenario: Anonymous session restored

- **WHEN** a guest reopens the app with a stored refresh token
- **THEN** the client refreshes the anonymous session transparently and remains in guest state without re-prompting

### Requirement: Email/password and Google sign-in flows

The client SHALL support email/password sign-up and login and Google OAuth sign-in through the Supabase client SDK (Google via in-app browser, e.g. `expo-web-browser`). Credential entry, error surfacing, and network-failure handling SHALL follow the `mobile-ui` auth screen specifications. Successful authentication SHALL persist the session and transition the auth state to `authenticated`.

#### Scenario: Email sign-up succeeds

- **WHEN** a user submits valid email, password, and name through the sign-up form
- **THEN** the Supabase client creates the account, the client stores the session securely, and the auth state transitions to `authenticated`

#### Scenario: Google sign-in succeeds

- **WHEN** a user completes the Google OAuth flow in the in-app browser
- **THEN** the Supabase client returns a session, the client stores it securely, and the auth state transitions to `authenticated`

#### Scenario: Invalid credentials handled

- **WHEN** the user submits an unregistered email or wrong password
- **THEN** the client surfaces a clear, non-leaking error message and the auth state remains unchanged

### Requirement: Tokens persisted securely and refreshed transparently

Access and refresh tokens SHALL be stored in device-secure storage (`expo-secure-store`) under the keys specified in `auth.md` §5.2. Every API request SHALL attach `Authorization: Bearer <access_token>`. On a `401` response, the client SHALL attempt a refresh using the stored refresh token, retry the original request once on success, and transition to guest state (or re-prompt) on failure. Tokens SHALL never be written to logs or analytics.

#### Scenario: Expired access token refreshes transparently

- **WHEN** an API request returns 401 and the stored refresh token is valid
- **THEN** the client refreshes the session, stores the new tokens, and retries the original request without user intervention

#### Scenario: Refresh failure falls back to guest

- **WHEN** a token refresh fails because the refresh token is invalid or revoked
- **THEN** the client clears auth state, transitions to guest identity, and surfaces a sign-in prompt rather than silently failing the request

### Requirement: Auth state machine and context

The client SHALL implement the auth state machine from `auth.md` §9: states `loading | authenticated | guest`, an `AuthContext` with `signIn`, `signUp`, `signInWithGoogle`, `signOut`, and `refreshUser`. Splash/onboarding auth gating SHALL follow `auth.md` §9.4: no screen is fully blocked for guests; feature gating degrades gracefully with banner messaging and action-level prompts.

#### Scenario: Loading on launch shows splash

- **WHEN** the app launches and is checking stored tokens/session state
- **THEN** the auth state is `loading` and the splash screen is shown until state resolves

#### Scenario: Guest sees degraded features, not blocked screens

- **WHEN** a guest user attempts a gated action such as follow-up chat or history
- **THEN** a sign-up prompt is shown at the action level and the rest of the app remains usable

### Requirement: Guest-to-account upgrade and scan import

The client SHALL support converting an anonymous session to an authenticated account (email/password or Google) and linking the anonymous identity to that account through Supabase's anonymous upgrade APIs, per `auth.md` §3.2. After a successful upgrade, the client SHALL offer to import guest scan history into the account when local guest scans exist. The guest banner SHALL be permanently dismissed once authenticated.

#### Scenario: Upgrade keeps history

- **WHEN** a guest with local scan history signs up or logs in through the upgrade prompt
- **THEN** the anonymous identity is linked to the account, the client prompts to import the guest scans, and imported scans become accessible under the authenticated identity

#### Scenario: Upgrade with no history proceeds cleanly

- **WHEN** a guest with no local scans authenticates
- **THEN** the client proceeds to Home without an import prompt and removes the guest banner

### Requirement: Logout

The client SHALL support signing out from Settings. Sign-out SHALL revoke/clear the stored session, reset auth state to guest (or onboarding), and SHALL NOT delete the user's server-side history or quota record.

#### Scenario: Sign out returns to a usable state

- **WHEN** an authenticated user signs out from Settings
- **THEN** the stored tokens are cleared, the auth state transitions to guest, and the user can continue using the app with guest-scope behavior