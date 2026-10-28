## MODIFIED Requirements

### Requirement: Premium signature styling and result-screen polish

The Ask LifeLens entry point, suggestion chips, and thread SHALL match the LifeLens v2 visual language (premium dark-futuristic brand palette, glass surfaces, aurora accents, refined type and spacing) and SHALL be visually prominent as the product's signature AI interaction. The v2 result screen SHALL be **image-first**: the scanned image is the hero, the Moment is the primary insight presented immediately after the image and before every other content field, and Ask LifeLens is the primary interaction anchored inline beneath it. Micro-interactions (entry motion, chip press, message reveal) SHALL be subtle and SHALL be disabled or reduced when reduced motion is enabled. Touch targets SHALL meet accessibility minimums and contrast SHALL pass WCAG AA in both themes. All elements SHALL be responsive: they SHALL expand, wrap, and reflow across device widths and font scales without margin, padding, or size failures.

#### Scenario: Signature interaction is visually distinct

- **WHEN** a member views the result screen
- **THEN** Ask LifeLens is presented as a premium, branded call-to-action distinct from generic chat UI, with accessible touch targets and sufficient contrast in light and dark themes

#### Scenario: Reduced motion respects motion settings

- **WHEN** reduced motion is enabled
- **THEN** entry, chip, and reveal micro-interactions are reduced or disabled

#### Scenario: Image comes first, Moment is primary

- **WHEN** an analysis result renders in v2
- **THEN** the scanned image is the hero at the top, the Moment (headline and action) renders immediately after it as the primary insight, and the remaining fields follow beneath

#### Scenario: Result layout reflows on small screens

- **WHEN** the result screen renders on a narrow viewport or at a large font scale
- **THEN** the image, Moment, fields, and Ask LifeLens reflow and expand without clipping, overlap, or horizontal overflow

## ADDED Requirements

### Requirement: Camera-first Home with glass hero

The Home screen SHALL keep camera access as its dominant action inside a glass hero panel that also surfaces the guest/member identity (or sign-in hint), remaining daily quota, and a prominent "Scan Anything" CTA, with Aurora-Plus recent scans beneath it. The hero SHALL lay out in both tall and short viewports, reflow on small screens, respect the keyboard/safe areas, and remain above the tab bar.

#### Scenario: Home hero reflows responsively

- **WHEN** Home renders on a small phone, a large phone, or at maximum font scale
- **THEN** the glass hero, identity row, quota line, and scan CTA reflow without clipping, overlap, or off-screen content

#### Scenario: Recent scans stay usable

- **WHEN** recent scans render as a responsive grid
- **THEN** thumbnails adapt their size to the viewport width, keep spacing from tokens, and never overflow horizontally or overlap their captions

### Requirement: Image-first Analysis Result hierarchy

The Analysis Result screen SHALL render the scanned image as a full-width hero, followed by an explicit hierarchy: Moment (headline + action) as the primary insight, then risk badge and category, then the remaining structured fields (summary, key observations, suggested actions, safety warnings, seek-help), each in its own section. Risk level SHALL remain a prominent non-color-only indicator. Long content in any section SHALL be expandable and SHALL never overflow the container.

#### Scenario: Structured, scannable hierarchy

- **WHEN** an analysis result screen renders
- **THEN** sections appear in the canonical order (image → Moment → risk/category → summary → observations → actions → warnings → seek-help) and every field is identifiable

#### Scenario: Long sections expand instead of clipping

- **WHEN** a section contains more content than fits its panel
- **THEN** the content is truncated with an accessible "More" control that expands it in place, and the layout does not clip or overflow

### Requirement: Bounded AI text presentation

AI-generated text (title, summary, observations, actions, Moment) SHALL be presented in bounded, structured form: token-driven font sizes capped by the display step, defined line heights, and line/character budgets per field with an accessible expand control for the full value. No field SHALL render as an uncontrolled wall of text. Text SHALL wrap and containers SHALL expand under large font scales rather than clip.

#### Scenario: No uncontrolled AI text wall

- **WHEN** the AI returns a very long summary, observation, or answer
- **THEN** the UI renders the bounded preview with "More" expansion and never overflows the container or screen

#### Scenario: Expand state is accessible

- **WHEN** a bounded field is expanded or collapsed
- **THEN** the control retains its accessible label, announces the state, and the container expands without layout failure

### Requirement: Responsive layout robustness (no UI crashes)

All v2 layouts SHALL be robust against UI failure categories — margin, padding, and size errors. Layouts SHALL use token-based spacing exclusively (no ad-hoc, negative, or raw-literal margins/padding), SHALL use flexible and percentage sizing for variable content, SHALL respect safe-area insets and content insets on edge-to-edge displays, SHALL bound and truncate text with accessible expand controls, SHALL avoid horizontal overflow, and SHALL tolerate rotation and font-scale changes without clipping or overlap. Verified devices SHALL include small and large screens and high/low screen densities.

#### Scenario: No hardcoded layout geometry

- **WHEN** any screen or component in v2 renders
- **THEN** no raw margin/padding literals or negative values are used, and chrome does not overflow the visible safe area

#### Scenario: Rotation and resize do not break layout

- **WHEN** the user rotates the device or the available window size changes mid-session
- **THEN** every screen reflows cleanly with no clipped content, overlap, or dead interactive zones

#### Scenario: Maximum font scale stays intact

- **WHEN** the device font scale is at its maximum
- **THEN** text wraps and expands, buttons grow, lists remain scrollable, and no element crashes, overlaps, or clips

#### Scenario: Keyboard does not cover inputs

- **WHEN** any input form (auth, Ask LifeLens composer, follow-up) is active
- **THEN** the focused input remains visible above the keyboard and the surrounding layout does not shift or clip

### Requirement: Signature Ask LifeLens v2 presentation

The Ask LifeLens interaction SHALL be styled as the product's signature v2 moment: a branded glass entry card with aurora accent, contextual suggestion chips in pill form, an inline message thread with refined bubbles and states (loading, success, empty, error, retry), and a glass composer that stays above the keyboard. All SHALL reflow responsively, respect reduced motion, and keep touch targets at accessibility minimums.

#### Scenario: Chips and thread reflow

- **WHEN** suggestion chips or the thread render on a narrow viewport
- **THEN** chips wrap into balanced rows and bubbles wrap instead of overflowing, keeping token spacing

#### Scenario: Signature glass entry is consistent

- **WHEN** Ask LifeLens renders on any supported device or theme
- **THEN** the entry card, chips, thread, and composer use the v2 glass and aurora language and the interaction remains fully functional in light and dark modes