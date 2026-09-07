# Safety Specification

> LifeLens — Safety Policy & Risk Classification

---

## 1. Overview

LifeLens provides AI-powered image analysis that may include identification of hazards, risks, and safety concerns. This specification defines how the system classifies risk, injects safety warnings, filters dangerous content, and communicates limitations to the user. The safety layer is the most critical component of the platform and is enforced entirely server-side.

---

## 2. Risk Levels

Every analysis response includes a `risk_level` field. The four levels are defined below with their semantic meaning and required response behavior.

### 2.1 LOW

- **Definition**: General information with no immediate concern.
- **Examples**: Identifying a household object, describing a scene, naming a plant.
- **Response behavior**: No safety warning required. Standard informational output.
- **UI treatment**: No banner or alert.

### 2.2 MEDIUM

- **Definition**: Caution advised. Potential minor risk that may require awareness but is not immediately dangerous.
- **Examples**: Mild electrical concern (e.g., exposed wire near water), minor structural wear (e.g., small wall crack), faded chemical labels.
- **Response behavior**: Include a brief cautionary note. Use advisory language: "you may want to," "consider," "it might be worth."
- **UI treatment**: Non-critical informational banner. Dismissible.

### 2.3 HIGH

- **Definition**: Significant risk identified. Professional consultation is strongly recommended before any action is taken.
- **Examples**: Damaged electrical outlet, suspected gas odor near an appliance, significant structural crack, broken vehicle component affecting safety.
- **Response behavior**: Include explicit warning. Use conservative language: "this may indicate," "consult a licensed [professional]," "do not attempt to." Never provide step-by-step remediation instructions.
- **UI treatment**: Prominent warning banner. Non-dismissible until user acknowledges.

### 2.4 CRITICAL

- **Definition**: Immediate danger identified. Emergency response may be needed.
- **Examples**: Active electrical spark, visible gas leak, severe structural collapse risk, acute chemical spill, medical emergency symptoms.
- **Response behavior**: Lead with emergency guidance. Include relevant emergency contact information (e.g., 911, local gas emergency line, poison control). Never provide self-remediation instructions. Use language: "seek immediate professional help," "call emergency services."
- **UI treatment**: Full-screen critical alert. Non-dismissible. Prominent emergency contact display.

---

## 3. Risk Categories

Each detected risk is classified into one or more categories. Categories drive the type of professional recommended and the content of warning messages.

### 3.1 electrical

- **Scope**: Wiring, outlets, panels, circuit breakers, appliances, extension cords, power strips.
- **Professional**: Licensed electrician.
- **Emergency contact**: Local utility emergency line or 911 if sparks/fire present.
- **Examples**: Exposed wiring, overloaded outlets, damaged panels, frayed cords.

### 3.2 fire

- **Scope**: Flames, smoke damage, fire hazards, combustible material placement, smoke detector status.
- **Professional**: Fire department (emergency), fire safety inspector (non-emergency).
- **Emergency contact**: 911.
- **Examples**: Visible flames, heavy smoke, blocked fire exits, improper storage of flammables.

### 3.3 gas

- **Scope**: Gas leaks, gas appliances, fumes, carbon monoxide indicators.
- **Professional**: Licensed gas technician, utility company.
- **Emergency contact**: Gas company emergency line, 911.
- **Examples**: Rotten egg smell near gas line, malfunctioning furnace, CO detector alerts.

### 3.4 chemical

- **Scope**: Household chemicals, industrial substances, unknown liquids, solvents, pesticides, cleaning agents.
- **Professional**: Poison control, hazmat team (severe), environmental specialist.
- **Emergency contact**: Poison Control (1-800-222-1222 in US), 911.
- **Examples**: Unlabeled containers, mixing of chemicals, chemical spill, industrial waste.

### 3.5 medical

- **Scope**: Visible injuries, symptoms, health conditions, bodily harm.
- **Professional**: Licensed medical professional.
- **Emergency contact**: 911 for life-threatening symptoms.
- **Special rules**: LifeLens never diagnoses. All medical observations are informational only. Mandatory disclaimer on every medical-category output.

### 3.6 structural

- **Scope**: Building damage, foundation cracks, roof damage, wall integrity, collapse risk, water damage compromising structure.
- **Professional**: Structural engineer, building inspector, licensed contractor.
- **Emergency contact**: 911 if collapse is imminent.
- **Examples**: Large foundation cracks, sagging roof, water-damaged load-bearing walls.

### 3.7 vehicle

- **Scope**: Vehicle damage, mechanical issues, tire condition, fluid leaks, body damage.
- **Professional**: Licensed mechanic, auto body specialist.
- **Emergency contact**: Roadside assistance, 911 if vehicle is in a dangerous position.
- **Examples**: Visible tire damage, fluid leak under vehicle, damaged brake components.

### 3.8 hazardous_substances

- **Scope**: Asbestos, lead paint, mold, radiation sources, radon indicators, biohazards.
- **Professional**: Certified environmental inspector, licensed abatement contractor.
- **Emergency contact**: Local health department, 911 for acute exposure.
- **Examples**: Suspected asbestos siding, chipping lead paint, visible mold growth, unshielded radiation source.

### 3.9 legal_financial

- **Scope**: Documents, contracts, financial statements, legal papers.
- **Professional**: Attorney, certified financial advisor, CPA.
- **Special rules**: LifeLens provides informational summaries only. Never interprets legal or financial documents as advice. All outputs include disclaimer that the analysis is not legal or financial counsel.

---

## 4. Safety Policy Rules

The following rules are enforced by the backend safety policy engine. They are non-negotiable and cannot be overridden by client configuration or user requests.

### 4.1 Single Source of Truth

- The backend safety policy is the **single source of truth** for all risk classifications, warning text, and response constraints.
- Client-side safety logic exists for display purposes only and is never authoritative.
- If client and server safety state conflict, the server state wins. The client must re-fetch.

### 4.2 Conservative Language at HIGH/CRITICAL

For HIGH and CRITICAL risk levels, all risk-related language in the response must use conservative hedging:

| Allowed | Prohibited |
|---------|-----------|
| "may indicate" | "definitely is" |
| "consider consulting" | "you should fix" |
| "this could suggest" | "this is definitely" |
| "a professional can assess" | "do this to fix" |

### 4.3 No Dangerous Instructions

Under no circumstances does LifeLens provide step-by-step instructions for:

- Electrical repair or modification
- Gas line work
- Chemical handling or neutralization
- Structural demolition or repair
- Medical treatment
- Any activity that could cause physical harm if performed by an untrained person

If the AI generates such instructions, the safety layer strips them before the response reaches the client.

### 4.4 Medical Disclaimer

Every response that includes medical-category analysis must contain the following disclaimer (or equivalent):

> "This analysis is not a medical diagnosis. Consult a licensed healthcare professional for any health concerns."

The disclaimer is injected server-side and cannot be removed by the client.

### 4.5 Professional Recommendation

For MEDIUM, HIGH, and CRITICAL risk levels, the response must include a recommendation to consult a relevant professional. The specific professional type is determined by the risk category (see Section 3).

### 4.6 Emergency Contacts at CRITICAL

For CRITICAL risk level, the response must include at least one relevant emergency contact:

- **General emergency**: 911 (US), or local equivalent based on user locale
- **Poison control**: 1-800-222-1222 (US)
- **Gas emergency**: Local gas utility emergency number
- **Fire**: 911

Emergency contacts are determined by risk category and user locale (where available).

---

## 5. Warning Injection

Safety warnings are a backend-only construct. They are injected after the AI analysis is complete and before the response is sent to the client.

### 5.1 Injection Pipeline

```
AI Analysis Complete
       ↓
Safety Policy Engine evaluates response
       ↓
Risk level assigned
       ↓
Warnings generated based on category + level
       ↓
Conservative language applied (if HIGH/CRITICAL)
       ↓
Emergency contacts appended (if CRITICAL)
       ↓
Medical disclaimer injected (if medical category)
       ↓
Warnings attached to response metadata
       ↓
Response sent to client
```

### 5.2 Client Cannot Modify Warnings

- Warnings are part of the API response payload, included in the `warnings` array.
- The client renders warnings as provided. It may not suppress, alter, reorder, or dismiss warnings for HIGH/CRITICAL risk levels.
- LOW and MEDIUM warnings may be dismissed by the user in the UI, but remain in the response data.

### 5.3 Warning Format

Each warning object in the `warnings` array contains:

```json
{
  "id": "warn_electrical_high_001",
  "risk_level": "HIGH",
  "category": "electrical",
  "title": "Electrical Hazard Detected",
  "message": "This image shows what may be exposed wiring near a water source. This could pose a serious electrical shock risk. Do not touch or attempt to repair. Consult a licensed electrician.",
  "emergency_contact": null,
  "dismissible": false,
  "professional": "Licensed Electrician"
}
```

### 5.4 Non-Dismissable Rules

| Risk Level | Dismissible |
|-----------|-------------|
| LOW | Yes |
| MEDIUM | Yes |
| HIGH | No — requires user acknowledgment |
| CRITICAL | No — full-screen, blocks further interaction until acknowledged |

---

## 6. Content Filtering

The safety system includes a content filtering layer that operates on AI-generated text before it reaches the client.

### 6.1 Filtering Scope

The content filter scans for:

- Step-by-step instructions for dangerous activities
- Language that could be interpreted as medical diagnosis
- Language that could be interpreted as legal or financial advice
- Encouragement of self-harm or harm to others
- Identification of specific weapon components or manufacturing steps
- Instructions for bypassing safety mechanisms

### 6.2 Flagged Content Handling

When content is flagged:

1. The flagged portion is removed from the response.
2. A conservative substitute is inserted in its place, such as:
   - "Consult a licensed professional for specific guidance on this topic."
   - "This type of assessment requires a qualified specialist."
3. The full original response (pre-filtering) is logged server-side for review.

### 6.3 False Positive Handling

- Content filtering is intentionally conservative. It may occasionally flag benign content.
- False positives are logged and reviewed to improve filter accuracy over time.
- Users may report false positive filters through feedback mechanisms (non-urgent).

### 6.4 Human Review Queue (Future)

- Flagged content is queued for human review.
- Review results feed back into filter training data.
- Priority: HIGH/CRITICAL flags reviewed within 24 hours; MEDIUM flags within 72 hours.

---

## 7. API Behavior

### 7.1 Safety Metadata in Every Response

Every analysis API response includes a `safety` object at the top level of the response:

```json
{
  "analysis": {
    "description": "...",
    "items": [...]
  },
  "safety": {
    "risk_level": "MEDIUM",
    "categories": ["electrical"],
    "warnings": [
      {
        "id": "warn_electrical_med_001",
        "risk_level": "MEDIUM",
        "category": "electrical",
        "title": "Minor Electrical Concern",
        "message": "This image shows what appears to be a power strip with several devices connected. Overloading a single outlet can pose a risk. Consider redistributing devices across multiple outlets.",
        "emergency_contact": null,
        "dismissible": true,
        "professional": "Licensed Electrician"
      }
    ],
    "when_to_seek_help": [
      "If you notice flickering lights, buzzing sounds, or warm outlets, consult a licensed electrician."
    ],
    "disclaimers": []
  }
}
```

### 7.2 Mandatory Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `risk_level` | string enum | Always | One of: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `categories` | string[] | Always | Array of risk categories detected. Empty if LOW. |
| `warnings` | Warning[] | Always | Array of warning objects. Empty array if no warnings. |
| `when_to_seek_help` | string[] | Populated for MEDIUM+ | Actionable guidance on when to seek professional help. |
| `disclaimers` | string[] | Always | Applicable disclaimers (medical, legal, financial). Empty if none. |

### 7.3 When to Seek Help

The `when_to_seek_help` array is populated for MEDIUM, HIGH, and CRITICAL risk levels. Each entry is a specific, actionable statement:

- **MEDIUM**: 1-2 entries, advisory tone.
- **HIGH**: 2-3 entries, direct recommendation tone.
- **CRITICAL**: 2-4 entries, urgent recommendation tone, always includes emergency contact if applicable.

---

## 8. Edge Cases

### 8.1 Multiple Risk Categories

A single image may trigger multiple risk categories. When this occurs:

- The highest risk level across all categories becomes the response-level `risk_level`.
- All triggered categories are listed in the `categories` array.
- Warnings for each triggered category are included.
- The `when_to_seek_help` array combines guidance from all triggered categories.

### 8.2 Ambiguous Images

When the AI cannot determine the content of an image with sufficient confidence:

- Risk level defaults to `LOW`.
- The response includes a note that the analysis could not be completed with confidence.
- No safety warnings are generated (absence of evidence is not evidence of risk).

### 8.3 Non-Hazardous Content

When the AI determines the image contains no hazards:

- Risk level is `LOW`.
- `categories` is an empty array.
- `warnings` is an empty array.
- `when_to_seek_help` is an empty array.
- `disclaimers` is an empty array (unless other disclaimers apply, e.g., medical image with no findings).

### 8.4 User Override Attempts

If a user or client attempts to request analysis without safety filtering, or requests removal of safety warnings:

- The backend ignores the request and applies full safety policy.
- The attempt is logged for audit purposes.
- The response includes all standard safety metadata.

---

## 9. Audit & Compliance

### 9.1 Logging

- Every analysis request and its associated safety metadata are logged.
- Logs include: request ID, user ID (if authenticated), risk level, categories, warning IDs, content filter actions.
- Logs are retained for 90 days minimum.

### 9.2 Metrics

The following metrics are tracked for safety policy effectiveness:

- Distribution of risk levels across all analyses
- Frequency of each risk category
- Content filter trigger rate
- False positive rate (from human review)
- User acknowledgment rate for HIGH/CRITICAL warnings

### 9.3 Policy Updates

- Safety policy rules are versioned.
- Changes to risk classification logic require review before deployment.
- Emergency contact information is updated when regional numbers change.
