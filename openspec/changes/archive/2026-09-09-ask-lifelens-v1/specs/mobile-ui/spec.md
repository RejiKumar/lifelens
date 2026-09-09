# Deltas for ask-lifelens-v1 — capability `mobile-ui`

Existing specification: `openspec/specs/mobile-ui.md`

## ADDED Requirements

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