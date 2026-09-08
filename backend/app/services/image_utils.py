"""Server-side image validation and normalisation.

The server must not trust client claims (content-type, dimensions). Images are
sniffed by magic bytes, bounded in size and dimensions with a decompression
guard, then re-encoded into a canonical form: EXIF stripped, downscaled to
``output_dimension`` and stored as JPEG (quality ``output_quality``) or WebP.

Only the canonical bytes are hashed and stored, so idempotency/dedupe operates
over the exact bytes that reach the database and storage.
"""

from __future__ import annotations

import io
import secrets
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

from app.core.errors import PayloadSizeExceededError, ValidationError

_ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
_STORED_FORMATS = {"JPEG", "WEBP"}
_STORED_MIME = {"JPEG": "image/jpeg", "WEBP": "image/webp"}
_EXTENSION = {"JPEG": "jpg", "WEBP": "webp"}

_MAGIC_BYTES = {
    b"\xff\xd8\xff": "JPEG",
    b"\x89PNG\r\n\x1a\n": "PNG",
    b"RIFF": "WEBP",
}


def _sniff_format(data: bytes) -> str | None:
    for magic, fmt in _MAGIC_BYTES.items():
        if data.startswith(magic):
            return fmt
    return None


@dataclass
class NormalizedImage:
    data: bytes
    mime: str
    filename: str


def normalize_image(
    data: bytes,
    *,
    max_upload_bytes: int,
    max_input_dimension: int,
    min_input_dimension: int,
    output_dimension: int,
    output_quality: int,
) -> NormalizedImage:
    """Validate and normalise raw uploaded bytes into a canonical image.

    Raises :class:`PayloadSizeExceededError` for files over the byte cap and
    :class:`ValidationError` for everything else (bad magic bytes, unsupported
    format, below-minimum dimensions, oversized dimensions, decode failure).
    """
    if len(data) > max_upload_bytes:
        raise PayloadSizeExceededError(
            "The image exceeds the maximum allowed size.",
        )

    fmt = _sniff_format(data)
    if fmt not in _ALLOWED_FORMATS:
        raise ValidationError("Unsupported or unrecognised image format.")

    # Guard against decompression bombs: reject files whose declared pixel
    # count exceeds what a legitimate max_dimension image could be.
    max_pixels = max_input_dimension * max_input_dimension
    Image.MAX_IMAGE_PIXELS = max_pixels

    try:
        with Image.open(io.BytesIO(data)) as img:
            img_format = (img.format or "").upper()
            if img_format not in _ALLOWED_FORMATS:
                raise ValidationError("Unsupported image format.")

            width, height = img.size
            longest_edge = max(width, height)
            if longest_edge > max_input_dimension:
                raise ValidationError("Image dimensions exceed the supported maximum.")
            if longest_edge < min_input_dimension:
                raise ValidationError("Image resolution is too low to analyse.")

            rgba = img.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.split()[-1])
            rgb_image = background

            if max(width, height) > output_dimension:
                ratio = output_dimension / float(max(width, height))
                new_size = (max(1, int(width * ratio)), max(1, int(height * ratio)))
                rgb_image = rgb_image.resize(new_size, Image.Resampling.LANCZOS)

            stored_fmt = "WEBP" if fmt == "WEBP" else "JPEG"
            out = io.BytesIO()
            if stored_fmt == "WEBP":
                rgb_image.save(out, format="WEBP", quality=output_quality)
            else:
                rgb_image.save(out, format="JPEG", quality=output_quality, optimize=False)

            normalized = NormalizedImage(
                data=out.getvalue(),
                mime=_STORED_MIME[stored_fmt],
                filename=f"image_{secrets.token_hex(4)}.{_EXTENSION[stored_fmt]}",
            )
    except UnidentifiedImageError as exc:
        raise ValidationError("The upload is not a valid image.") from exc
    except Image.DecompressionBombError as exc:
        raise ValidationError("Image dimensions are too large to process.") from exc
    except OSError as exc:
        raise ValidationError("The image could not be decoded.") from exc

    return normalized
