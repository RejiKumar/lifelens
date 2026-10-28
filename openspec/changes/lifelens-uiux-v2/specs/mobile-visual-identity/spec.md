## Purpose

Defines the LifeLens v2 visual system: the premium dark-futuristic brand direction, glassmorphism and aurora treatment, typography hierarchy, elevation language, motion principles, and the token rules that keep every layout crash-free and responsive across Android devices.

## ADDED Requirements

### Requirement: Premium dark-futuristic brand direction

LifeLens v2 SHALL present a premium, dark-futuristic AI-mobile visual direction (Dribbble AI-mobile style): deep near-black aurora backgrounds, sophisticated frosted-glass surfaces, a glowing brand accent, and an image-first editorial layout. The aesthetic SHALL apply consistently across all screens and components while preserving Light/Dark/System theme selection (System default) with WCAG AA contrast in every resolved mode.

#### Scenario: Dark mode is the brand default

- **WHEN** the resolved mode is dark
- **THEN** surfaces render deep near-black with aurora gradients and a glowing accent, and all text meets WCAG AA contrast

#### Scenario: Light mode retains brand identity

- **WHEN** the resolved mode is light
- **THEN** the same brand hierarchy and glass/aurora identities render with light-mode tokens and WCAG AA contrast, rather than reverting to a plain generic look

### Requirement: Glassmorphism surface treatment

Glass SHALL be rendered as translucent frosted surfaces with backdrop blur and hairline borders, applied to elevated cards, the tab bar, bottom sheets, the camera FAB, and modals. Glass treatment SHALL be GPU-aware: on lower-end Android devices blur SHALL be reduced or disabled and replaced by an opaque, legible surface so content never becomes unreadable.

#### Scenario: Glass surfaces on capable devices

- **WHEN** the device supports backdrop blur
- **THEN** elevated cards, tab bar, sheets, FAB, and modals render as frosted translucent surfaces with subtle borders

#### Scenario: Legible fallback on lower-end devices

- **WHEN** the device is low-end or blur is disabled
- **THEN** glass surfaces render with opaque/reduced-blur fallbacks and all content remains fully legible

### Requirement: Aurora background gradients

Screen backgrounds SHALL feature aurora gradients: layered, softly blended gradient blobs in the brand palette (`auroraTop`, `auroraMid`, `auroraBottom`). Aurora SHALL stay subtle enough never to reduce text contrast or compete with content, and SHALL be static or slow-drift; drift SHALL be disabled when reduced motion is enabled.

#### Scenario: Aurora does not reduce legibility

- **WHEN** a screen with an aurora background renders
- **THEN** every overlaid surface and text line remains readable with AA contrast

#### Scenario: Reduced motion freezes drift

- **WHEN** OS reduced motion is enabled
- **THEN** aurora drift and any background animation are disabled

### Requirement: Typography hierarchy and scale

LifeLens v2 SHALL enforce a strong typography hierarchy through a defined type scale (display, large-title, title, subheadline, body, caption), weight, and color pairing. Line height SHALL sit at 1.3–1.4x font size. The scale SHALL respect the device font-size setting; scaling SHALL cause wrapping or expansion, never clipping, and no layout SHALL print unclamped text larger than the display step.

#### Scenario: Hierarchy is scannable

- **WHEN** a screen renders mixed content
- **THEN** display/title text is visually dominant, body text is readable, and captions are secondary — via size, weight, and token color

#### Scenario: Large font scale never clips

- **WHEN** the device font scale is increased to its maximum
- **THEN** all text wraps and containers expand, and no text is truncated or clipped without an explicit, accessible expand control

### Requirement: Spacing and radius token rules

All layout spacing SHALL use the 4-point spacing token scale (`Spacing`: 2/4/8/12/16/24/32/48/64) with no ad-hoc, negative, or raw literal margins/padding in component styles. Corner-radius SHALL use a defined scale (small 12, standard 16, elevated 20, featured 24). Elevation SHALL use the layered shadow/border system rather than harsh outlines.

#### Scenario: Token-only spacing

- **WHEN** a designer or engineer adds layout to any screen or component
- **THEN** all margin, padding, and gap values come from the spacing/radius tokens and never from raw literals or negative values

### Requirement: Motion and micro-interaction language

Micro-interactions (screen entry, tab transitions, chip press, message reveal, glass FAB press) SHALL be subtle, purposeful, and consistent (200–300ms entrances with ease-out). Animations SHALL use the native driver and SHALL be disabled or reduced when OS reduced motion is enabled, leaving only brief opacity transitions for legibility.

#### Scenario: Consistent subtle motion

- **WHEN** a user triggers a normal transition or micro-interaction
- **THEN** the motion is lightweight, consistent in duration and easing, and does not block or delay the action

#### Scenario: Reduced motion removes decoration

- **WHEN** OS reduced motion is enabled
- **THEN** entry, chip, reveal, and tab motions are removed or reduced to short opacity-only transitions

### Requirement: Responsive token consumption

Visual-identity tokens SHALL be consumed responsively: relative sizing (flex/gap/percent) over fixed pixel dimensions for variable content, a max content width on large screens, safe-area-aware insets, and edge-to-edge rendering. No token or component SHALL encode fixed pixel geometry that breaks on narrow screens, high-DPR displays, or scaled fonts.

#### Scenario: Narrow device layouts remain intact

- **WHEN** an Android device with a narrow viewport renders any screen
- **THEN** surfaces, text, and interactive elements fit without horizontal overflow or clipping

#### Scenario: Safe areas and edge-to-edge are honored

- **WHEN** a screen renders on a device with display cutouts or gesture bars
- **THEN** content respects safe-area insets and interactive elements stay tappable above the gesture area