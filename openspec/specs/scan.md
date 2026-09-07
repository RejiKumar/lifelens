# Scan / Camera Specification

**Module:** Scan
**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-09-07

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

### 8.1 POST /scan/upload

Upload an image for scanning.

**Request:**
```
Content-Type: multipart/form-data

Fields:
  image: File (required) — the processed image (JPEG/WebP, max 10MB)
  idempotency_key: string (required) — UUID for duplicate prevention
  source: enum (optional) — "camera" | "gallery" | "upload", default "camera"
```

**Response 201:**
```json
{
  "id": "uuid",
  "status": "uploaded",
  "image_url": "https://...",
  "created_at": "2026-09-07T12:00:00Z"
}
```

**Errors:**
- `400` — Invalid file type or size exceeded
- `401` — Authentication required
- `413` — File too large
- `429` — Rate limit exceeded
- `500` — Server error

### 8.2 POST /scan/analyze

Trigger AI analysis on a previously uploaded image.

**Request:**
```json
{
  "scan_id": "uuid",
  "context": "optional user-provided context string",
  "analysis_type": "general" | "food" | "product" | "document"
}
```

**Response 202:**
```json
{
  "scan_id": "uuid",
  "analysis_id": "uuid",
  "status": "processing",
  "estimated_duration_ms": 8000
}
```

**Errors:**
- `400` — Invalid scan_id or missing required fields
- `401` — Authentication required
- `404` — Scan not found
- `429` — Rate limit exceeded
- `500` — Server error

### 8.3 GET /scan/:id

Retrieve a scan result by ID.

**Request:**
```
GET /scan/{id}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "completed" | "processing" | "failed",
  "image_url": "https://...",
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
    "follow_up_suggestions": ["How long will it stay fresh?", "Nutritional info?"]
  },
  "created_at": "2026-09-07T12:00:00Z",
  "completed_at": "2026-09-07T12:00:08Z"
}
```

**Errors:**
- `404` — Scan not found
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
