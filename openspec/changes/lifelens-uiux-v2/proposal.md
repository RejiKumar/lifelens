## Why

LifeLens ships functionally complete Point → Understand → Act flows (scan, Moment, Ask LifeLens, history, auth, theming), but the visual layer is a generic blue-on-white v1 look: sparse tokens in `constants/theme.ts`, flat `ThemedView`/`ThemedText` surfaces, and only a handful of glass cards. It does not express the premium AI-native identity, the image-first result hierarchy, or the signature Moment/Ask LifeLens interaction the product is defined around. Now that the core loop is stable, the UI needs a coherent v2 visual system — Android-first, Expo SDK 57, glassmorphism, aurora lighting, strong typography, in the AI-mobile design direction shown on Dribbble (premium dark futuristic aesthetic) — without touching any backend, API contract, or business logic.

## What Changes

- Adopt the **Dribbble AI-mobile** visual direction (premium dark futuristic aesthetic): deep near-black aurora backgrounds, sophisticated glassmorphism, branded accent glow, and an image-first editorial layout.
- Introduce a v2 visual design system in the mobile app (Android-first, Expo SDK 57): redesigned color tokens, aurora background gradients, glassmorphism surfaces, refinements to shadows/borders/elevation.
- Establish a strong typography hierarchy (display/title/body/caption) with consistent type scale and line heights.
- Redesign the Home screen and camera entry to be camera-first with an on-brand hero (recent scans, quota, guest state preserved).
- Redesign the Analysis Result screen to be **image-first**: the scanned image as the hero, Moment as the primary insight above other fields, risk as a prominent badge, and Ask LifeLens as a signature branded interaction (chips, thread, composer) inline on the result.
- Re-present long-form AI content: replace uncontrolled AI prose with bounded, structured typography; enforce max line lengths, expandable/`numberOfLines`-bounded text, and scannable formatting throughout result screens.
- Refresh History, Settings, auth screens, onboarding, and import-prompt to the same visual language; smooth micro-interactions (entry motion, chip press, message reveal, tab transitions) that respect OS Reduce Motion.
- Keep System/Light/Dark theme support (System default) and accessibility requirements intact.
- Guarantee **responsive, crash-free layouts** on Android across all device sizes and densities: consistent `Spacing`-token-based dimensions (no ad-hoc, negative, or overgrown margins/padding), relative/flexible sizing where content length varies, safe-area + edge-to-edge handling, bounded/truncatable text with accessible expansion instead of clipping, overflow-safe lists and cards, keyboard-avoiding inputs, and orientation-safe frames. Verified against a defined device matrix (small/large screens, high/low DPR, large font scale, light/dark, reduced motion).
- Remove any placeholder/debug-only UI and unused flat styling from production screens.
- Preserve all existing functionality, API contracts, and Scan/Moment/Ask LifeLens behavior. **BREAKING** — none intended.

## Capabilities

### New Capabilities

- `mobile-visual-identity`: Defines the v2 visual system — brand color tokens (incl. aura/aurora palette), glass treatment, elevation/shadow rules, typography scale, motion language, and reduced-motion behavior that the mobile UI follows.

### Modified Capabilities

- `mobile-ui`: Requirements change for how redesigned screens render — Home, Camera, Preview, Analysis Result (image-first; Moment as the primary insight; bounded AI text), Ask LifeLens signature presentation, History, Settings, auth flows, and responsive Android layouts under the new visual identity. No functional or navigation behavior changes; presentation and information hierarchy only.

## Impact

- **Mobile app (primary):** `mobile/src/constants/theme.ts` (rewrite token sets), `mobile/src/hooks/use-theme.ts`, `mobile/src/components/themed-*.tsx`, `mobile/src/components/ui/*` (glass cards, moment card, risk badge, safety banner + their tests), screens under `mobile/src/app/**` (Home, camera, preview, analysis `[id]`, history, settings, auth/import/onboarding), and `mobile/src/features/scan/presentation/*` (Ask LifeLens, conversation thread, follow-up composer, guest/limit prompts), `mobile/src/features/auth/presentation/*`.
- **Dependencies:** likely added: `expo-blur`, `expo-linear-gradient`, `react-native-reanimated` (if not already present) for glass + aurora + motion. All are Expo SDK 57 supported.
- **Tests:** updated/added jest component tests for redesigned components and screens; existing behavior suites (scan-store, scan-api, auth-context, conversation) unchanged.
- **Not affected:** backend (FastAPI), Supabase storage/auth, AI provider/gemini, API contracts, quota logic, Scan/Moment/Ask LifeLens business behavior.
- **Verification:** Android device pass (the connected physical device) across light/dark/system themes, reduced motion, and accessibility inspector.