"""Guest identity seam tests (task 6.3)."""

from __future__ import annotations

from app.core.identity import GuestVerifier, Identity


async def test_guest_verifier_resolves_session_header() -> None:
    identity = await GuestVerifier().verify(None, "guest-abc-123")
    assert isinstance(identity, Identity)
    assert identity.is_guest is True
    assert identity.guest_session_id == "guest-abc-123"
    assert identity.owner == "guest-abc-123"


async def test_missing_header_produces_resolvable_guest_identity() -> None:
    identity = await GuestVerifier().verify(None, None)
    assert isinstance(identity, Identity)
    assert identity.is_guest is True
    assert identity.guest_session_id is not None
    assert len(identity.guest_session_id) > 0


async def test_blank_or_invalid_session_is_replaced() -> None:
    identity = await GuestVerifier().verify(None, "   ")
    assert identity.guest_session_id is not None
    assert "   " not in identity.guest_session_id
