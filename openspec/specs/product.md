# LifeLens — Product Specification

## 1. Product Vision

LifeLens is an AI-powered camera utility built on a single premise: **Point → Understand → Act**.

The camera is the primary input. Visual understanding is the core product. Every screen, every interaction, every feature exists to serve one loop: the user points their device at something in the real world, the app analyzes it, and returns actionable understanding.

LifeLens is **not** a generic AI chatbot with a camera bolted on. It is a camera-first utility where the visual analysis *is* the product, and any conversational follow-up is subordinate to that analysis.

### Design Principles

- **Camera-first**: The home screen prioritizes camera access above all else.
- **Instant understanding**: Analysis results are structured, scannable, and actionable — not walls of prose.
- **Respect the user's time**: No unnecessary steps between pointing the camera and getting an answer.
- **Progressive depth**: Quick summary up front, detail available on demand.
- **Trust through transparency**: Confidence scores, warnings, and disclaimers are always visible.

---

## 2. Core Experience Flow

### 2.1 Happy Path

```
User opens app
    → Splash screen (brand moment, <1.5s)
    → Home screen (camera prominent)
    → User captures image via camera, selects from gallery, or uploads
    → Image preview shown with confirm/retry choice
    → User initiates scan
    → AI analysis loading state (meaningful animation, not a spinner)
    → Result displayed:
        - Title (what the AI identified)
        - Category tag (e.g., "Nature", "Food", "Document", "Object")
        - Confidence score (visual indicator + percentage)
        - Summary (2-3 sentence plain-language explanation)
        - Key observations (bullet list of notable details)
        - Suggested actions (contextual: "Search for similar", "Save to collection", "Share")
        - Safety warnings (if applicable: "This plant may be toxic")
        - When to seek help (if applicable: "Consult a professional for...")
        - Follow-up suggestions (tappable prompts for deeper questions)
    → User taps a follow-up suggestion or types a question
    → Follow-up AI chat with conversation context
    → Result automatically saved to history
```

### 2.2 Alternate Paths

| Entry Point | Description |
|---|---|
| Camera capture | Default path. Opens device camera directly from Home. |
| Gallery selection | User picks an existing photo from device library. |
| Image upload | User imports from file system (documents, downloads). |
| History re-scan | User selects a past result and re-analyzes the same image. |
| Follow-up from result | User taps a suggestion chip on the result screen to continue. |

### 2.3 Image Constraints

| Property | Constraint |
|---|---|
| Accepted formats | JPEG, PNG, HEIC, WebP |
| Maximum file size | 15 MB |
| Minimum resolution | 200 × 200 px |
| Maximum resolution | 8192 × 8192 px (downscaled before analysis) |
| Aspect ratio | Any (center-cropped to square for AI model if needed) |

---

## 3. Screen Inventory

### 3.1 Screen Table — MVP (23 Screens)

| # | Screen | Route | Purpose | Key Components |
|---|---|---|---|---|
| 1 | Splash | `/splash` | Brand loading moment on cold start | Logo animation, tagline. Max 1.5s display or until app is ready. |
| 2 | Onboarding | `/onboarding` | First-run introduction for new users | 3-page carousel: (1) Camera-first concept, (2) AI analysis preview, (3) Privacy/approach. Skip button. Persists completion flag in local storage. |
| 3 | Home | `/` | Primary screen — launch point for all scanning | Camera preview button (dominant, centered), gallery button, history preview (last 3 scans, horizontal scroll), usage quota indicator, bottom navigation bar. |
| 4 | Camera | `/camera` | Live camera viewfinder for capture | Full-screen camera feed, capture button, flash toggle, switch camera (front/rear), grid overlay toggle, pinch-to-zoom. |
| 5 | Gallery Selection | `/gallery` | Pick image from device library | Grid of device photos, album filter, search, multi-select disabled (one image at a time). Uses `expo-image-picker`. |
| 6 | Image Preview | `/preview` | Confirm selected/captured image before analysis | Full image display, confirm button ("Analyze This"), retake/reselect button, basic crop/rotate controls, file info display (size, dimensions). |
| 7 | Scan (Initiate) | `/scan` | Transition state: sends image to AI | Image thumbnail, scanning animation with contextual text ("Analyzing image...", "Identifying objects...", "Preparing results..."), cancel button. |
| 8 | AI Analysis (Loading) | `/analysis/loading` | Extended analysis loading state (if scan takes >2s) | Progress indicator with stages: upload → processing → analysis → result. Cancel available. Skeleton UI for result layout loads behind animation. |
| 9 | Analysis Result | `/analysis/:id` | Primary result display | Title, category badge, confidence meter, summary paragraph, observations list, actions row, warnings banner (if present), when-to-seek-help note (if present), follow-up suggestion chips, share button, save indicator, report issue button. |
| 10 | Follow-up AI Chat | `/analysis/:id/chat` | Conversational follow-up about a scan | Chat interface with context of the original scan and its image. User messages and AI responses. Typing indicator. Suggestion chips for quick questions. Back to result button. |
| 11 | History | `/history` | Browse past scan results | Reverse-chronological list. Each entry: thumbnail, title, category, confidence, date. Filter by category. Search by title. Empty state with CTA to scan. Pull-to-refresh. |
| 12 | Scan Detail | `/history/:id` | View a historical scan in full detail | Same layout as Analysis Result, but read-only (no follow-up chat). Options: re-analyze, share, delete, report. Shows original image and timestamp. |
| 13 | Login | `/auth/login` | Email/password authentication | Email input, password input, login button, "Forgot password?" link, "Sign up" link, Google sign-in button, guest mode continue link. |
| 14 | Register | `/auth/register` | New account creation | Name input, email input, password input (with strength meter), confirm password, terms checkbox, register button, Google sign-in button, "Already have an account" link. |
| 15 | Guest Mode Indicator | (overlay/banner) | Persistent visual indicator when in guest mode | Subtle banner on Home: "You're browsing as a guest. Sign up to save your scans." Dismissible per session. Tap opens login/register. |
| 16 | Usage Quota | `/quota` | Display current scan usage | Scans used / scans remaining, reset date, progress bar, upgrade CTA when approaching or at limit. |
| 17 | Pro Subscription | `/subscribe` | Upgrade to paid plan | Feature comparison table (Free vs Pro), pricing (monthly/annual toggle), payment integration, restore purchases, current plan indicator. |
| 18 | Settings | `/settings` | App configuration | Theme toggle (System/Light/Dark), notification preferences, account management, privacy settings, data export, clear local data, version info. |
| 19 | Privacy Policy | `/privacy` | Legal: privacy policy | Static content page. Web-rendered or markdown. Last updated date. |
| 20 | Terms of Service | `/terms` | Legal: terms of service | Static content page. Web-rendered or markdown. Last updated date. |
| 21 | Support | `/support` | Help and contact | FAQ list, contact form (name, email, message, optional screenshot attachment), link to documentation, link to community. |
| 22 | Account Deletion | `/account/delete` | GDPR/CCPA account deletion flow | Confirmation screen, list of data that will be deleted, re-authentication requirement, irreversible action warning, final confirmation with 30-second cooldown. |
| 23 | Forgot Password | `/auth/forgot-password` | Password reset flow | Email input, submit button, success confirmation screen ("Check your email"), back to login link. |

### 3.2 Navigation Structure

```
Bottom Tab Navigator (authenticated):
├── Home (camera icon)
├── History (clock icon)
├── Quota (chart icon)
└── Settings (gear icon)

Stack Navigator (modal/push):
├── Camera → Image Preview → Scan → Analysis Result → Follow-up Chat
├── Gallery → Image Preview → Scan → Analysis Result → Follow-up Chat
├── Auth stack: Login, Register, Forgot Password
├── Onboarding (fullscreen modal, shown once)
├── Support (push)
├── Privacy Policy (push)
├── Terms of Service (push)
├── Account Deletion (push from Settings)
├── Pro Subscription (push/modal from Settings or Quota)
└── Scan Detail (push from History)
```

---

## 4. User Roles

### 4.1 Guest

| Property | Value |
|---|---|
| Authentication | None required. Anonymous device-local session. |
| Scan quota | 5 scans per day (configurable server-side) |
| History | Device-local only. No cloud sync. Lost on app uninstall or data clear. |
| Follow-up chat | Not available |
| Data persistence | `AsyncStorage` only. No account association. |
| Upgrade path | Can create account at any time. Unsaved local history offered for import on signup. |

### 4.2 Free (Authenticated)

| Property | Value |
|---|---|
| Authentication | Email/password or Google OAuth |
| Scan quota | 20 scans per day (configurable server-side) |
| History | Cloud-persisted. Synced across devices. |
| Follow-up chat | Available (5 follow-ups per scan per day) |
| Data persistence | Server-side via Supabase. Associated with user ID. |
| Upgrade path | Can upgrade to Pro at any time. |

### 4.3 Pro (Authenticated)

| Property | Value |
|---|---|
| Authentication | Email/password or Google OAuth (must have verified email) |
| Scan quota | 100 scans per day (configurable server-side) |
| History | Cloud-persisted with extended retention (indefinite) |
| Follow-up chat | Unlimited |
| Data persistence | Server-side with priority processing |
| Additional features | Priority AI analysis (faster model), early access to new categories, batch scanning (coming post-MVP) |

### 4.4 Role Comparison Matrix

| Capability | Guest | Free | Pro |
|---|---|---|---|
| Camera capture | ✅ | ✅ | ✅ |
| Gallery selection | ✅ | ✅ | ✅ |
| AI analysis | 5/day | 20/day | 100/day |
| Follow-up chat | ❌ | 5/scan/day | Unlimited |
| Cloud history | ❌ | ✅ | ✅ |
| Local history | ✅ (limited) | ✅ | ✅ |
| Data export | ❌ | ✅ | ✅ |
| Priority processing | ❌ | ❌ | ✅ |
| Share results | ✅ | ✅ | ✅ |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target |
|---|---|
| Baseline device | Pixel 6a-class (all performance targets measured on this class or better) |
| Cold start to interactive | < 3 seconds on Pixel 6a-class devices |
| Camera open to live preview | < 500ms |
| Image capture to preview | < 300ms |
| Preview confirm to scan initiation | < 200ms |
| Scan to first result | < 8 seconds (network-dependent, shown with progress) |
| History list render | < 100ms for first 50 items |
| Navigation transitions | < 300ms (60fps) |
| App size | < 40 MB (iOS), < 25 MB (Android) |

**Loading states**: Every async operation must show a meaningful loading state. No spinners without context. Use skeleton screens, progress indicators with stage labels, or contextual animations that communicate what the app is doing.

### 5.2 Accessibility

| Requirement | Implementation |
|---|---|
| Screen reader support | All interactive elements have accessible labels. Images have alt text from AI analysis. Results announced via `AccessibilityInfo.announceForAccessibility`. |
| Touch targets | Minimum 44×44pt for all interactive elements. |
| Color contrast | WCAG 2.1 AA minimum (4.5:1 for normal text, 3:1 for large text). |
| Reduced motion | Respect `prefers-reduced-motion`. Disable camera animations, replace scanning animation with simple progress bar, suppress parallax. |
| Font scaling | Support up to 200% dynamic type without layout breaking. |
| Haptic feedback | Subtle haptics for capture, scan complete, and destructive actions. Can be disabled. |
| VoiceOver/TalkBack | Camera preview described. Result sections individually navigable. Confidence scores announced as percentages. |
| Keyboard navigation | All flows navigable via keyboard (for external keyboard on tablets). |

### 5.3 Theming

| Theme | Behavior |
|---|---|
| System (default) | Follows device dark/light mode. Switches seamlessly. |
| Light | Forced light mode regardless of system setting. |
| Dark | Forced dark mode regardless of system setting. |

**Theme implementation**:
- Use React Navigation's `Theme` provider with custom tokens.
- Store preference in `AsyncStorage` (persisted across restarts).
- Default to System on first launch.
- Camera preview is not affected by theme (always native camera feed).
- All UI chrome, cards, text, and backgrounds respect the active theme.

### 5.4 Offline Behavior

| Scenario | Behavior |
|---|---|
| No internet, user captures image | Show message: "Internet connection required for AI analysis. Your image has been saved locally and will be analyzed when you're back online." Queue scan for retry. |
| No internet, user opens history | Show locally cached history with a badge indicating "offline — cloud sync unavailable". |
| No internet, user tries follow-up chat | Show: "Follow-up chat requires an internet connection. Please try again when you're online." |
| No internet, user navigates to settings/account | Allow access. Show cloud-dependent features as unavailable with explanation. |
| Intermittent connection | Automatic retry with exponential backoff (1s, 2s, 4s, max 3 retries). Show progress to user. No silent failures. |

**Offline-first principles**:
- Local data is always accessible regardless of connectivity.
- Cloud sync happens opportunistically when connection is available.
- User is never staring at a blank screen — worst case, show what's available locally with clear messaging about what's not.

### 5.5 Error Handling

Every async operation must handle five states explicitly:

| State | Behavior |
|---|---|
| **Loading** | Meaningful progress indicator with context text. Skeleton UI where possible. Cancel option for long operations. |
| **Success** | Display result. Brief success indicator for non-blocking operations (toast for save, checkmark for sync). Auto-dismiss after 2s. |
| **Empty** | Dedicated empty state with illustration and CTA. Never show a blank screen. Example: History empty → "No scans yet. Point your camera at something interesting to get started." |
| **Error** | Clear error message explaining what happened and what the user can do. Retry button. No raw error codes. Log full error details server-side only. |
| **Retry** | Every error state includes a retry action. Retry uses exponential backoff. After 3 failed retries, escalate to "Something is persistently wrong — contact support" with pre-filled support form link. |

---

## 6. Data Model (Core Entities)

### 6.1 Scan

```typescript
interface Scan {
  id: string;                    // UUID
  user_id: string | null;        // null for guest scans
  image_url: string;             // Supabase Storage URL (cloud) or local path (guest)
  thumbnail_url: string;         // Compressed thumbnail for list views
  title: string;                 // AI-generated title (e.g., "Red Panda")
  category: ScanCategory;        // Enum: nature, food, document, object, animal, place, other
  confidence: number;            // 0.0 – 1.0
  summary: string;               // 2-3 sentence plain-language summary
  observations: string[];        // Array of key observations
  actions: ScanAction[];         // Array of suggested actions
  warnings: string[];            // Safety warnings (empty array if none)
  when_to_seek_help: string | null; // When to consult a professional
  follow_up_suggestions: string[];  // Tappable follow-up prompts
  follow_ups_used: number;       // Count of follow-ups used today
  metadata: ScanMetadata;        // Image metadata, device info, etc.
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}

interface ScanAction {
  label: string;                 // Button text
  type: 'search' | 'share' | 'save' | 'navigate';
  payload: string;               // URL, route, or action data
}

interface ScanMetadata {
  original_filename: string;
  file_size: number;             // bytes
  dimensions: { width: number; height: number };
  mime_type: string;
  device_model: string | null;
  gps: { lat: number; lng: number } | null;  // Only if user grants location permission
}
```

### 6.2 Chat Message

```typescript
interface ChatMessage {
  id: string;
  scan_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
```

### 6.3 User

```typescript
interface User {
  id: string;                    // Supabase Auth user ID
  email: string | null;          // null for guest
  name: string | null;
  avatar_url: string | null;
  role: 'guest' | 'free' | 'pro';
  scans_today: number;
  scan_limit: number;
  created_at: string;
}
```

---

## 7. Success Metrics (MVP)

### 7.1 Activation

| Metric | Target |
|---|---|
| Onboarding completion rate | > 80% of first-time users |
| Time to first scan | < 60 seconds from app open (first session) |
| First scan completion rate | > 70% of users who open camera/gallery |

### 7.2 Engagement

| Metric | Target |
|---|---|
| Daily active users (DAU) / Monthly active users (MAU) | > 25% |
| Average scans per active user per day | > 2 |
| Follow-up question rate | > 30% of scans result in at least one follow-up |
| History revisitation rate | > 20% of users view past scans within 7 days |

### 7.3 Quality

| Metric | Target |
|---|---|
| AI analysis success rate | > 95% (non-error, non-empty results) |
| User-reported result accuracy | > 80% (via optional thumbs up/down on results) |
| Crash-free sessions | > 99.5% |
| Average app rating | > 4.2 stars |

### 7.4 Conversion

| Metric | Target |
|---|---|
| Guest → Account signup | > 15% of guest users create accounts |
| Free → Pro upgrade | > 5% of free users within 30 days |
| Day 7 retention | > 30% |
| Day 30 retention | > 15% |

### 7.5 Performance

| Metric | Target |
|---|---|
| P95 scan-to-result latency | < 10 seconds |
| P50 scan-to-result latency | < 5 seconds |
| App launch time (cold) | < 3 seconds |
| ANR rate (Android) | < 0.5% |
| iOS crash rate | < 0.3% |

---

## 8. Feature Flags

| Flag | Default | Purpose |
|---|---|---|
| `enable_follow_up_chat` | `true` | Toggle follow-up conversation feature |
| `enable_pro_upsell` | `true` | Show upgrade prompts |
| `enable_batch_scan` | `false` | Post-MVP: multiple images in one session |
| `enable_location_tagging` | `false` | Attach GPS data to scans |
| `enable_share_cards` | `false` | Generate shareable image cards from results |
| `maintenance_mode` | `false` | Show maintenance banner, disable scan operations |

---

## 9. Analytics Events

| Event | Trigger | Properties |
|---|---|---|
| `app_opened` | App comes to foreground | `is_cold_start`, `user_role` |
| `scan_initiated` | User confirms image for analysis | `source: camera | gallery | upload` |
| `scan_completed` | Result displayed | `category`, `confidence`, `latency_ms` |
| `scan_failed` | Error during analysis | `error_type`, `retry_count` |
| `follow_up_sent` | User sends follow-up message | `scan_id`, `message_length` |
| `history_viewed` | User opens history screen | `total_scans` |
| `history_item_tapped` | User opens a past scan | `category`, `days_since_scan` |
| `onboarding_completed` | User finishes onboarding | `duration_s` |
| `auth_signup` | Account created | `method: email | google | guest_upgrade` |
| `auth_login` | User logs in | `method: email | google` |
| `quota_approaching` | User reaches 80% of daily quota | `scans_used`, `scan_limit` |
| `quota_exhausted` | User reaches 100% of daily quota | `upgrade_cta_shown: true` |
| `pro_upgrade` | Pro subscription purchased | `plan: monthly | annual` |
| `theme_changed` | User changes theme | `theme: system | light | dark` |
| `error_encountered` | Any user-facing error | `screen`, `error_type`, `recoverable` |

---

## 10. Disclaimers & Legal

### 10.1 AI Analysis Disclaimer

Displayed on every analysis result screen:

> "LifeLens AI provides informational analysis only. Results may contain inaccuracies. Always verify critical information independently. For medical, legal, or safety-related questions, consult a qualified professional."

### 10.2 Medical Disclaimer

Displayed when category is health-related or when medical content is detected:

> "This analysis is not medical advice. If you have concerns about a health condition, symptoms, or medical emergency, contact a healthcare provider or emergency services immediately."

### 10.3 Safety Warning Format

When the AI detects potentially dangerous content:

```
⚠️ Safety Warning
[Warning text from AI analysis]
This information is for reference only. When in doubt, seek professional guidance.
```

### 10.4 Data Collection Notice

On first scan:

> "Your images are sent to our AI service for analysis. We do not store images after analysis unless you save the result to your history. See our Privacy Policy for details."
