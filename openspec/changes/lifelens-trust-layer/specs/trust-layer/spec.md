## Purpose

Lets users calibrate how much to trust a LifeLens result by showing how confident the AI is and the visible evidence behind its identification and risk call.

## ADDED Requirements

### Requirement: Confidence is displayed on the analysis screen

The analysis screen SHALL render the AI's confidence for every completed analysis as a visible, readable indicator (percentage and a plain-language label). The indicator SHALL update when a result is fetched or reloaded and SHALL be accessible to screen readers.

#### Scenario: Completed scan shows confidence

- **WHEN** a completed analysis with a confidence score is displayed
- **THEN** the screen shows the confidence as a percentage plus a plain-language label derived from the score

#### Scenario: Residual loading or unavailable result

- **WHEN** an analysis is loading or unavailable
- **THEN** no confidence value is claimed and the screen shows the existing loading/unavailable states

### Requirement: Low-confidence results get an explicit honesty callout

When a result's confidence is below the honesty threshold, the analysis screen SHALL show a prominent, non-silent callout that (a) says the AI was not certain, (b) says the identification and any advice may be inaccurate, and (c) tells the user to verify before acting. The callout SHALL use conservative wording and SHALL coexist with — never replace — the risk banner and any server-injected warnings.

#### Scenario: Low-confidence result renders honesty callout

- **WHEN** a completed analysis has confidence below the threshold of 0.5
- **THEN** the screen renders the honesty callout with an uncertainty statement and a "verify before acting" instruction

#### Scenario: Confident result hides honesty callout

- **WHEN** a completed analysis has confidence at or above the threshold of 0.5
- **THEN** the screen does not render the honesty callout

#### Scenario: Honesty callout does not suppress server warnings

- **WHEN** a low-confidence analysis also carries HIGH or CRITICAL risk or server-injected warnings
- **THEN** the honesty callout is shown in addition to the full risk banner and warnings, and the severity presentation is unchanged

### Requirement: Evidence is displayed with the analysis

When a result carries evidence clues, the analysis screen SHALL render them as a distinct, labeled section listing each clue. For HIGH or CRITICAL results the evidence section SHALL be positioned prominently (before the explanatory summary), because the severe call must be visibly grounded. The client SHALL tolerate an absent or empty evidence list without error.

#### Scenario: Evidence present on an ordinary result

- **WHEN** an analysis includes one or more evidence clues
- **THEN** the screen shows a labeled evidence section listing each clue

#### Scenario: Evidence made prominent on severe results

- **WHEN** an analysis is HIGH or CRITICAL and includes evidence clues
- **THEN** the evidence section is rendered prominently above the explanatory summary

#### Scenario: Evidence absent on legacy data

- **WHEN** an analysis has no evidence clues
- **THEN** the screen renders no evidence section and does not fail or block the display

### Requirement: Client trust signals never override the server

The confidence indicator, honesty callout, and evidence section SHALL be presentation only. They SHALL NOT suppress, reorder, dismiss, or contradict the server-returned risk level, warnings, when-to-seek-help, or moment.

#### Scenario: Trust UI coexists with safety presentation

- **WHEN** a result renders with both trust signals and safety presentation
- **THEN** the safety banner, warnings, and moment display exactly as provided by the server, unchanged by the trust UI