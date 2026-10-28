## Context

See proposal.md - Why (v2 premium visual language over a functionally complete, visually generic v1) and proposal.md - What Changes (scope). Current state that shapes the approach:

- Mobile UI lives in `mobile/src`: `constants/theme.ts` holds sparse `Colors.light/dark` (6 tokens each) + `Fonts` + `Spacing` (2/4/8/16/24/32/64) + `RISK_COLORS`; `hooks/use-theme.ts` resolves System/Light/Dark; `_layout.tsx` wraps the app.
- Primitives today: `themed-view.tsx`, `themed-text.tsx`, `ui/glass-card.tsx` (+ `.ios.tsx` variant), `ui/moment-card.tsx`, `ui/risk-badge.tsx`, `ui/safety-banner.tsx` — a small set, each with jest tests.
- Presentation lives per-feature: `features/scan/presentation/*` (analysis `[id]` screen, `ask-lifelens.tsx`, `conversation-thread.tsx`, `follow-up-composer.tsx`, `scan-store`, `use-conversation`, `use-reduced-motion`) and `features/auth/presentation/*` (`auth-context`, `auth-prompts`, `guest-banner`).
- Stack already provides: `expo-blur` (BlurView + Android BlurTargetView), `expo-glass-effect` (iOS-only liquid glass), `react-native-reanimated` 4.5.1 + worklets, `react-native-safe-area-context`, `expo-image`, `expo-router`. NOT installed: `expo-linear-gradient` (needed for aurora). No custom font dependency (system fonts).
- Jest-expo + RN Testing Library cover components; `npm run typecheck` (tsc) is the only static check (no ESLint).

## Goals / Non-Goals

**Goals:**
- A token-based v2 design system (brand + aurora palette, glass, elevation, typography, motion, spacing/radius) that screens consume — no hardcoded layout literals.
- Reusable primitives: `AuroraBackground`, `GlassSurface`, `Typography`, `ExpandableText`, `MicroMotion` so redesigned screens stay consistent and crash-free.
- Responsive, robust layouts: token spacing, flexible sizing, safe areas, bounded text, keyboard-aware forms — verified on a device matrix (small/large phones, high/low DPR, max font scale, both themes, reduced motion).
- Preserve all existing behavior, API contracts, and Scan/Moment/Ask LifeLens flows; update only presentation.

**Non-Goals:**
- No backend/API/schema changes; no AI-provider changes.
- No new product functionality outside the visual system and the bounded-text presentation.
- No new custom font licensing in v2 (system type scale only; swappable later via `Fonts` tokens without spec change).
- No iOS-first work; Android-first, while not regressing the existing web/iOS renders.
- No business-logic refactor; presentation-layer tests may be revisited but behavior suites stay untouched.

## Decisions

### 1. Token model: keep RN StyleSheet + `useTheme`, extend the token surface

Extend `constants/theme.ts` rather than adopting Tailwind/NativeWind. Add: `auroraTop/Mid/Bottom`, `accent` (+ `accentText`), `glassTint`, `hairline`, `overlay`, elevation shadows per mode, a `Radius` scale (12/16/20/24), extended `Spacing` (add 12 and 48; keep 4pt base), a `Typography` scale (display/largeTitle/title/subheadline/body/caption with size, lineHeight 1.3–1.4x, weight), and `Motion` durations (200–300ms entry, ease-out).

- Rationale: the codebase already resolves themes via `use-theme`; StyleSheet keeps iOS/Android/web consistent with zero new runtime. NativeWind/Tamagui were rejected — they add a styling engine with no current benefit and would rewrite every component.
- Responsive rule: layout code consumes tags from the token scale or `flex`/percent/`gap`; raw numeric margin/padding literals and negative values are banned by review + tests.

### 2. Aurora backgrounds via layered gradients

Add `expo-linear-gradient` (installed with `npx expo install` to pin the SDK 57 version). New `AuroraBackground` primitive renders 2–3 soft gradient blobs (`auroraTop/Mid/Bottom`) behind screen content at the root layouts. Slow 20–60s drift with `useAnimatedStyle` + `withRepeat`, fully disabled under `use-reduced-motion`.

- Rationale: gradients are the cheapest way to hit the Dribbble "aurora lighting" direction and explicitly support the web/native parities. Alternatives: static image assets (rejected — heavier, not theme-adaptive), on-WebGPU shader (overkill, web-only).
- Perf guard: no blur inside aurora, blobs capped at 3, drift pauses when app backgrounds, uses native driver.

### 3. Glass via an adaptive `GlassSurface`

New `GlassSurface` primitive that renders real backdrop blur where available and a translucent frosted fallback otherwise (SDK 57 verified APIs):
- **Android (SDK 31+)**: `expo-blur` `BlurView` with `blurMethod="dimezisBlurViewSdk31Plus"` (native blur via RenderNode) plus a required `BlurTargetView` wrapping the screen content; on Android SDK < 31 the method falls back to `none` (translucent tint only, no perf penalty).
- **iOS**: `expo-glass-effect` `GlassView` (iOS 26+ liquid glass) when `isGlassEffectAPIAvailable()`; otherwise `expo-blur` `BlurView`.
- **Universal fallback**: an opaque `Surface` variant when blur is unsupported, disabled, or on low-end devices (memory/battery heuristic + dev toggle).

The primitive takes `intensity` (from glass tokens), `tint`, token radius, hairline 1px border, optional `blurTarget` ref, and a `variant="opaque"` escape hatch. The existing `glass-card.tsx`/`.ios.tsx` pair is folded into this one primitive. The signature tab bar wires a single `BlurTargetView` around tab-screen content so content scrolling behind it is genuinely blurred on Android.

### 4. Image-first result via reordered Analysis screen sections

Rebuild the Analysis `[id]` screen layout: `expo-image` hero (rounded, full-bleed with safe-area top inset) → `MomentCard` (featured radius 24, elevated) as the primary insight → overlay `RiskBadge` on the hero (color + icon + label, never color-only) → then structured sections in canonical order (category, summary, observations, actions, warnings, seek-help). Sections become standalone panels so long content expands in place without breaking layout.

### 5. Bounded AI text via `ExpandableText`

Shared `ExpandableText` clamps the longest AI fields to a line budget (`numberOfLines` with `onTextLayout` verification) and renders an accessible "More/Less" control with state announcements. Line budgets are per field category (e.g., moment headline ≤2, summary ≤6, observation ≤4). Maximum rendered size is capped at the `display` type step via the type scale.

- Rationale: guarantees the "no giant uncontrolled AI text" and "no layout crash at any font scale" requirements without hiding content from users who want it.

### 6. Micro-interactions via a `MicroMotion` utility

`MicroMotion` wraps reanimated entering/exiting presets (fade+translate, 220–280ms, ease-out) and chip/message-reveal variants; every consumer reads `useReducedMotion` and returns bare opacity transitions (or nothing) when reduced motion is enabled. Tab transitions and hero entries reuse it.

### 7. Responsive robustness: safe areas, flexible sizing, keyboard awareness

Wrap screens in `SafeAreaView`/safe-area hook usage, use `useWindowDimensions` for responsive grids (flex-wrap + `%`/min-width instead of fixed columns), cap content width via existing `MaxContentWidth` on large screens, and wrap auth forms and the Ask LifeLens composer in `KeyboardAvoidingView` so focused inputs never sit under the keyboard. No fixed pixel heights on text containers; all pressables keep 44pt minimum targets via padded hit areas.

### 8. Screen rollout order

Tokens → primitives (`AuroraBackground`, `GlassSurface`, `Typography`, `ExpandableText`, `MicroMotion`) → shared layout updates (`_layout.tsx` backgrounds, tab bar glass) → feature screens: Home(index) → Scan(camera) → Preview → Analysis `[id]` (+Ask LifeLens re-style) → History → Settings → auth (sign-in/sign-up/forgot/import-prompt) + onboarding → placeholder/debug cleanup. Each step keeps jest coverage and passes typecheck.

## Risks / Trade-offs

- [Android-native blur (`expo-blur` `dimezisBlurViewSdk31Plus`) requires a `BlurTargetView` and only blurs on Android SDK 31+] → `GlassSurface` + the tab bar's single `BlurTargetView` encapsulate the plumbing; older Android falls back to translucent tint automatically; component tests assert the fallback path, device pass validates on the physical device.
- [Backdrop blur + aurora drift could hurt low-end devices] → low-end fallback (opaque glass), no blur inside aurora, drift gated by reduced motion + backgrounding; perf pass on the physical device.
- [Bounded text hides content users actually want] → visible, accessible "More/Less" expand control (keep state per section), never a silent truncation.
- [A blind wholesale restyle risks regressing existing jest snapshots/behavior tests] → behavior suites (scan-store/api/contexts) untouched; only presentation components change, with their tests updated in the same commit.
- [Max font scale + long AI strings are the top crash vectors] → `ExpandableText`, token-only spacing, percentage/flex layout, and a device-matrix pass at max font scale + small screen.
- [Adding `expo-linear-gradient` introduces a dependency] → installed via `expo install` to lock the SDK-compatible version; the library is tiny and cross-platform.

## Migration Plan

- No data/schema migration; presentation-only. Changes land on a `lifelens-uiux-v2` feature branch off `qa`; build via EAS/Expo Go + physical device, run the verification matrix (small/large screens, high/low DPR, max font scale, light/dark/system themes, reduced motion, accessibility inspector), then merge to `qa`.
- Rollback: revert the merge commit — no data or contract risk.
- Verification per the specs: all new scenarios exercised in the device matrix and in jest (token-only spacing, reflow on rotation/resize, max font scale, keyboard visibility, bounded text expand, signature glass consistency).

## Open Questions

- Custom brand typeface (distinct from system fonts) — deferrable; the token layer will make a swap trivial later without rework.
- Whether to keep the existing `.ios`/web-specific component variants or unify fully — decide during rollout based on visual QA, not a spec change.