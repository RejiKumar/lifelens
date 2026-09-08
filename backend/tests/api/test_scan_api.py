"""Scan API tests using dependency-overridden fakes (task 6.1).

The analysis service is injected with in-memory repositories and a fake
storage backend so POST /scan/analyze can be exercised end-to-end without a
live Postgres or Supabase instance.
"""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.providers.stub import StubProvider
from app.schemas.scan import ScanSource
from app.services.analysis import AnalysisService, NoopQuota


@dataclass
class FakeScan:
    id: uuid.UUID
    user_id: str | None
    guest_session_id: str | None
    status: str
    idempotency_key: str
    content_hash: str
    storage_path: str
    source: str | None
    created_at: datetime
    completed_at: datetime | None
    expires_at: datetime | None


@dataclass
class FakeAnalysis:
    scan_id: uuid.UUID
    title: str
    category: str
    summary: str
    confidence: float
    risk_level: str
    observations: list[str] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    when_to_seek_help: str | None = None
    follow_up_suggestions: list[str] = field(default_factory=list)
    is_medical: bool = False
    is_hazardous: bool = False
    is_electrical: bool = False
    is_structural: bool = False
    is_vehicle: bool = False
    is_chemical: bool = False
    is_gas: bool = False


class FakeScanRepo:
    def __init__(self) -> None:
        self._rows: list[FakeScan] = []

    async def create(
        self,
        *,
        user_id: str | None,
        guest_session_id: str | None,
        idempotency_key: str,
        content_hash: str,
        storage_path: str,
        source: str | None,
        guest_ttl_days: int,
        status: str = "completed",
        completed_at: datetime | None = None,
    ) -> FakeScan:
        row = FakeScan(
            id=uuid.uuid4(),
            user_id=user_id,
            guest_session_id=guest_session_id,
            status=status,
            idempotency_key=idempotency_key,
            content_hash=content_hash,
            storage_path=storage_path,
            source=source,
            created_at=datetime.now(UTC),
            completed_at=completed_at,
            expires_at=(
                datetime.now(UTC) + timedelta(days=guest_ttl_days)
                if guest_session_id
                else None
            ),
        )
        self._rows.append(row)
        return row

    async def get_by_id(
        self, scan_id: uuid.UUID, *, owner: str | None, is_guest: bool
    ) -> FakeScan | None:
        for row in self._rows:
            row_owner = row.guest_session_id if is_guest else row.user_id
            if row.id == scan_id and row_owner == owner:
                if row.expires_at is not None and row.expires_at < datetime.now(UTC):
                    return None
                return row
        return None

    async def find_duplicate(
        self,
        *,
        owner: str | None,
        is_guest: bool,
        idempotency_key: str | None = None,
        content_hash: str | None = None,
    ) -> FakeScan | None:
        if idempotency_key is None and content_hash is None:
            return None
        for row in self._rows:
            row_owner = row.guest_session_id if is_guest else row.user_id
            if row_owner != owner:
                continue
            key_match = idempotency_key is not None and row.idempotency_key == idempotency_key
            hash_match = content_hash is not None and row.content_hash == content_hash
            if not (key_match or hash_match):
                continue
            if row.expires_at is not None and row.expires_at < datetime.now(UTC):
                continue
            return row
        return None


class FakeAnalysisRepo:
    def __init__(self) -> None:
        self._rows: dict[uuid.UUID, FakeAnalysis] = {}

    async def create(self, scan_id: uuid.UUID, analysis: object) -> None:
        self._rows[scan_id] = FakeAnalysis(
            scan_id=scan_id,
            title=analysis.title,
            category=analysis.category,
            summary=analysis.summary,
            confidence=analysis.confidence,
            risk_level=analysis.risk_level,
            observations=list(analysis.observations),
            actions=list(analysis.actions),
            warnings=list(analysis.warnings),
            when_to_seek_help=analysis.when_to_seek_help,
            follow_up_suggestions=list(analysis.follow_up_suggestions),
            is_medical=analysis.is_medical,
            is_hazardous=analysis.is_hazardous,
            is_electrical=analysis.is_electrical,
            is_structural=analysis.is_structural,
            is_vehicle=analysis.is_vehicle,
            is_chemical=analysis.is_chemical,
            is_gas=analysis.is_gas,
        )

    async def get_by_scan(self, scan_id: uuid.UUID) -> FakeAnalysis | None:
        return self._rows.get(scan_id)


class FakeStorage:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, uuid.UUID, str]] = []

    async def upload(self, owner: str, scan_id: uuid.UUID, filename: str, data: bytes) -> str:
        self.uploads.append((owner, scan_id, filename))
        return f"{owner}/{scan_id}/{filename}"

    async def create_signed_url(self, path: str, ttl_seconds: int) -> object:
        from app.repositories.storage import SignedUrlResult

        await self._noop()
        return SignedUrlResult(
            signed_url=f"https://example.signed/{path}", expires_at=datetime.now(UTC)
        )

    async def _noop(self) -> None:
        return None


class CountingProvider:
    def __init__(self) -> None:
        self.calls = 0
        self._inner = StubProvider()

    async def analyze_image(
        self, image_bytes: bytes, mime: str, context: str | None = None
    ) -> object:
        self.calls += 1
        return await self._inner.analyze_image(image_bytes, mime, context)


def _jpeg_bytes(size: tuple[int, int] = (400, 300)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (55, 120, 220)).save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _build_service(
    ) -> tuple[AnalysisService, FakeScanRepo, FakeAnalysisRepo, FakeStorage, CountingProvider]:
    scans = FakeScanRepo()
    analyses = FakeAnalysisRepo()
    storage = FakeStorage()
    provider = CountingProvider()
    service = AnalysisService(
        scans=scans,
        analyses=analyses,
        storage=storage,
        provider=provider,
        quota=NoopQuota(),
        max_upload_bytes=15 * 1024 * 1024,
        max_input_dimension=8192,
        min_input_dimension=200,
        output_dimension=2048,
        output_quality=85,
        guest_ttl_days=7,
        analysis_timeout_seconds=45,
    )
    return service, scans, analyses, storage, provider


def _upload(client: TestClient, payload: bytes, session: str, key: str = "k-1") -> object:
    return client.post(
        "/scan/analyze",
        data={"idempotency_key": key, "source": ScanSource.camera.value},
        files={"image": ("photo.jpg", payload, "image/jpeg")},
        headers={"x-guest-session": session},
    )


def test_happy_path_scan_returns_analysis_and_safety() -> None:
    service, scans, analyses, storage, provider = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = _upload(client, _jpeg_bytes(), "guest-A")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "completed"
        assert body["safety"]["risk_level"] == "LOW"
        assert body["analysis"]["title"]
        assert len(body["analysis"]["observations"]) >= 1
        assert provider.calls == 1
    finally:
        app.dependency_overrides.clear()


def test_invalid_image_returns_400_envelope() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = _upload(client, b"not-an-image", "guest-A")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.clear()


def test_empty_image_returns_400_envelope() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = client.post(
            "/scan/analyze",
            data={"idempotency_key": "k-empty", "source": "camera"},
            files={"image": ("empty.jpg", b"", "image/jpeg")},
            headers={"x-guest-session": "guest-A"},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.clear()


def test_oversized_image_returns_413_envelope() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = _upload(client, b"\x00" * (15 * 1024 * 1024 + 1), "guest-A")
        assert resp.status_code == 413
        assert resp.json()["error"]["code"] == "PAYLOAD_SIZE_EXCEEDED"
    finally:
        app.dependency_overrides.clear()


def test_unknown_scan_returns_404_envelope() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        resp = client.get(
            f"/scan/{uuid.uuid4()}",
            headers={"x-guest-session": "guest-A"},
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"
    finally:
        app.dependency_overrides.clear()


def test_duplicate_content_returns_existing_without_reanalysis() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        payload = _jpeg_bytes()
        first = _upload(client, payload, "guest-A", key="dup-1")
        assert first.status_code == 200
        first_id = first.json()["id"]

        second = _upload(client, payload, "guest-A", key="dup-2")
        assert second.status_code == 200
        assert second.json()["id"] == first_id
        assert service._provider.calls == 1
    finally:
        app.dependency_overrides.clear()


def test_replayed_idempotency_key_returns_existing() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        first = _upload(client, _jpeg_bytes(), "guest-A", key="replay-1")
        second = _upload(client, _jpeg_bytes(), "guest-A", key="replay-1")
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]
        assert service._provider.calls == 1
    finally:
        app.dependency_overrides.clear()


def test_same_content_different_session_is_new_scan() -> None:
    service, *_ = _build_service()
    from app.api.deps import get_analysis_service

    app.dependency_overrides[get_analysis_service] = lambda: service
    client = TestClient(app)
    try:
        first = _upload(client, _jpeg_bytes(), "guest-A", key="cross-1")
        second = _upload(client, _jpeg_bytes(), "guest-B", key="cross-1")
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["id"] != first.json()["id"]
        assert service._provider.calls == 2
    finally:
        app.dependency_overrides.clear()
