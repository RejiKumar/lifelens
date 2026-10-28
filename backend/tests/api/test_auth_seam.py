"""Supabase JWT identity seam tests (auth-v1).

Exercises :class:`SupabaseJWTVerifier` directly: valid authenticated and
anonymous tokens resolve to the right :class:`Identity`, and every failure
path fails closed as :class:`UnauthorizedError` without leaking token
material.
"""

from __future__ import annotations

import pytest

from app.core.errors import UnauthorizedError
from app.core.identity import SupabaseJWTVerifier
from tests.jwt_support import (
    TEST_ISSUER,
    make_verifier,
    sign_token,
)


async def test_valid_authenticated_token_resolves_user_identity() -> None:
    verifier = make_verifier()
    identity = await verifier.verify(f"Bearer {sign_token('user-123')}")
    assert identity.is_guest is False
    assert identity.user_id == "user-123"
    assert identity.guest_session_id is None
    assert identity.owner == "user-123"


async def test_valid_anonymous_token_resolves_guest_identity() -> None:
    verifier = make_verifier()
    identity = await verifier.verify(
        f"Bearer {sign_token('anon-sub-456', is_anonymous=True)}"
    )
    assert identity.is_guest is True
    assert identity.guest_session_id == "anon-sub-456"
    assert identity.user_id is None
    assert identity.owner == "anon-sub-456"


async def test_missing_authorization_fails_closed() -> None:
    verifier = make_verifier()
    with pytest.raises(UnauthorizedError):
        await verifier.verify(None)


async def test_non_bearer_scheme_fails_closed() -> None:
    verifier = make_verifier()
    with pytest.raises(UnauthorizedError):
        await verifier.verify("Basic abc123")


async def test_expired_token_fails_closed() -> None:
    verifier = make_verifier()
    token = sign_token("user-123", expires_in_seconds=-3600)
    with pytest.raises(UnauthorizedError):
        await verifier.verify(f"Bearer {token}")


async def test_bad_signature_fails_closed() -> None:
    verifier = make_verifier()
    token = sign_token("user-123")
    tampered = f"{token[:-4]}XXXX"
    with pytest.raises(UnauthorizedError):
        await verifier.verify(f"Bearer {tampered}")


async def test_wrong_issuer_fails_closed() -> None:
    verifier = make_verifier()
    token = sign_token("user-123", issuer="https://evil.example/auth/v1")
    with pytest.raises(UnauthorizedError):
        await verifier.verify(f"Bearer {token}")


async def test_wrong_audience_fails_closed() -> None:
    verifier = make_verifier()
    token = sign_token("user-123", audience="service_role")
    with pytest.raises(UnauthorizedError):
        await verifier.verify(f"Bearer {token}")


async def test_malformed_token_fails_closed() -> None:
    verifier = make_verifier()
    with pytest.raises(UnauthorizedError):
        await verifier.verify("Bearer not.a.jwt")


async def test_token_without_kid_fails_closed() -> None:
    verifier = make_verifier()
    import time

    import jwt as pyjwt

    payload = {
        "iss": TEST_ISSUER,
        "aud": "authenticated",
        "sub": "user-123",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    from tests.jwt_support import _PRIVATE_PEM

    token = pyjwt.encode(payload, _PRIVATE_PEM, algorithm="RS256", headers={})
    with pytest.raises(UnauthorizedError):
        await verifier.verify(f"Bearer {token}")


async def test_unknown_kid_forces_refresh_then_fails_closed() -> None:
    import base64

    from cryptography.hazmat.primitives.asymmetric import rsa

    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    nums = other.public_key().public_numbers()
    n = base64.urlsafe_b64encode(
        nums.n.to_bytes((nums.n.bit_length() + 7) // 8, "big")
    ).rstrip(b"=").decode()
    e = base64.urlsafe_b64encode(
        nums.e.to_bytes((nums.e.bit_length() + 7) // 8, "big")
    ).rstrip(b"=").decode()

    counter = 0
    verifier = make_verifier()

    async def other_jwks() -> dict[str, object]:
        nonlocal counter
        counter += 1
        return {"keys": [{"kty": "RSA", "kid": "other-kid", "n": n, "e": e}]}

    verifier._fetcher = other_jwks  # type: ignore[method-assign]
    await verifier._fetch_keys()  # warm the cache with an unrelated valid key
    warmed_calls = counter
    with pytest.raises(UnauthorizedError):
        await verifier.verify(
            f"Bearer {sign_token('user-123')}",  # kid never present
        )
    # Cache hit for the unknown kid misses; exactly one forced refresh occurs.
    assert counter == warmed_calls + 1


async def test_is_anonymous_in_app_metadata_counts_as_guest() -> None:
    verifier = make_verifier()
    token = sign_token(
        "anon-sub-789",
        is_anonymous=False,
        extra_claims={"app_metadata": {"is_anonymous": True}},
    )
    identity = await verifier.verify(f"Bearer {token}")
    assert identity.is_guest is True
    assert identity.guest_session_id == "anon-sub-789"


async def test_error_message_never_contains_token_material() -> None:
    verifier = make_verifier()
    token = sign_token("user-123")
    with pytest.raises(UnauthorizedError) as exc_info:
        await verifier.verify(f"Bearer {token[:-4]}XXXX")
    assert token not in str(exc_info.value)
    assert "session" in str(exc_info.value).lower() or "authentication" in str(
        exc_info.value
    ).lower()


async def test_verifier_is_swappable_behind_seam() -> None:
    from app.api.deps import get_verifier
    from app.core.config import Settings

    verifier = get_verifier(Settings(supabase_url="https://test-project.supabase.co"))
    assert isinstance(verifier, SupabaseJWTVerifier)
