# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Styling rules (uiux-v2)

- Spacing must be token-only. Use `Size` tokens from `@/constants/theme` for new layouts and `Spacing` for legacy surfaces. No raw numeric margin/padding literals in redesigned components (`: 0` is allowed).
- This is enforced by `src/__tests__/layout-tokens.test.ts`, which scans `src/components/ui/**` plus the redesigned-files allowlist. When redesigning a screen, add it to that allowlist.
- Prefer `Typography`, `GlassCard`/`GlassSurface`, `Radius`, `Motion` tokens and the `ThemedScreen` (aurora) wrapper over ad-hoc styling.