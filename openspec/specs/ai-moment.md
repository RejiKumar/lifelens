# AI Moment Specification

**Module:** AI Moment
**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-09-08

---

## 1. Purpose

Defines the proactive, prioritized actionable insight LifeLens surfaces above the identification result: one image-grounded headline ("why it matters") plus one action ("what to do"), earned from the same single analysis call with no extra round-trip or user effort.

---

## 2. Requirements

### Requirement: Moment is delivered with the analysis

Every completed scan analysis SHALL include a `moment` object composed of a `headline` (why it matters) and an `action` (what to do). The moment SHALL be produced by the same single analysis call as the identification result — no separate request, job, or polling is required, and the moment SHALL NOT increase the response latency budget beyond the existing analysis call.

#### Scenario: Analysis result carries a moment

- **WHEN** `POST /scan/analyze` returns a completed analysis
- **THEN** the response includes `analysis.moment` with a non-empty `headline` and a non-empty `action`

#### Scenario: No extra round-trip

- **WHEN** a scan is analyzed
- **THEN** the moment is available in the same HTTP response as the analysis result

### Requirement: Moment is grounded and conservative

The moment SHALL be directly grounded in content observable in the image and SHALL NOT invent causes, risks, or instructions that the image does not support. The moment SHALL NOT be presented as medical, legal, or financial advice. When a directly actionable step cannot be given safely, the moment SHALL defer to professional help instead of inventing a procedure.

#### Scenario: Grounded in the image

- **WHEN** the image shows a visibly damaged electrical cord
- **THEN** the moment references the visible damage and gives a conservative action such as unplugging and replacing, without diagnosing beyond what is visible

#### Scenario: Deferral on uncertain high-stakes subjects

- **WHEN** the subject is a symptom, medication, or hazardous substance and no safe direct action can be verified from the image
- **THEN** the moment's action directs the user to professional help rather than giving an unsupervised procedure

### Requirement: Moment leads without suppressing safety

The moment SHALL be surfaced above the identification result (title, category, summary, and sectioned findings). The risk badge and safety banner SHALL remain prominent, visible without scrolling, and SHALL NOT be obscured by the moment. When `risk_level` is HIGH or CRITICAL, the moment's headline SHALL address the safety matter first, and the moment SHALL never contradict or downplay the safety metadata.

#### Scenario: Low-risk scan shows moment above identification

- **WHEN** a completed scan has `risk_level` LOW
- **THEN** the result screen renders the moment card above the identification result, and the risk badge remains visible without scrolling

#### Scenario: High-risk scan keeps safety leading

- **WHEN** a completed scan has `risk_level` HIGH or CRITICAL
- **THEN** the moment headline addresses the safety concern first and the risk badge and safety banner remain prominent and unobstructed

### Requirement: Moment is structurally validated

Both `headline` and `action` SHALL be validated and normalized server-side with bounded lengths, and a response whose moment fails validation SHALL be rejected as `analysis_failed` rather than returned to the client. The moment SHALL be persisted with the analysis and returned identically from later fetches of the scan by id.

#### Scenario: Malformed moment rejected

- **WHEN** the AI response's moment does not satisfy validation bounds
- **THEN** the server rejects the analysis with a structured `analysis_failed` error and does not persist or return it

#### Scenario: Moment persisted and reproducible

- **WHEN** a completed scan with a moment is later fetched by id
- **THEN** the returned analysis includes the same persisted moment