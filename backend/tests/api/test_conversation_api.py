"""Ask LifeLens conversation API tests (tasks 5.1-5.4).

Exercises POST /analysis/{id}/follow-up and GET /analysis/{id}/chat-history
through dependency-overridden fakes: the 8-turn per-scan cap, quota
consume-on-success semantics, identity/expiry scoping, safe binding of follow-up
output to the stored risk level, and (with the stub) live output validation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.api.deps import get_conversation_service
from app.main import app
from app.providers.base import ProviderCategory, ProviderError, RawFollowUp
from app.providers.stub import StubProvider
from app.services.conversation import ConversationService
from app.services.quota import QuotaState

_session_A = "guest-A"
_session_B = "guest-B"


@dataclass
class FakeScan:
    id: uuid.UUID
    user_id: str | None
    guest_session_id: str | None
    storage_path: str
    expires_at: datetime | None


@dataclass
class FakeAnalysis:
    id: uuid.UUID
    scan_id: uuid.UUID
    title: str
    category: str
    summary: str
    risk_level: str
    observations: list[str] = field(default_factory=lambda: ["observation visible in image"])
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


@dataclass
class FakeMessage:
    id: uuid.UUID
    analysis_id: uuid.UUID
    role: str
    content: str
    seq: int
    created_at: datetime


class SeedRepos:
    """Holds the in-memory scan/analysis/message/storage fakes for one case."""

    def __init__(self) -> None:
        self._pairs: dict[uuid.UUID, tuple[FakeAnalysis, FakeScan]] = {}
        self.messages: list[FakeMessage] = []
        self.images: dict[str, bytes] = {}
        self.image_bytes = b"\xff\xd8fake-jpeg-bytes\xff\xd9"

    def seed(
        self,
        *,
        owner: str,
        is_guest: bool = True,
        risk_level: str = "LOW",
        expired: bool = False,
    ) -> tuple[uuid.UUID, uuid.UUID]:
        scan_id = uuid.uuid4()
        analysis_id = uuid.uuid4()
        path = f"{owner}/{scan_id}/photo.jpg"
        self.images[path] = self.image_bytes
        scan = FakeScan(
            id=scan_id,
            user_id=None if is_guest else owner,
            guest_session_id=owner if is_guest else None,
            storage_path=path,
            expires_at=(
                datetime.now(UTC) - timedelta(seconds=1) if expired else None
            ),
        )
        analysis = FakeAnalysis(
            id=analysis_id,
            scan_id=scan_id,
            title="A short description of the subject",
            category="other",
            summary="A neutral summary of the visible subject.",
            risk_level=risk_level,
        )
        self._pairs[analysis_id] = (analysis, scan)
        return scan_id, analysis_id

    async def get_with_scan(
        self, analysis_id: uuid.UUID, *, owner: str | None, is_guest: bool
    ) -> tuple[FakeAnalysis, FakeScan] | None:
        pair = self._pairs.get(analysis_id)
        if pair is None:
            return None
        _, scan = pair
        row_owner = scan.guest_session_id if is_guest else scan.user_id
        if row_owner != owner:
            return None
        if scan.expires_at is not None and scan.expires_at < datetime.now(UTC):
            return None
        return pair

    async def count_user_messages(self, analysis_id: uuid.UUID) -> int:
        return sum(1 for m in self.messages if m.analysis_id == analysis_id and m.role == "user")

    async def next_seq(self, analysis_id: uuid.UUID) -> int:
        return (
            max(m.seq for m in self.messages if m.analysis_id == analysis_id) + 1
            if any(m.analysis_id == analysis_id for m in self.messages)
            else 1
        )

    async def add_pair(
        self, analysis_id: uuid.UUID, question: str, answer: str
    ) -> tuple[FakeMessage, FakeMessage]:
        seq = await self.next_seq(analysis_id)
        now = datetime.now(UTC)
        user_row = FakeMessage(
            id=uuid.uuid4(),
            analysis_id=analysis_id,
            role="user",
            content=question,
            seq=seq,
            created_at=now,
        )
        assistant_row = FakeMessage(
            id=uuid.uuid4(),
            analysis_id=analysis_id,
            role="assistant",
            content=answer,
            seq=seq + 1,
            created_at=now,
        )
        self.messages.extend([user_row, assistant_row])
        return user_row, assistant_row

    async def last_messages(
        self, analysis_id: uuid.UUID, limit: int
    ) -> list[FakeMessage]:
        rows = sorted(
            (m for m in self.messages if m.analysis_id == analysis_id),
            key=lambda m: m.seq,
        )
        return rows[-limit:]

    async def messages_after(
        self, analysis_id: uuid.UUID, after_seq: int, limit: int
    ) -> list[FakeMessage]:
        rows = sorted(
            (m for m in self.messages if m.analysis_id == analysis_id and m.seq > after_seq),
            key=lambda m: m.seq,
        )
        return rows[:limit]

    async def read(self, path: str) -> tuple[bytes, str] | None:
        data = self.images.get(path)
        if data is None:
            return None
        return data, "image/jpeg"

    def seed_turns(self, analysis_id: uuid.UUID, turns: int) -> None:
        for i in range(turns):
            seq = len([m for m in self.messages if m.analysis_id == analysis_id]) + 1
            now = datetime.now(UTC)
            self.messages.extend(
                [
                    FakeMessage(
                        id=uuid.uuid4(),
                        analysis_id=analysis_id,
                        role="user",
                        content=f"question-{i}",
                        seq=seq,
                        created_at=now,
                    ),
                    FakeMessage(
                        id=uuid.uuid4(),
                        analysis_id=analysis_id,
                        role="assistant",
                        content=f"answer-{i}",
                        seq=seq + 1,
                        created_at=now,
                    ),
                ]
            )


class FakeQuota:
    def __init__(self, *, used: int = 0, limit: int = 100) -> None:
        self.used = used
        self.limit = limit
        self.commits = 0

    async def check(self, identity: object) -> QuotaState:
        return QuotaState(
            used=self.used,
            limit=self.limit,
            is_pro=False,
            resets_at=datetime.now(UTC) + timedelta(days=1),
        )

    async def commit(self, identity: object) -> bool:
        self.used += 1
        self.commits += 1
        return True


class RecordingFollowUpProvider:
    def __init__(self, *, answer: str = "A contextual answer about the image.", risk: str) -> None:
        self.answer = answer
        self.risk = risk
        self.calls: list[dict[str, object]] = []

    async def follow_up(
        self,
        *,
        image_bytes: bytes,
        mime: str,
        analysis: dict[str, object],
        safety: dict[str, object],
        history: list[dict[str, str]],
        question: str,
    ) -> RawFollowUp:
        self.calls.append(
            {
                "image_bytes": image_bytes,
                "mime": mime,
                "analysis": analysis,
                "safety": safety,
                "history": history,
                "question": question,
            }
        )
        return RawFollowUp(
            answer=self.answer,
            risk_level=self.risk,
            follow_up_suggestions=["Suggest one", "Suggest two"],
        )


class FailingFollowUpProvider:
    async def follow_up(self, **kwargs: object) -> RawFollowUp:
        raise ProviderError(
            ProviderCategory.MODEL_ERROR,
            "boom",
            retryable=False,
        )


class _BrokenFollowUpProvider:
    async def follow_up(self, **kwargs: object) -> RawFollowUp:
        return RawFollowUp(
            answer="",
            risk_level="LOW",
            follow_up_suggestions=[],
        )


def _build_service(
    repo: SeedRepos,
    provider: object,
    quota: FakeQuota,
) -> ConversationService:
    return ConversationService(
        analyses=repo,  # type: ignore [arg-type]
        messages=repo,  # type: ignore [arg-type]
        storage=repo,  # type: ignore [arg-type]
        provider=provider,  # type: ignore [arg-type]
        quota=quota,
        conversational_cap=8,
        context_window_messages=20,
        follow_up_timeout_seconds=10,
    )


def _client_with(service: ConversationService) -> TestClient:
    app.dependency_overrides[get_conversation_service] = lambda: service
    return TestClient(app)


def _follow_up(client: TestClient, analysis_id: uuid.UUID, question: str) -> object:
    return client.post(
        f"/analysis/{analysis_id}/follow-up",
        json={"question": question},
        headers={"x-guest-session": _session_A},
    )


def _history(client: TestClient, analysis_id: uuid.UUID, **params: str) -> object:
    return client.get(
        f"/analysis/{analysis_id}/chat-history",
        params=params,
        headers={"x-guest-session": _session_A},
    )


def test_follow_up_persists_pair_and_returns_answer() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    provider = RecordingFollowUpProvider(risk="LOW")
    service = _build_service(repo, provider, FakeQuota())
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "What is this made of?")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["message"]["role"] == "assistant"
        assert body["message"]["content"].startswith("A contextual answer")
        assert body["remaining_capacity"] == 7
        assert body["quota"]["used"] == 1
        assert body["quota"]["limit"] == 100
        assert body["quota"]["is_pro"] is False
    finally:
        app.dependency_overrides.clear()


def test_question_is_validated() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    service = _build_service(repo, RecordingFollowUpProvider(risk="LOW"), FakeQuota())
    client = _client_with(service)
    try:
        blank = _follow_up(client, analysis_id, "   ")
        assert blank.status_code == 400
        assert blank.json()["error"]["code"] == "VALIDATION_ERROR"
        too_long = _follow_up(client, analysis_id, "x" * 501)
        assert too_long.status_code == 400
        assert too_long.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.clear()


def test_unknown_analysis_returns_404() -> None:
    repo = SeedRepos()
    service = _build_service(repo, RecordingFollowUpProvider(risk="LOW"), FakeQuota())
    client = _client_with(service)
    try:
        resp = _follow_up(client, uuid.uuid4(), "Hi there?")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"
    finally:
        app.dependency_overrides.clear()


def test_foreign_session_cannot_read_analysis() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    patched = _build_service(repo, RecordingFollowUpProvider(risk="LOW"), FakeQuota())
    app.dependency_overrides[get_conversation_service] = lambda: patched
    client = TestClient(app)
    try:
        resp = client.post(
            f"/analysis/{analysis_id}/follow-up",
            json={"question": "hello"},
            headers={"x-guest-session": _session_B},
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"
    finally:
        app.dependency_overrides.clear()


def test_expired_guest_scan_hides_conversation() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A, expired=True)
    service = _build_service(repo, RecordingFollowUpProvider(risk="LOW"), FakeQuota())
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "Is it safe?")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"
        history = _history(client, analysis_id)
        assert history.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_follow_up_grounds_answer_in_stored_image_and_safety() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A, risk_level="HIGH")
    provider = RecordingFollowUpProvider(risk="HIGH")
    service = _build_service(repo, provider, FakeQuota())
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "What should I do?")
        assert resp.status_code == 200, resp.text
        call = provider.calls[-1]
        assert call["image_bytes"] == repo.image_bytes
        assert call["mime"] == "image/jpeg"
        assert call["safety"]["risk_level"] == "HIGH"
        assert call["analysis"]["risk_level"] == "HIGH"
        assert call["history"] == []
        assert call["question"] == "What should I do?"
    finally:
        app.dependency_overrides.clear()


def test_safety_binding_rejects_downplayed_answer() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A, risk_level="HIGH")
    provider = RecordingFollowUpProvider(risk="LOW")
    quota = FakeQuota(used=3)
    service = _build_service(repo, provider, quota)
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "Is this dangerous?")
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "ANALYSIS_FAILED"
        assert quota.used == 3
        assert quota.commits == 0
        assert len(repo.messages) == 0
    finally:
        app.dependency_overrides.clear()


def test_empty_answer_is_rejected_without_commit() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    quota = FakeQuota(used=1)
    service = _build_service(repo, _BrokenFollowUpProvider(), quota)
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "hello?")
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "ANALYSIS_FAILED"
        assert quota.used == 1
        assert quota.commits == 0
    finally:
        app.dependency_overrides.clear()


def test_provider_failure_does_not_consume_quota() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    quota = FakeQuota(used=4)
    service = _build_service(repo, FailingFollowUpProvider(), quota)
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "hello?")
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "ANALYSIS_FAILED"
        assert quota.used == 4
        assert quota.commits == 0
    finally:
        app.dependency_overrides.clear()


def test_quota_exceeded_blocks_before_ai_call() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    provider = RecordingFollowUpProvider(risk="LOW")
    quota = FakeQuota(used=100, limit=100)
    service = _build_service(repo, provider, quota)
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "hello?")
        assert resp.status_code == 429
        assert resp.json()["error"]["code"] == "QUOTA_EXCEEDED"
        assert provider.calls == []
    finally:
        app.dependency_overrides.clear()


def test_eighth_turn_allowed_ninth_rejected_without_ai_call() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    repo.seed_turns(analysis_id, turns=7)
    provider = RecordingFollowUpProvider(risk="LOW")
    quota = FakeQuota(used=7)
    service = _build_service(repo, provider, quota)
    client = _client_with(service)
    try:
        eighth = _follow_up(client, analysis_id, "one more?")
        assert eighth.status_code == 200
        assert eighth.json()["remaining_capacity"] == 0

        ninth = _follow_up(client, analysis_id, "and another?")
        assert ninth.status_code == 429
        assert ninth.json()["error"]["code"] == "LIMIT_EXCEEDED"
        assert len(provider.calls) == 1
        assert quota.commits == 1
    finally:
        app.dependency_overrides.clear()


def test_cap_is_reset_per_scan() -> None:
    repo = SeedRepos()
    _, first_analysis = repo.seed(owner=_session_A)
    _, second_analysis = repo.seed(owner=_session_A)
    repo.seed_turns(first_analysis, turns=8)
    provider = RecordingFollowUpProvider(risk="LOW")
    quota = FakeQuota(used=8)
    service = _build_service(repo, provider, quota)
    client = _client_with(service)
    try:
        first = _follow_up(client, first_analysis, "over?")
        assert first.status_code == 429
        assert first.json()["error"]["code"] == "LIMIT_EXCEEDED"

        second = _follow_up(client, second_analysis, "fresh scan?")
        assert second.status_code == 200
        assert second.json()["remaining_capacity"] == 7
    finally:
        app.dependency_overrides.clear()


def test_chat_history_restores_ordered_thread() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    provider = RecordingFollowUpProvider(risk="LOW")
    quota = FakeQuota(used=1)
    service = _build_service(repo, provider, quota)
    client = _client_with(service)
    try:
        _follow_up(client, analysis_id, "first?")
        _follow_up(client, analysis_id, "second?")

        history = _history(client, analysis_id)
        assert history.status_code == 200, history.text
        body = history.json()
        assert [m["content"] for m in body["messages"]] == [
            "first?",
            "A contextual answer about the image.",
            "second?",
            "A contextual answer about the image.",
        ]
        assert [m["role"] for m in body["messages"]] == [
            "user",
            "assistant",
            "user",
            "assistant",
        ]
        assert body["remaining_capacity"] == 6
        assert body["quota"]["used"] == 3
        assert body["next_cursor"] is None
    finally:
        app.dependency_overrides.clear()


def test_chat_history_page_count_uses_cursor() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    repo.seed_turns(analysis_id, turns=6)
    service = _build_service(repo, RecordingFollowUpProvider(risk="LOW"), FakeQuota())
    client = _client_with(service)
    try:
        first = _history(client, analysis_id, limit="4")
        assert first.status_code == 200
        page1 = first.json()
        assert len(page1["messages"]) == 4
        assert page1["next_cursor"] is not None
        assert page1["remaining_capacity"] == 2

        second = _history(client, analysis_id, limit="4", cursor=str(page1["next_cursor"]))
        page2 = second.json()
        assert len(page2["messages"]) == 4
        assert page2["next_cursor"] is not None

        third = _history(client, analysis_id, limit="4", cursor=str(page2["next_cursor"]))
        page3 = third.json()
        assert len(page3["messages"]) == 4
        assert page3["next_cursor"] is None
    finally:
        app.dependency_overrides.clear()


def test_stub_follow_up_output_passes_server_side_validation() -> None:
    repo = SeedRepos()
    _, analysis_id = repo.seed(owner=_session_A)
    service = _build_service(repo, StubProvider(), FakeQuota())
    client = _client_with(service)
    try:
        resp = _follow_up(client, analysis_id, "What is this used for?")
        assert resp.status_code == 200, resp.text
        assert resp.json()["message"]["content"]
        assert "LOW" in resp.json()["message"]["content"]
    finally:
        app.dependency_overrides.clear()
