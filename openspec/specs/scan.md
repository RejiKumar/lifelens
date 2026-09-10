# Scan / Camera Specification

**Module:** Scan
**Version:** 1.1.0
**Status:** Active
**Last Updated:** 2026-09-10

---

## 1. Overview

The Scan module handles image acquisition, processing, and upload for AI analysis. It provides three initiation paths (live camera, gallery selection, file upload), manages device permissions, processes images for optimal upload, and communicates with the backend analysis pipeline.

**MVP execution model (locked 2026-09-07)**: the scan flow is synchronous — capture → compress → upload → scan (`scan_id`) → analyze. The client stays on the analysis screen until the result returns in the same HTTP response. No queues, workers, polling, or async job status for the MVP (see `ai-analysis.md` §1.1).

---

## 2. Scan Initiation Methods

### 2.1 Live Camera Capture

- Open the device camera with a real-time viewfinder
- User taps capture button to take a photo
- Captured image enters the preview stage before upload

### 2.2 Gallery Image Selection

- Open the device photo library via native image picker
- User selects an existing photo
- Selected image enters the preview stage before upload

### 2.3 Image Upload from Device

- Accept image files from the device file system
- Support drag-and-drop on web platforms
- Accept `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.heif` formats
- Convert HEIC/HEIF to JPEG before processing
- Selected image enters the preview stage before upload

---

## 3. Camera Experience

### 3.1 Real-Time Viewfinder

- Display live camera feed at native resolution
- Maintain 30fps minimum for smooth preview
- Overlay a scan indicator frame (corner brackets or reticle) centered in the viewfinder
- Display a subtle scanning animation while the viewfinder is active

### 3.2 Capture Button

- Large, centered capture button at the bottom of the viewfinder
- Visual press feedback (scale animation on tap)
- Haptic feedback on capture using `Haptics.impact(.medium)` (iOS) or `HapticFeedback.CONFIRM` (Android)
- Disable button during capture processing to prevent double-tap

### 3.3 Flash Toggle

- Toggle button in the top-right corner of the viewfinder
- States: `off`, `on`, `auto`
- Cycle through states on tap
- Reflect current flash state in the icon

### 3.4 Camera Flip

- Toggle button adjacent to the flash toggle
- Switch between front-facing and rear-facing cameras
- Animate the transition with a flip effect
- Remember last-used camera preference in local storage

### 3.5 Permission Handling

#### Request Flow
1. On first access, request camera permission via the platform API
2. If granted, proceed to open the viewfinder
3. If denied, show an explanatory dialog:
   - Title: "Camera Access Required"
   - Body: "LifeLens needs camera access to scan items for analysis. You can enable this in Settings."
   - Actions: "Open Settings" | "Cancel"
4. If the user taps "Open Settings", deep-link to the app's system settings page
5. If the user taps "Cancel", return to the previous screen

#### Photo Library Permission
1. On first gallery access, request photo library permission
2. Same denial flow as camera, with adjusted messaging
3. For limited access (iOS 14+), only show the photos the user has selected

### 3.6 Graceful Degradation

- If camera permission is denied, disable the "Scan" button and show a tooltip explaining why
- If the camera hardware is unavailable (e.g., emulator, broken hardware), hide the camera option entirely and default to gallery selection
- If gallery permission is denied, disable gallery selection and show explanatory tooltip
- Never crash or show raw error messages to the user

---

## 4. Image Processing Pipeline

### 4.1 Pipeline Stages

```
Capture/Select → Compress → Resize → Preview → Upload → Analyze
```

### 4.2 Image Compression

| Parameter       | Value                          |
|----------------|-------------------------------|
| Target quality  | 85% (JPEG quality parameter)  |
| Max width       | 2048px                        |
| Max height      | 2048px                        |
| Max file size   | 10 MB                         |
| Output format   | JPEG (primary), WebP (preferred if supported) |

- Resize is aspect-ratio-preserving; longest dimension is clamped to 2048px
- If image is already within bounds, do not resize
- Apply compression in a background thread to avoid blocking the UI

### 4.3 Format Handling

- HEIC/HEIF inputs: convert to JPEG before upload
- PNG inputs: convert to JPEG unless transparency is critical (determined by alpha channel scan)
- WebP inputs: pass through if server accepts; otherwise convert to JPEG
- All uploads use `multipart/form-data` with MIME type `image/jpeg` or `image/webp`

### 4.4 EXIF Data Stripping

- Strip all EXIF metadata before upload for privacy
- Preserve only: image dimensions (re-derived from pixel data)
- Remove: GPS coordinates, device info, timestamps, camera model, any user-embedded data
- Perform stripping during the compression stage using the platform's image manipulation API

---

## 5. Gallery Selection

### 5.1 Access Device Photo Library

- Use `UIImagePickerController` (iOS) or `Intent.ACTION_PICK` / `MediaStore` (Android)
- On web, use `<input type="file" accept="image/*">` or the File System Access API
- Default to showing the most recent 50 photos
- Support scrolling through the full library

### 5.2 Image Picker

- Display a grid of thumbnails (3 columns)
- Tap a thumbnail to select it
- Selected thumbnail shows a checkmark overlay
- "Done" button appears in the top-right once a selection is made

### 5.3 Cropping Option

- After selection, offer an optional crop step
- Default crop: center-weighted square
- User can drag to adjust crop area
- Confirm crop or skip to use the full image

### 5.4 Recent Photos Quick Access

- On the scan screen, show a horizontal strip of the 5 most recent photos
- Tap a recent photo to select it directly (skipping the full picker)
- This strip updates each time the scan screen is opened

---

## 6. Image Preview

### 6.1 Preview Screen

- Display the captured or selected image at full width
- Show image dimensions and file size below the image
- Overlay a semi-transparent scan indicator frame
- Display the text: "Ready to analyze"

### 6.2 Actions

- **Retake / Reselect**: Return to the camera viewfinder or gallery picker
- **Analyze**: Proceed to upload and analysis
- Disable the "Analyze" button until the image is fully loaded and processed

### 6.3 Image Overlay

- Show a subtle scanning animation (pulsing corners) over the image
- This is purely cosmetic and provides visual continuity with the viewfinder

---

## 7. Upload Flow

### 7.1 Progress Indication

- Show a progress bar during upload (0% to 100%)
- Display upload speed and estimated time remaining
- Overlay the progress on the preview screen
- Disable all navigation during active upload

### 7.2 Timeout Handling

- Set a 60-second timeout for the upload request
- If timeout is reached, cancel the request and show an error dialog
- Error dialog: "Upload timed out. Please check your connection and try again."
- Allow retry from the dialog

### 7.3 Retry on Network Failure

- On network error, automatically retry up to 3 times
- Exponential backoff: 1s, 2s, 4s between retries
- Show a "Retrying..." indicator with attempt count
- After 3 failed retries, show error dialog with manual retry option

### 7.4 Duplicate Request Prevention

- Track the upload state per image (by content hash)
- If the same image is submitted while an upload is in progress, block the duplicate
- If a duplicate is detected after completion, return the existing scan result instead of re-analyzing
- Use a request IDempotency-Key header generated client-side per upload attempt

---

## 8. API Endpoints

> **Note:** The legacy two-phase `POST /scan/upload` (returning `status: uploaded` with an `image_url`) and the async `POST /scan/analyze` (returning `status: processing` with polling) are superseded. The single synchronous `POST /scan/analyze` is the only scan-initiation endpoint. No `image_url` field appears in any scan response (see "No permanent public image URLs" requirement).

### 8.1 POST /scan/analyze (Synchronous)

Submit an image and receive the validated analysis result in a single synchronous request.

**Request:**
```
Content-Type: multipart/form-data

Fields:
  image: File (required) — the processed image (JPEG/WebP, max 10MB)
  idempotency_key: string (required) — UUID for duplicate prevention
  source: enum (optional) — "camera" | "gallery" | "file", default "camera"
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "completed",
  "created_at": "2026-09-07T12:00:00Z",
  "analysis": {
    "id": "uuid",
    "title": "Fresh Banana",
    "category": "food",
    "summary": "A ripe banana, approximately 7 inches long.",
    "confidence": 0.95,
    "risk_level": "LOW",
    "observations": ["Yellow peel with slight brown spotting", "No visible damage"],
    "actions": ["Safe to eat", "Store at room temperature"],
    "warnings": [],
    "when_to_seek_help": null,
    "follow_up_suggestions": ["How long will it stay fresh?", "Nutritional info?"],
    "moment": {
      "headline": "This ripe banana is ready to eat now",
      "action": "Peel and enjoy, or store at room temperature for 1-2 days"
    },
    "created_at": "2026-09-07T12:00:08Z"
  },
  "safety": {
    "risk_level": "LOW",
    "categories": [],
    "warnings": []
  },
  "quota": {
    "used": 1,
    "limit": 5,
    "is_pro": false
  }
}
```

**Errors:**
- `400` — Missing image, invalid format, or below minimum resolution (<200x200)
- `401` — Authentication required
- `413` — File exceeds 15 MB
- `429` — Daily quota exhausted (`QUOTA_EXCEEDED`)
- `500` — Analysis failed or server error

### 8.2 GET /scan/{id}

Retrieve a stored scan result by ID. Expired guest scans return 404.

**Request:**
```
GET /scan/{id}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "completed",
  "created_at": "2026-09-07T12:00:00Z",
  "analysis": {
    "id": "uuid",
    "title": "Fresh Banana",
    "category": "food",
    "summary": "A ripe banana, approximately 7 inches long.",
    "confidence": 0.95,
    "risk_level": "LOW",
    "observations": ["Yellow peel with slight brown spotting", "No visible damage"],
    "actions": ["Safe to eat", "Store at room temperature"],
    "warnings": [],
    "when_to_seek_help": null,
    "follow_up_suggestions": ["How long will it stay fresh?", "Nutritional info?"],
    "moment": {
      "headline": "This ripe banana is ready to eat now",
      "action": "Peel and enjoy, or store at room temperature for 1-2 days"
    },
    "created_at": "2026-09-07T12:00:08Z"
  },
  "safety": {
    "risk_level": "LOW",
    "categories": [],
    "warnings": []
  }
}
```

**Errors:**
- `404` — Scan not found or expired
- `401` — Authentication required

### 8.3 GET /scan/{id}/signed-url

Issue a short-lived signed URL for the stored scan image. Ownership is verified via session identity.

**Request:**
```
GET /scan/{id}/signed-url
```

**Response 200:**
```json
{
  "signed_url": "https://...",
  "expires_at": "2026-09-07T12:05:00Z"
}
```

**Errors:**
- `404` — Scan not found, expired, or not owned by the requester
- `401` — Authentication required

### 8.4 GET /scan/history

List past scans for the authenticated user.

**Request:**
```
GET /scan/history?page=1&limit=20&sort=desc
```

**Response 200:**
```json
{
  "scans": [
    {
      "id": "uuid",
      "thumbnail_url": "https://...",
      "title": "Fresh Banana",
      "category": "food",
      "risk_level": "LOW",
      "created_at": "2026-09-07T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "total_pages": 8
  }
}
```

**Errors:**
- `401` — Authentication required
- `429` — Rate limit exceeded

---

## 9. Requirements (scan-v1)

Requirements added by the `scan-v1` change. These reconcile the locked synchronous MVP with the canonical spec and supersede any legacy async or split-upload prose above.

### Requirement: Supersede legacy split-upload endpoints

The legacy two-phase scan endpoints in this specification are superseded: `POST /scan/upload` (returning `status: uploaded` and an `image_url`) and the async `POST /scan/analyze` (returning `status: processing` with polling) shall not be implemented. The single synchronous `POST /scan/analyze` is the only scan-initiation endpoint. Any `image_url` field shall not appear in scan upload, analysis, or result responses.

#### Scenario: Only the synchronous endpoint is implemented

- **WHEN** a client inspects the exposed scan API surface
- **THEN** only the synchronous `POST /scan/analyze` and the read endpoints (`GET /scan/{scan_id}`, `GET /scan/{scan_id}/signed-url`) exist; neither the split upload endpoints nor polling behavior are present

#### Scenario: Result shape carries no image_url

- **WHEN** the server returns a scan upload, analysis, or result response
- **THEN** the payload contains no `image_url` field and no publicly addressable object path

### Requirement: Synchronous analysis request

The scan flow shall submit an image and receive the validated analysis result in a single synchronous `POST /scan/analyze` request. The response shall include the full analysis, the safety metadata, and (where available) the quota state. The two-phase flow (separate upload returning `status: uploaded`, then analysis returning `status: processing`, then polling for a result) shall not be used in the MVP.

#### Scenario: Full scan completes in one request

- **WHEN** a client sends `POST /scan/analyze` with a valid processed image and idempotency key
- **THEN** the server returns HTTP 200 with the validated analysis result and safety metadata in the same response body

#### Scenario: Quota exhaustion blocks analysis

- **WHEN** the daily scan quota is exhausted at the time of the request
- **THEN** the server returns HTTP 429 with the `QUOTA_EXCEEDED` error envelope and performs no analysis

#### Scenario: Invalid or oversized image rejected

- **WHEN** the request is missing an image, the image fails format validation, or the file exceeds the size limit
- **THEN** the server returns HTTP 400 (or 413 for file-size violations) and persists nothing

### Requirement: Image upload and normalization bounds

The client shall deliver a normalized image: JPEG or WebP, longest edge at most 2048 pixels, encoded at quality 85 or lower, file size at most 10 MB. The server shall accept jpg/jpeg/png/webp inputs up to 15 MB and up to 8192 pixels on the longest edge, and shall re-encode inputs to JPEG or WebP at most 2048 pixels before analysis or storage. HEIC/HEIF inputs shall be converted to JPEG by the client before upload.

#### Scenario: Client normalizes before upload

- **WHEN** a captured or selected image exceeds 2048 pixels or 10 MB
- **THEN** the client resizes, compresses, and re-encodes it to JPEG/WebP at most 2048 px and 10 MB before calling the API

#### Scenario: Oversized upload rejected

- **WHEN** an uploaded file exceeds 15 MB
- **THEN** the server returns HTTP 413 and rejects the request

#### Scenario: HEIC converted client-side

- **WHEN** the user selects a HEIC/HEIF image
- **THEN** the client converts it to JPEG before upload

### Requirement: No permanent public image URLs

The scan endpoints shall never return permanent public image URLs. Any image reference returned to the client shall be a short-lived signed URL (TTL 5 minutes) issued through a server-side storage endpoint.

#### Scenario: Result response contains no public URL

- **WHEN** the server returns a successful scan or analysis response
- **THEN** the response contains no permanent `image_url` and no publicly addressable object path

#### Scenario: Display URL issued via signed-url endpoint

- **WHEN** the client requests the image for a scan via the signed-url endpoint
- **THEN** the server returns a signed URL valid for 5 minutes scoped to that single object

### Requirement: Idempotent scan submission

The client shall generate an idempotency key for each upload attempt and send it with the request. The server shall treat duplicate submissions (same content hash or a replayed idempotency key) as idempotent and shall return the existing scan result instead of re-analyzing.

#### Scenario: Duplicate image returns existing result

- **WHEN** a client submits an image whose content hash matches an existing scan
- **THEN** the server blocks the duplicate and returns the existing scan and analysis result

### Requirement: Server-side image normalization

The server shall validate every uploaded image and re-encode it into a canonical form before analysis or persistence: enforce the accepted formats and size/dimension bounds, reject images below the minimum resolution (200x200 px) with a 400 error as they cannot be analyzed meaningfully, strip all EXIF metadata, and output a normalized JPEG or WebP image with a longest edge of at most 2048 pixels.

#### Scenario: EXIF stripped server-side

- **WHEN** an image containing EXIF metadata reaches the server
- **THEN** the stored image has all EXIF (GPS, device, timestamp) removed before persistence

#### Scenario: Oversized input normalized server-side

- **WHEN** an uploaded image is larger than 2048 pixels on its longest edge
- **THEN** the server downscales it to at most 2048 pixels before analysis and storage

#### Scenario: Below-minimum image rejected

- **WHEN** an uploaded image is smaller than 200x200 pixels
- **THEN** the server returns HTTP 400 and performs no analysis or persistence
