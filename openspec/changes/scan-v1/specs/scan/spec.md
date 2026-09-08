# Deltas for scan-v1 — capability `scan`

## MODIFIED Requirements

### Requirement: Supersede legacy split-upload endpoints
The legacy two-phase scan endpoints in the canonical `scan` spec SHALL be superseded: `POST /scan/upload` (returning `status: uploaded` and an `image_url`, §8.1) and the async `POST /scan/analyze` (returning `status: processing` with a 202 and polling, §8.2) SHALL NOT be implemented. The single synchronous `POST /scan/analyze` (see "Synchronous analysis request") is the only scan-initiation endpoint. Any `image_url` field SHALL NOT appear in scan upload, analysis, or result responses (see "No permanent public image URLs"); the canonical `GET /scan/:id` example in §8.3 SHALL be read without its `image_url` field.

#### Scenario: Only the synchronous endpoint is implemented
- **WHEN** a client inspects the exposed scan API surface
- **THEN** only the synchronous `POST /scan/analyze` and the read endpoints (`GET /scan/{scan_id}`, `GET /scan/{scan_id}/signed-url`) exist; neither the split upload endpoints nor polling behavior are present

#### Scenario: Result shape carries no image_url
- **WHEN** the server returns a scan upload, analysis, or result response
- **THEN** the payload contains no `image_url` field and no publicly addressable object path

### Requirement: Synchronous analysis request
The scan flow SHALL submit an image and receive the validated analysis result in a single synchronous `POST /scan/analyze` request. The response SHALL include the full analysis, the safety metadata, and (where available) the quota state. The two-phase flow (separate upload returning `status: uploaded`, then analysis returning `status: processing`, then polling for a result) SHALL NOT be used in the MVP.

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
The client SHALL deliver a normalized image: JPEG or WebP, longest edge at most 2048 pixels, encoded at quality 85 or lower, file size at most 10 MB. The server SHALL accept jpg/jpeg/png/webp inputs up to 15 MB and up to 8192 pixels on the longest edge, and SHALL re-encode inputs to JPEG or WebP at most 2048 pixels before analysis or storage. HEIC/HEIF inputs SHALL be converted to JPEG by the client before upload.

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
The scan endpoints SHALL NEVER return permanent public image URLs. Any image reference returned to the client SHALL be a short-lived signed URL (TTL 5 minutes) issued through a server-side storage endpoint.

#### Scenario: Result response contains no public URL
- **WHEN** the server returns a successful scan or analysis response
- **THEN** the response contains no permanent `image_url` and no publicly addressable object path

#### Scenario: Display URL issued via signed-url endpoint
- **WHEN** the client requests the image for a scan via the signed-url endpoint
- **THEN** the server returns a signed URL valid for 5 minutes scoped to that single object

### Requirement: Idempotent scan submission
The client SHALL generate an idempotency key for each upload attempt and send it with the request. The server SHALL treat duplicate submissions (same content hash or a replayed idempotency key) as idempotent and SHALL return the existing scan result instead of re-analyzing.

#### Scenario: Duplicate image returns existing result
- **WHEN** a client submits an image whose content hash matches an existing scan
- **THEN** the server blocks the duplicate and returns the existing scan and analysis result

## ADDED Requirements

### Requirement: Server-side image normalization
The server SHALL validate every uploaded image and re-encode it into a canonical form before analysis or persistence: enforce the accepted formats and size/dimension bounds, reject images below the minimum resolution (200×200 px) with a 400 error as they cannot be analyzed meaningfully, strip all EXIF metadata, and output a normalized JPEG or WebP image with a longest edge of at most 2048 pixels.

#### Scenario: EXIF stripped server-side
- **WHEN** an image containing EXIF metadata reaches the server
- **THEN** the stored image has all EXIF (GPS, device, timestamp) removed before persistence

#### Scenario: Oversized input normalized server-side
- **WHEN** an uploaded image is larger than 2048 pixels on its longest edge
- **THEN** the server downscales it to at most 2048 pixels before analysis and storage

#### Scenario: Below-minimum image rejected
- **WHEN** an uploaded image is smaller than 200×200 pixels
- **THEN** the server returns HTTP 400 and performs no analysis or persistence