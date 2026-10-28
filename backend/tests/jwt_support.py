"""Test helpers for minting and verifying Supabase-style JWTs.

Generates a module-scoped RSA key pair, signs access tokens exactly the way
Supabase does (RS256, issuer ``{url}/auth/v1``, audience ``authenticated``,
``sub`` claim, optional ``is_anonymous``), and exposes a JWKS fetcher backed by
the same public key so :class:`SupabaseJWTVerifier` can verify offline.
"""

from __future__ import annotations

import base64
import time
from typing import Any

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.identity import SupabaseJWTVerifier

TEST_SUPABASE_URL = "https://test-project.supabase.co"
TEST_ISSUER = f"{TEST_SUPABASE_URL}/auth/v1"
TEST_KID = "test-rsa-key-1"

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_key = _private_key.public_key()
_PRIVATE_PEM = _private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)


def _to_base64url_int(value: int) -> str:
    length = (value.bit_length() + 7) // 8
    raw = value.to_bytes(length, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _public_jwk() -> dict[str, str]:
    numbers = _public_key.public_numbers()
    return {
        "kty": "RSA",
        "kid": TEST_KID,
        "use": "sig",
        "alg": "RS256",
        "n": _to_base64url_int(numbers.n),
        "e": _to_base64url_int(numbers.e),
    }


async def fetch_test_jwks() -> dict[str, Any]:
    return {"keys": [_public_jwk()]}


def sign_token(
    sub: str,
    *,
    issuer: str = TEST_ISSUER,
    audience: str = "authenticated",
    is_anonymous: bool = False,
    expires_in_seconds: int = 3600,
    iat_offset: int = 0,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = int(time.time())
    payload: dict[str, Any] = {
        "iss": issuer,
        "aud": audience,
        "sub": sub,
        "iat": now + iat_offset,
        "exp": now + expires_in_seconds,
    }
    if is_anonymous:
        payload["is_anonymous"] = True
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, _PRIVATE_PEM, algorithm="RS256", headers={"kid": TEST_KID})


def make_verifier(*, supabase_url: str = TEST_SUPABASE_URL) -> SupabaseJWTVerifier:
    return SupabaseJWTVerifier(supabase_url=supabase_url, jwks_fetcher=fetch_test_jwks)


def bearer_header(sub: str, *, is_anonymous: bool = False) -> dict[str, str]:
    return {"Authorization": f"Bearer {sign_token(sub, is_anonymous=is_anonymous)}"}
