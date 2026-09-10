# Deltas for auth-v1 — capability `mobile-ui`

## ADDED Requirements

### Requirement: Auth screens

The app SHALL provide the auth screens defined in `auth.md` §3 and §4 surface and the canonical `mobile-ui` §7.11: sign in, sign up, forgot/reset password, and a Google sign-in option. Forms SHALL validate input per the auth spec's rules (password requirements, email format), surface clear inline errors for invalid credentials, network failures, and duplicate accounts, and SHALL NOT render unexplained infinite loading states. Sign-up and sign-in SHALL comply with accessibility rules (touch targets, contrast, screen-reader labels, reduced motion, secure-text entry).

#### Scenario: Sign-up form validation

- **WHEN** a user submits a sign-up form with a weak password or malformed email
- **THEN** inline field errors are shown and no authentication request is sent

#### Scenario: Forgot password flow

- **WHEN** a user requests a password reset for a registered email
- **THEN** the reset email flow is triggered through Supabase and a confirmation message is shown

#### Scenario: Duplicate account handled

- **WHEN** a user attempts to sign up with an email that is already registered
- **THEN** a clear duplicate-account error is shown and the user can switch to sign in

### Requirement: Guest banner and gated-feature prompts

The app SHALL show a persistent-but-dismissible guest banner ("You're browsing as a guest") on Home for guest users per `auth.md` §3.1. When a guest attempts a gated action (e.g. follow-up chat, full history), the app SHALL show the action-level sign-up prompt specified in `auth.md` §9.4 rather than blocking the whole screen. Near-limit and limit-reached states SHALL show the message and offer the create-account/stay-guest choice specified in `auth.md` §3.1.

#### Scenario: Guest banner on Home

- **WHEN** the auth state is guest
- **THEN** Home shows a guest banner that can be dismissed, and gated features surface the sign-up prompt at the action level

#### Scenario: Limit-reached prompt

- **WHEN** a guest has exhausted their daily allowance
- **THEN** the Home/result screen shows the daily limit message with create-account and stay-as-guest options

### Requirement: Onboarding/splash auth gating

Splash and onboarding SHALL follow the auth state machine (`auth.md` §9.4): while auth state is `loading`, the splash screen is shown; no screen is fully blocked for guests. First-launch onboarding SHALL be shown before the Home screen when no stored session exists.

#### Scenario: Loading state shows splash

- **WHEN** the app launches and auth state is `loading`
- **THEN** the splash screen is displayed until the state resolves to `authenticated` or `guest`

#### Scenario: First-launch onboarding

- **WHEN** the app launches with no stored session and a completed onboarding is not recorded
- **THEN** subsequent navigation presents the onboarding before Home

### Requirement: Account and guest-to-account import UI

Settings SHALL show the logged-in account info (name, email, avatar, sign-out) for authenticated users per `mobile-ui` §7.10. When a guest with local scan history completes an upgrade, the app SHALL show the import prompt from `auth.md` §3.2 ("We found X scans from your guest session. Import them to your account?") with Import All / Start Fresh choices, and the guest banner SHALL be removed once authenticated.

#### Scenario: Account info and sign-out in Settings

- **WHEN** an authenticated user opens Settings
- **THEN** their account details are shown together with a sign-out action

#### Scenario: Import prompt after upgrade

- **WHEN** an upgraded user has local guest scans
- **THEN** the import prompt with Import All / Start Fresh is shown before Home, and the guest banner is dismissed after the choice