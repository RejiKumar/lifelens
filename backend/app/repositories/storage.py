"""Supabase Storage access for scan images.

Uses the Supabase service-role key server-side only. Images are stored in a
private bucket and are never exposed through permanent public URLs; clients
obtain short-lived signed URLs via the API. Object paths are
``{owner}/{scan_id}/{filename}`` where ``owner`` is the user id or guest
session id, and filenames are strictly sanitised.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from uuid import UUID

from storage3._async.file_api import AsyncBucketProxy
from supabase._async.client import AsyncClient

_FILENAME_RE = re.compile(r"^[a-z0-9_]+\.(jpg|jpeg|png|webp)$")

_FILENAME_MIME = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _mime_for_path(path: str) -> str | None:
    extension = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return _FILENAME_MIME.get(extension)


class StorageRepository:
    """Thin wrapper over a Supabase Storage bucket for scan objects."""

    def __init__(self, client: AsyncClient, bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    def _bucket_proxy(self) -> AsyncBucketProxy:
        return self._client.storage.from_(self._bucket)

    @staticmethod
    def sanitize_filename(filename: str) -> str | None:
        """Return the filename only if it matches the allowlist, else None."""
        name = filename.lower()
        if not _FILENAME_RE.match(name):
            return None
        return name

    def build_path(self, owner: str, scan_id: UUID, filename: str) -> str:
        clean = self.sanitize_filename(filename)
        if clean is None:
            raise ValueError(f"Unsafe filename: {filename!r}")
        return f"{owner}/{scan_id}/{clean}"

    async def upload(self, owner: str, scan_id: UUID, filename: str, data: bytes) -> str:
        path = self.build_path(owner, scan_id, filename)
        await self._bucket_proxy().upload(path, data)
        return path

    async def read(self, path: str) -> tuple[bytes, str] | None:
        """Read a stored object back with its inferred media type.

        Returns ``None`` when the object is missing or unreadable so callers
        can map to a structured not-available error instead of a text-only
        fallback.
        """
        mime = _mime_for_path(path)
        if mime is None:
            return None
        try:
            response = await self._bucket_proxy().download(path)
            return response, mime
        except Exception:  # noqa: BLE001 - storage outages map to not-found
            return None

    async def create_signed_url(self, path: str, ttl_seconds: int) -> SignedUrlResult:
        response = await self._bucket_proxy().create_signed_url(path, expires_in=ttl_seconds)
        signed_url = response.get("signedURL") or response.get("signedUrl")
        if not signed_url:
            raise RuntimeError("Storage did not return a signed URL")
        expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
        return SignedUrlResult(signed_url=signed_url, expires_at=expires_at)


class SignedUrlResult:
    """Issued signed URL plus its expiry."""

    def __init__(self, signed_url: str, expires_at: datetime) -> None:
        self.signed_url = signed_url
        self.expires_at = expires_at


def build_storage_repository(
    supabase_url: str, service_role_key: str, bucket: str
) -> StorageRepository:
    """Build a StorageRepository bound to the service-role client."""
    client = AsyncClient(supabase_url, service_role_key)
    return StorageRepository(client, bucket)
