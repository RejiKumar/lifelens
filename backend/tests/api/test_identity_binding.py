"""Verified-identity quota binding and ownership/forgery tests (auth-v1).

Proves that quota buckets and scan ownership key on the server-verified
identity: the anonymous ``sub`` or authenticated ``user_id`` from the Bearer
token, never a client-supplied header. Requests with a forged ``x-guest-session``
header or no Bearer fail closed as unauthenticated.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi.testclient import TestClient

from app.main import app
from app.services.quota import QuotaService
from tests.api.test_scan_api import (
    FakeScan,
    _build_service,
    _jpeg_bytes,
)
from tests.jwt_support import bearer_header


class RecordingUsage:
    """In-memory usage repo recording which subjects are charged."""

    def __init__(self) -> None:
        self.subjects: list[str] = []

    async def get_used(self, subject: str, usage_date: date) -> int:
        return 0

    async def commit_one(self, subject: str, usage_date: date, limit: int) -> bool:
        self.subjects.append(subject)
        return True


async def test_quota_keys_guest_bucket_on_anonymous_sub() -> None:
    usage = RecordingUsage()
    service = QuotaService(usage=usage)
    from tests.jwt_support import make_verifier, sign_token

    identity = await make_verifier().verify(
        f"Bearer {sign_token('anon-quota-1', is_anonymous=True)}"
    )
    await service.commit(identity)
    assert usage.subjects == ["anon-quota-1"]


async def test_quota_keys_user_bucket_on_authenticated_sub() -> None:
    usage = RecordingUsage()
    service = QuotaService(usage=usage)
    from tests.jwt_support import make_verifier, sign_token

    identity = await make_verifier().verify(f"Bearer {sign_token('user-quota-1')}")
    await service.commit(identity)
    assert usage.subjects == ["user-quota-1"]


async def test_quota_limit_is_verified_identity_driven() -> None:
    usage = RecordingUsage()
    service = QuotaService(usage=usage)
    from tests.jwt_support import make_verifier, sign_token

    verifier = make_verifier()
    guest = await verifier.verify(f"Bearer {sign_token('anon-a', is_anonymous=True)}")
    user = await verifier.verify(f"Bearer {sign_token('user-a')}")
    guest_state = await service.check(guest)
    user_state = await service.check(user)
    assert guest_state.limit == 5
    assert user_state.limit == 20


def test_missing_bearer_is_unauthorized_on_quota_bounded_endpoint() -> None:
    from app.api.deps import get_analysis_service

    service, *_ = _build_service()
    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = client.get("/scan/history")
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "UNAUTHORIZED"
    finally:
        app.dependency_overrides.clear()


def test_forged_guest_header_is_unauthorized_on_scan_endpoint() -> None:
    from app.api.deps import get_analysis_service

    service, *_ = _build_service()
    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = client.post(
            "/scan/analyze",
            data={"idempotency_key": "k-1", "source": "camera"},
            files={"image": ("photo.jpg", _jpeg_bytes(), "image/jpeg")},
            headers={"x-guest-session": "guest-A"},
        )
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "UNAUTHORIZED"
    finally:
        app.dependency_overrides.clear()


async def test_authenticated_token_cannot_read_another_users_scan() -> None:
    service, scans, *_ = _build_service()
    from app.api.deps import get_analysis_service

    other_scan = FakeScan(
        id=uuid.uuid4(),
        user_id="user-B",
        guest_session_id=None,
        status="completed",
        idempotency_key="k-B",
        content_hash="hash-B",
        storage_path="user-B/scan-B/img.jpeg",
        source="camera",
        created_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
        expires_at=None,
    )
    scans._rows.append(other_scan)

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = client.get(
            f"/scan/{other_scan.id}",
            headers=bearer_header("user-A", is_anonymous=False),
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"
    finally:
        app.dependency_overrides.clear()


def test_scan_history_scoped_to_verified_owner() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = client.get("/scan/history", headers=bearer_header("anon-A", is_anonymous=True))
        assert resp.status_code == 200
        assert resp.json()["items"] == []
    finally:
        app.dependency_overrides.clear()
