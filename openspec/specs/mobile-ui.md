# LifeLens Mobile UI/UX Specification

## 1. Theme System

### 1.1 Theme Options

LifeLens supports exactly three themes, selectable by the user:

| Theme  | Default | Description                          |
|--------|---------|--------------------------------------|
| System | Yes     | Follows the device's light/dark setting |
| Light  | No      | Always uses the light palette        |
| Dark   | No      | Always uses the dark palette         |

**System** is the default theme. It derives its resolved mode (light or dark) from the operating system's current setting and responds reactively to OS-level theme changes.

### 1.2 System Theme Behavior

- When `System` is selected, the app reads `Appearance.getColorScheme()` (React Native) to determine the active mode.
- When the OS setting changes while the app is in the foreground or resuming, the app re-evaluates and applies the matching palette automatically.
- `System` is not a distinct palette; it is a resolver that maps to `Light` or `Dark`.

### 1.3 Persistence

- The selected theme (`system`, `light`, `dark`) is persisted in user preferences via a persisted store (AsyncStorage-backed).
- The stored value survives app restarts and re-installs where applicable for the current user.
- The persisted value is read on app startup before the first frame renders, preventing a flash of the wrong theme.

### 1.4 Immediate Application Without Restart

- Changing the theme applies **immediately**, with no app restart required.
- All theme tokens are consumed reactively; switching updates every screen, component, and overlay in place.
- A smooth cross-fade (200–300ms, Section 3.4) accompanies the switch for a polished feel.

### 1.5 Color Tokens

All theme values are defined as **color tokens**. Components never use raw color literals; they consume semantic tokens that resolve per mode.

Semantic token set:

| Token                  | Purpose                                |
|------------------------|----------------------------------------|
| `background`           | Primary screen background (aurora base)|
| `surface`              | Standard card/surface background       |
| `surfaceElevated`      | Elevated surface                       |
| `surfaceGlass`         | Frosted-glass surface (translucent)    |
| `textPrimary`          | Primary text                           |
| `textSecondary`        | Secondary/muted text                   |
| `textOnAccent`         | Text on accent-colored elements        |
| `accent`               | Primary brand accent                   |
| `accentMuted`          | Muted accent (secondary accent)        |
| `border`               | Standard borders/dividers              |
| `shadow`               | Shadow color per mode                  |
| `error` / `success` / `warning` / `info` | Semantic status colors  |
| `overlay`              | Semi-transparent modal/dim overlay     |
| `auroraTop` / `auroraMid` / `auroraBottom` | Aurora gradient stops  |

Implementation: a `ThemeProvider` react context exposes the resolved palette; a `useTheme()` hook returns the current token object and resolved mode.

## 2. Visual Direction

### 2.1 Glassmorphism

- Cards and overlays use **frosted glass** effects: translucent surfaces with backdrop blur and subtle borders.
- Glass is applied to: elevated cards, bottom sheets, modals, tab bar, floating action button, and overlays.
- Glass surfaces use `surfaceGlass` with a blur radius tuned per platform; a lighter border (`border` token) defines the glass edge.
- Backdrop blur is disabled or reduced on low-end devices (Section 3.1) to preserve performance.

### 2.2 Aurora Gradients

- The background uses **aurora gradients**: layered, softly blended radial/linear gradient blobs in the brand palette (`auroraTop`, `auroraMid`, `auroraBottom`).
- Aurora is subtle — low saturation, gentle blending — so it never competes with content.
- Aurora is static on screen backgrounds, and may subtly drift with a slow loop where device performance allows.

### 2.3 Premium Cards

- Cards are **elevated, rounded, with subtle shadows**.
- Corner radius: **16px** for standard cards, **20px** for elevated/featured cards.
- Shadows are soft and subtle, using the `shadow` token (larger on dark mode, where shadows read differently — elevated via overlays/borders).
- Cards include generous internal padding (16–20px).

### 2.4 Modern Typography

- Clean **sans-serif** type (system font stack for platform consistency).
- Clear hierarchy enforced through size, weight (`bold`/`semibold` vs `regular`), and color (`textPrimary` vs `textSecondary`).
- Scale: caption 12, body 15–16, subheadline 18, title 22, large-title 30.
- Line height tuned for readability (1.3–1.4× font size).

### 2.5 Subtle Depth: Layered Elevation

A three-level elevation system:

| Level | Element                     | Treatment                       |
|-------|-----------------------------|---------------------------------|
| 0     | Base surfaces, plain cards  | No elevation                    |
| 1     | Elevated cards, inputs      | Small shadow / hairline border  |
| 2     | Overlays, FAB, tab bar      | Stronger shadow / glass + blur  |

Elevation is conveyed through shadows, borders, and backdrop blur, never through harsh outlines.

### 2.6 Smooth Animations

- Animations are **purposeful and not excessive**. Every animation communicates a state change, transition, or feedback event.
- Default transition duration: **200–300ms** (Section 3.4).
- Animations use the eased timing functions in Section 3.5.

### 2.7 Polished Transitions

- **Screen transitions**: slide/fade between stack screens; native-driven for smoothness.
- **Modal presentations**: bottom sheets slide up with a background dim fade; centered dialogs scale+fade in.
- **Tab switches**: lightweight cross-fade or instant with a subtle scale on the active icon.
- Transitions are consistent in duration and easing across the app.

### 2.8 Attractive Loading States

- **Skeleton screens**: content-shaped placeholders that mirror final layout during data load.
- **Shimmer effect**: a soft, sweeping highlight across skeleton blocks; driven by native driver where possible so it stays smooth.
- Skeletons appear on Home, History, and Scan Detail while loading.
- Shimmer is subtle and respects reduced motion (Section 3.3).

### 2.9 Responsive Layouts

- Layouts respect **safe areas** (notch, home indicator) on iOS and Android.
- Keyboard handling: inputs scroll into view; chat input stays visible above the keyboard without obstruction.
- Layouts adapt to small and large screens; no fixed dimensions that break on narrow devices.
- Font scaling is respected (Section 6.5).

## 3. Animation Guidelines

### 3.1 Performance on Lower-End Android

- Prefer the **native driver** (`useNativeDriver: true`, Reanimated native worklets) for opacity, transform, and layout-driven animations.
- Avoid animating non-native-backed properties (e.g. React state-driven width/height recalculation) where possible.
- Backdrop blur is GPU-expensive; disable or reduce blur radius on low-end devices / when many glass surfaces are on screen.
- Animated screens (`interpolateWithScrollView` or shared-value transforms) are preferred over re-layout animations.
- Test on a **Pixel 6a-class device** (the performance baseline) as part of QA. On lower-end Android devices, disable or reduce backdrop blur radius and non-essential animations.

### 3.2 Native Driver

Animated values that only affect `opacity`, `transform`, `backgroundColor` are run through the native driver so they execute on the UI thread without blocking JS.

### 3.3 Reduced Motion

- The app honors the OS **Reduce Motion** accessibility setting.
- When enabled:
  - Disable shimmer and slow aurora drift.
  - Replace slide transitions with simple cross-fades.
  - Remove scale/spring bounciness.
  - Keep essential opacity transitions (required for legibility) but shorten durations to ~100ms.

### 3.4 Avoid Animations on Critical Operations

- **Camera capture**: no decorative animation during capture; only the minimal visual feedback needed (shutter cue, ring).
- **Analysis processing**: the processing state uses a clear progress indicator but **no spinning/decorative loops** beyond a subtle, calm indicator. Results appear with a gentle fade-in, not a spring.

### 3.5 Timing and Easing

| Usage                          | Duration  | Easing                              |
|--------------------------------|-----------|-------------------------------------|
| Prefer transitions             | 200–300ms | ease-out (entrance)                 |
| Exits / dismissals             | 200–250ms | ease-in                             |
| Spring (FAB press, gated)      | ~250ms    | damped spring, minimal bounce       |

- Use **ease-out for entrances** (fast start, settle in) and **ease-in for exits** (slow start, quick finish).
- Keep motions snappy; nothing should feel sluggish or rubbery.

## 4. Component Library

### 4.1 Button

Variants:

| Variant    | Usage                             |
|------------|-----------------------------------|
| Primary    | Main CTA (filled accent)          |
| Secondary  | Alternative action (surface filled)|
| Ghost      | Low-emphasis text button          |
| Icon       | Icon-only action button           |

Properties: `label`, `icon`, `onPress`, `loading`, `disabled`, `fullWidth`, `size`.

- Minimum height 48px (44pt+ target, Section 6.1).
- Loading state shows a spinner and disables press.
- Disabled state lowers opacity, preserves semantics.

### 4.2 Card

Variants:

| Variant  | Style                                           |
|----------|-------------------------------------------------|
| Standard | Flat surface, hairline border                   |
| Elevated | Rounded 20px, soft shadow (Level 1)             |
| Glass    | Frosted glass + blur (Level 2)                  |

Properties: `title`, `content`, `onPress`, `elevation`/variant, optional media/thumbnail.

### 4.3 Input

Types: `text`, `email`, `password`.

- Labeled above the field.
- Inline error message below the field with the `error` color; input border turns `error` color on invalid.
- Password has a show/hide toggle.
- Email type uses the appropriate keyboard and validates format.

### 4.4 Modal

Presentation types:

| Type           | Usage                          |
|----------------|--------------------------------|
| Bottom sheet   | Settings, actions, pickers     |
| Centered dialog| Confirmations, alerts          |

- Bottom sheets slide in from the bottom (Section 2.7) with a dimmed `overlay` background.
- Dismiss on background tap and on swipe-down (bottom sheet).
- Focus management per Section 6.6.

### 4.5 Toast

Severities: `success`, `error`, `warning`, `info`.

- Compact, auto-dismissing (default 3s, longer for errors).
- Appears at the top or bottom per convention, above content, with icon + message.
- Accessible: announced to screen readers.
- Queue toasts to avoid overlap.

### 4.6 Badge

- **Count badges**: numerals (e.g. notification count) on icons/tabs.
- **Status badges**: colored pills (`low`, `moderate`, `high`, `critical` risk, entitlement status).

### 4.7 Avatar

- Displays user `avatar_url` image when present.
- **Initials fallback** when no image or on load failure.
- Sizes: 40px (lists), 64px (profile).

### 4.8 Skeleton

- Content-shaped placeholder blocks (Section 2.8).
- Variant per layout: line, circle (avatar), card, thumbnail grid.
- Shimmer animation over the base `surface` color.

### 4.9 Header

- Contains: screen title, optional back action, optional trailing actions (e.g. share, settings).
- Pinned to top, respects safe area.
- On glass/detail screens the header may adopt a glass background on scroll.

### 4.10 Tab Bar

- Bottom navigation for main sections: **Home, History, Settings** (and Camera as a center FAB).
- Active tab highlighted with the accent token; inactive uses `textSecondary`.
- Glass background (Section 2.1).

### 4.11 FAB (Floating Action Button)

- Primary action; on Home it is the prominent **Camera** button.
- Rounded (circle), accent-filled, elevated with shadow.
- Mini-FABs for secondary quick actions where needed.

## 5. Navigation

### 5.1 Expo Router File-Based Routing

- Navigation uses **Expo Router** file-based routing.
- Routes live under `app/`; each screen folder/page maps to a URL, enabling deep linking automatically.

### 5.2 Bottom Tab Navigation

- Main sections (Home, History, Settings) use bottom tab navigation (Tab Bar, Section 4.10).
- Tabs persist their state across switches.

### 5.3 Stack Navigation

- Detail/branching screens use **stack navigation** with slide transitions:
  - Camera → Image Preview → Analysis Result
  - Scan Detail (from History)
  - Settings sub-screens
- Stack pushes provide the back action in the Header and support back gestures.

### 5.4 Modal Presentation

- Overlays and transient flows (e.g. follow-up chat sheets, options) present as **modals** (bottom sheets / centered dialogs) above the current stack.

### 5.5 Deep Linking

- Each route is deep-linkable (built into Expo Router).
- Dispatched URLs navigate to the matching screen; missing params are handled gracefully (redirect to Home).
- Example deep links: `lifelens://scan/{scanId}`, `lifelens://history`.

### 5.6 Back Gesture Support

- Back gestures on iOS (edge swipe) and Android (system back) pop the stack.
- Bottom sheets close on back/gesture.
- Back from Camera returns to Home without losing prior state.

## 6. Accessibility

### 6.1 Minimum Touch Target

- All interactive elements have a minimum touch target of **44×44 points** (device-independent points).
- Visible elements smaller than 44pt still receive invisible padded hit areas to meet the target.

### 6.2 Color Contrast

- Text and UI meet **WCAG AA** minimum contrast (4.5:1 for normal text, 3:1 for large text and UI components).
- Contrast is validated per palette (light, dark) during theme design.
- Status colors are never the sole communicator; paired with icons/labels.

### 6.3 Screen Reader Labels

- Every interactive element has an accessible label (`accessibilityLabel`) and role.
- Images are described or marked decorative where appropriate.
- Dynamic content changes (toasts, new chat messages, analysis completion) are announced appropriately.

### 6.4 Reduced Motion

- Honors OS Reduce Motion (Section 3.3).
- All non-essential animation is disabled under this setting.

### 6.5 Font Scaling

- The UI respects the device's font-size setting (Dynamic Type on iOS, font scale on Android).
- Layouts must not break or clip at large font sizes; text wraps, spacing grows.
- Skeleton and fixed heights accommodate scaled text.

### 6.6 Focus Management for Modals

- On modal open, focus moves into the modal (initial focus on first element).
- Focus is trapped within the modal (Tab cycles within).
- On modal close, focus returns to the previously focused element.
- Background is inert (non-interactive) while a modal is open.

### 6.7 Semantic Headers

- Screens use semantic heading hierarchy (`header` role / heading levels).
- Screen titles are announced on focus.

## 7. Screen Specifications

### 7.1 Splash

- Displays the LifeLens logo centered over the **brand gradient** background (aurora).
- Display duration: **1–2 seconds**, then transitions into Onboarding (first run) or Home (returning user).
- Displays while initial data/preferences load to avoid a blank flash.

### 7.2 Onboarding

- **3–4 slides** explaining the core value proposition (capture → analyze → understand; privacy-first).
- **Skip** option in the corner; persistent "Continue" / "Next" affordance (Skip and a primary CTA).
- **Dot indicators** at the bottom showing current slide and progress.
- Final slide leads to Auth (sign in / create account).

### 7.3 Home

- **Camera button, prominent** — the primary FAB (or large center action) for starting a capture.
- **Recent scans** list: thumbnails of the latest scans with time/risk summary.
- **Quick actions**: e.g. "New Scan", "View History", access to settings.
- Welcomes the user with their name and shows remaining daily quota.

### 7.4 Camera

- **Full-screen viewfinder**.
- **Capture button** (large, bottom center) to take the photo.
- **Flash toggle** and **camera toggle** (front/back) controls.
- Confirms camera permissions on first use; graceful denial screen linking to Settings.
- No decorative animation during capture (Section 3.4).

### 7.5 Image Preview

- Displays the captured image **full-screen**.
- **Retake** button returns to the Camera.
- **Confirm** button advances to analysis processing.
- Optional: a brief summary of what will be analyzed.

### 7.6 Analysis Result

- **Structured result** with distinct **sections for each analyzed field**.
- Prominent **risk_level** indicator (badge + color, Section 4.6).
- Each section presents its finding, value, and supporting detail; long content is expandable.
- Follow-up actions: "Talk to follow-up" (opens chat) when analysis completes.
- No ads during the first 10 seconds of viewing (Section 5 of monetization spec).

### 7.7 Follow-up Chat

- **Chat interface** with **message bubbles** (user vs assistant styling).
- **Input field** at the bottom, stays above keyboard (Section 2.9).
- Sends a message, streams the assistant reply, and scrolls to newest message.
- Typing/streaming indicator while the assistant responds.

### 7.8 History

- **Scrollable list** of past scans with **thumbnails**, title (time/date), and risk summary.
- Grouped by date (Today, Yesterday, week, earlier).
- Tap an item to open **Scan Detail**.
- Empty state with guidance to perform the first scan.

### 7.9 Scan Detail

- **Full analysis result** (reuses Analysis Result layout) for the selected scan.
- Embedded **chat history** for follow-up conversations tied to that analysis.
- Actions: share/download (per entitlement), delete scan.

### 7.10 Settings

- **Theme selector** (System / Light / Dark, Section 1).
- **Account info** (name, email, avatar, sign-out).
- **Subscription** management (upgrade/cancel) link.
- **Legal links**: Privacy Policy (Section 6.5), Terms.
- **Support** link.
- **Delete account** (Section 4 of storage/privacy spec), with confirmation.

### 7.11 Auth

- **Login / Register** forms with **email** and **Google** sign-in options.
- Fields validated per Section 4.3.
- Error handling for invalid credentials, network failures, and duplicate accounts.
- Links: forgot password, sign-up ↔ sign-in toggle, privacy policy.

---

## 8. Requirements (ask-lifelens-v1)

### Requirement: Inline contextual conversation anchored to the analysis screen

The Ask LifeLens interaction SHALL live inline on the analysis result screen, continuing the same subject context: scanned image → moment → safety → "Ask LifeLens" → contextual suggestion chips → conversation thread → follow-up input. The app SHALL NOT navigate to a standalone chat screen. The interaction SHALL respect system, light, and dark themes, support reduced motion, announce new content to assistive tech, and render loading, success, empty, error, and retry states without unexplained infinite loaders. The input SHALL remain usable with the on-screen keyboard.

#### Scenario: Conversation occurs on the result screen

- **WHEN** a member asks a follow-up
- **THEN** the thread appears inline on the analysis result screen and no navigation to a separate chat view occurs

#### Scenario: Suggestion chips start the conversation

- **WHEN** a member has not yet asked anything
- **THEN** the screen shows contextual suggested questions from the scan, and tapping one submits it

#### Scenario: Keyboard does not hide the composer

- **WHEN** the member focuses the follow-up input
- **THEN** the composer remains visible and the thread scrolls so the newest content stays in view

#### Scenario: Follow-up failures recover inline

- **WHEN** a follow-up request fails
- **THEN** the thread shows an inline error with a retry control and no infinite loader is shown

### Requirement: Premium signature styling and result-screen polish

The Ask LifeLens entry point, suggestion chips, and thread SHALL match the LifeLens visual language (brand palette, glass surfaces, refined type and spacing) and be visually prominent as the product's signature AI interaction. Micro-interactions (entry motion, chip press, message reveal) SHALL be subtle and SHALL be disabled or reduced when reduced motion is enabled. Touch targets SHALL meet accessibility minimums and contrast SHALL pass in both themes.

#### Scenario: Signature interaction is visually distinct

- **WHEN** a member views the result screen
- **THEN** Ask LifeLens is presented as a premium, branded call-to-action distinct from generic chat UI, with accessible touch targets and sufficient contrast in light and dark themes

#### Scenario: Reduced motion respects motion settings

- **WHEN** reduced motion is enabled
- **THEN** entry, chip, and reveal micro-interactions are reduced or disabled

### Requirement: Result-screen chrome cleanup

The result screen SHALL NOT display the raw route name as a header. The app SHALL provide exactly one unambiguous means of returning from the result screen (a labeled back control), removing duplicated native and custom navigation affordances.

#### Scenario: No raw route text in the header

- **WHEN** the analysis result screen renders
- **THEN** no route-name text such as "analysis/[id]" is shown anywhere in the header or body

#### Scenario: Single unambiguous back control

- **WHEN** the result screen is not the root of the stack
- **THEN** exactly one labeled back control is available and no second duplicate back affordance appears
