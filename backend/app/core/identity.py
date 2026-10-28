"""Identity resolution seam.

auth-v1 resolves request identity through an :class:`AuthVerifier` seam.
:class:`SupabaseJWTVerifier` verifies Supabase access tokens server-side with
PyJWT against the Supabase project JWKS (RS256/ES256), validating issuer and
audience, and maps anonymous-auth tokens to guest scope. This module is the
single collision point for identity: swapping the verifier never changes the
API, storage paths, or business logic, because everything consumes
:class:`Identity`.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import jwt
from jwt import PyJWK
from jwt.exceptions import InvalidKeyError, MissingCryptographyError, PyJWKError

from app.core.errors import UnauthorizedError

SUPABASE_AUDIENCE = "authenticated"
JWKS_PATH = "/auth/v1/.well-known/jwks.json"
JWKS_CACHE_TTL_SECONDS = 300.0
JWKS_FETCH_TIMEOUT_SECONDS = 10.0
SUPPORTED_ALGORITHMS = ("RS256", "ES256")


@dataclass(frozen=True)
class Identity:
    """Resolved identity of the requesting client.

    Exactly one of ``user_id`` or ``guest_session_id`` is set. Guest scope is
    keyed by the anonymous-auth ``sub``.
    """

    user_id: str | None = None
    guest_session_id: str | None = None

    @property
    def is_guest(self) -> bool:
        return self.guest_session_id is not None

    @property
    def owner(self) -> str:
        if self.user_id is not None:
            return self.user_id
        return self.guest_session_id or ""


class AuthVerifier(Protocol):
    """Resolves request headers into an :class:`Identity`."""

    async def verify(self, authorization: str | None) -> Identity:
        ...


JwksFetcher = Callable[[], Awaitable[dict[str, Any]]]


class SupabaseJWTVerifier:
    """Verifies Supabase JWTs into :class:`Identity` via PyJWT + JWKS.

    Authenticated tokens resolve to :class:`Identity` with ``user_id`` set to
    the ``sub`` claim; anonymous-auth tokens (``is_anonymous: true``) resolve
    to guest scope keyed by ``sub``. JWKS is fetched with a bounded timeout and
    cached in-process for a short TTL; an unknown ``kid`` forces a single
    refresh and then fails closed as unauthenticated.
    """

    def __init__(
        self,
        *,
        supabase_url: str,
        audience: str = SUPABASE_AUDIENCE,
        algorithms: tuple[str, ...] = SUPPORTED_ALGORITHMS,
        cache_ttl_seconds: float = JWKS_CACHE_TTL_SECONDS,
        fetch_timeout_seconds: float = JWKS_FETCH_TIMEOUT_SECONDS,
        jwks_fetcher: JwksFetcher | None = None,
    ) -> None:
        base = supabase_url.rstrip("/")
        self._jwks_url = f"{base}{JWKS_PATH}"
        self._issuer = f"{base}/auth/v1"
        self._audience = audience
        self._algorithms = list(algorithms)
        self._ttl = cache_ttl_seconds
        self._timeout = fetch_timeout_seconds
        self._keys: dict[str, Any] = {}
        self._fetched_at = 0.0
        self._lock = asyncio.Lock()
        self._fetcher = jwks_fetcher or self._fetch_jwks_from_url

    async def verify(self, authorization: str | None) -> Identity:
        token = _extract_bearer_token(authorization)
        if token is None:
            raise UnauthorizedError("Authentication required.")
        try:
            payload = await self._decode(token)
        except UnauthorizedError:
            raise
        except jwt.InvalidTokenError:
            raise UnauthorizedError("Invalid or expired session.") from None
        return _identity_from_claims(payload)

    async def _decode(self, token: str) -> dict[str, Any]:
        kid = _extract_kid(token)
        key = await self._signing_key(kid)
        if key is None:
            raise UnauthorizedError("Invalid or expired session.")
        return jwt.decode(
            token,
            key=key,
            algorithms=self._algorithms,
            issuer=self._issuer,
            audience=self._audience,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )

    async def _signing_key(self, kid: str | None) -> Any | None:
        async with self._lock:
            await self._refresh_if_stale()
            key = self._keys.get(kid or "")
            if key is not None:
                return key
            await self._fetch_keys()
            return self._keys.get(kid or "")

    async def _refresh_if_stale(self) -> None:
        if not self._keys or (time.monotonic() - self._fetched_at) >= self._ttl:
            await self._fetch_keys()

    async def _fetch_keys(self) -> None:
        try:
            jwks = await self._fetcher()
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            if not self._keys:
                raise InvalidKeyError("JWKS unavailable.") from exc
            return
        keys: dict[str, Any] = {}
        for entry in jwks.get("keys") or []:
            kid = entry.get("kid")
            if not isinstance(kid, str) or not kid:
                continue
            try:
                keys[kid] = PyJWK.from_dict(entry)
            except (InvalidKeyError, PyJWKError, MissingCryptographyError):
                continue
        if keys:
            self._keys = {**self._keys, **keys}
            self._fetched_at = time.monotonic()

    async def _fetch_jwks_from_url(self) -> dict[str, Any]:
        timeout = httpx.Timeout(self._timeout)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(self._jwks_url)
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else {}


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, separator, value = authorization.strip().partition(" ")
    if not separator or scheme.lower() != "bearer":
        return None
    token = value.strip()
    return token or None


def _extract_kid(token: str) -> str | None:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        raise UnauthorizedError("Invalid or expired session.") from None
    kid = header.get("kid")
    return kid if isinstance(kid, str) and kid else None


def _identity_from_claims(payload: dict[str, Any]) -> Identity:
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise UnauthorizedError("Invalid or expired session.")
    if _is_anonymous(payload):
        return Identity(guest_session_id=sub)
    return Identity(user_id=sub)


def _is_anonymous(payload: dict[str, Any]) -> bool:
    if payload.get("is_anonymous") is True:
        return True
    metadata = payload.get("app_metadata")
    if isinstance(metadata, dict) and metadata.get("is_anonymous") is True:
        return True
    return False
