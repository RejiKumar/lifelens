"""Unit tests for the server-side Pillow image pipeline (task 3.2)."""

from __future__ import annotations

import io

import pytest
from PIL import Image

from app.core.errors import PayloadSizeExceededError, ValidationError
from app.services.image_utils import NormalizedImage, normalize_image

MAX_UPLOAD = 15 * 1024 * 1024
MAX_INPUT = 8192
MIN_INPUT = 200
OUTPUT_DIM = 2048
QUALITY = 85


def _jpeg_bytes(size: tuple[int, int] = (400, 300), quality: int = 90) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (120, 180, 240)).save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def test_valid_jpeg_is_normalized_to_canonical_payload() -> None:
    out = normalize_image(
        _jpeg_bytes(),
        max_upload_bytes=MAX_UPLOAD,
        max_input_dimension=MAX_INPUT,
        min_input_dimension=MIN_INPUT,
        output_dimension=OUTPUT_DIM,
        output_quality=QUALITY,
    )
    assert isinstance(out, NormalizedImage)
    assert out.mime == "image/jpeg"
    assert out.filename.startswith("image_")
    assert out.filename.endswith(".jpg")
    assert len(out.data) > 0


def test_bad_magic_bytes_rejected() -> None:
    with pytest.raises(ValidationError):
        normalize_image(
            b"this is definitely not an image",
            max_upload_bytes=MAX_UPLOAD,
            max_input_dimension=MAX_INPUT,
            min_input_dimension=MIN_INPUT,
            output_dimension=OUTPUT_DIM,
            output_quality=QUALITY,
        )


def test_oversized_payload_rejected_with_413() -> None:
    with pytest.raises(PayloadSizeExceededError):
        payload = _jpeg_bytes(size=(400, 300))
        oversized = payload + b"\x00" * (MAX_UPLOAD - len(payload) + 1)
        normalize_image(
            oversized,
            max_upload_bytes=MAX_UPLOAD,
            max_input_dimension=MAX_INPUT,
            min_input_dimension=MIN_INPUT,
            output_dimension=OUTPUT_DIM,
            output_quality=QUALITY,
        )


def test_oversized_dimensions_rejected() -> None:
    big = io.BytesIO()
    Image.new("RGB", (MAX_INPUT + 1, 300), (0, 0, 0)).save(big, format="JPEG")
    with pytest.raises(ValidationError):
        normalize_image(
            big.getvalue(),
            max_upload_bytes=MAX_UPLOAD,
            max_input_dimension=MAX_INPUT,
            min_input_dimension=MIN_INPUT,
            output_dimension=OUTPUT_DIM,
            output_quality=QUALITY,
        )


def test_below_minimum_resolution_rejected() -> None:
    tiny = io.BytesIO()
    Image.new("RGB", (MIN_INPUT - 1, MIN_INPUT - 1), (0, 0, 0)).save(tiny, format="JPEG")
    with pytest.raises(ValidationError):
        normalize_image(
            tiny.getvalue(),
            max_upload_bytes=MAX_UPLOAD,
            max_input_dimension=MAX_INPUT,
            min_input_dimension=MIN_INPUT,
            output_dimension=OUTPUT_DIM,
            output_quality=QUALITY,
        )


def test_large_image_downscaled_to_max_output_dimension() -> None:
    big = io.BytesIO()
    Image.new("RGB", (3000, 1500), (90, 90, 90)).save(big, format="JPEG", quality=92)
    out = normalize_image(
        big.getvalue(),
        max_upload_bytes=MAX_UPLOAD,
        max_input_dimension=MAX_INPUT,
        min_input_dimension=MIN_INPUT,
        output_dimension=OUTPUT_DIM,
        output_quality=QUALITY,
    )
    decoded = Image.open(io.BytesIO(out.data))
    width, height = decoded.size
    assert max(width, height) <= OUTPUT_DIM


def test_exif_stripped_from_output() -> None:
    src = Image.new("RGB", (400, 300), (20, 40, 60))
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (0, 0, 0), 3: "W", 4: (0, 0, 0)}
    src.info["exif"] = exif.tobytes()
    buf = io.BytesIO()
    src.save(buf, format="JPEG", quality=90, exif=exif.tobytes())
    out = normalize_image(
        buf.getvalue(),
        max_upload_bytes=MAX_UPLOAD,
        max_input_dimension=MAX_INPUT,
        min_input_dimension=MIN_INPUT,
        output_dimension=OUTPUT_DIM,
        output_quality=QUALITY,
    )
    decoded = Image.open(io.BytesIO(out.data))
    assert len(decoded.getexif()) == 0
