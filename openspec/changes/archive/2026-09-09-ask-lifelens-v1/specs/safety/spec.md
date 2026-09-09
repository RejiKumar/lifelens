# Deltas for ask-lifelens-v1 — capability `safety`

Existing specification: `openspec/specs/safety.md`

## ADDED Requirements

### Requirement: Conversation answers are bound to stored risk metadata

Follow-up answers SHALL be generated under the stored authoritative risk and safety metadata (risk level, category, warnings, when-to-seek-help) of the subject's analysis. The answer SHALL never contradict, downplay, or override the stored risk information. When the stored risk is HIGH or CRITICAL, follow-up answers SHALL use conservative language, restate the severity, and defer high-risk decisions to professionals. When the category is medical, legal, or financial, answers SHALL carry the same disclaimer framing as the analysis.

#### Scenario: High-risk subject keeps conservative answers

- **WHEN** the stored risk for a subject is HIGH or CRITICAL and the user asks a follow-up
- **THEN** the answer uses conservative language, reaffirms severity, and defers decisive action to a professional

#### Scenario: Medical subject carries disclaimer

- **WHEN** the stored category is medical and the user asks a medical follow-up
- **THEN** the answer includes the medical disclaimer and is not presented as a diagnosis

#### Scenario: No dangerous procedural instruction

- **WHEN** a user asks a follow-up that would require step-by-step danger-laden instructions
- **THEN** the answer refuses and directs to professional help, per the conservative-handling requirement of `ai-conversation`