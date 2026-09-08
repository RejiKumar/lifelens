"""Identity resolution seam.

scan-v1 resolves request identity through an :class:`AuthVerifier` seam. The
MVP ships :class:`GuestVerifier`, which reads a guest session header and has no
auth implementation. auth-v1 later swaps in a JWT/JWKS verifier without
changing the API, storage paths, or business logic, because this module is the
single collision point for identity.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol

GUEST_SESSION_HEADER = "x-guest-session"


@dataclass(frozen=True)
class Identity:
    """Resolved identity of the requesting client.

    Exactly one of ``user_id`` or ``guest_session_id`` is set.
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

    async def verify(self, authorization: str | None, guest_session: str | None) -> Identity:
        ...


class GuestVerifier:
    """MVP identity resolver for the guest-only scan flow.

    Reads the guest session header if present; otherwise issues an ephemeral
    per-request session id so a scan can always complete as a guest. No
    authentication is performed — this is the documented acceptable MVP risk,
    closed by auth-v1.
    """

    async def verify(self, authorization: str | None, guest_session: str | None) -> Identity:
        session = _valid_session(guest_session) if guest_session else None
        if session is None:
            session = str(uuid.uuid4())
        return Identity(guest_session_id=session)


def _valid_session(value: str) -> str | None:
    value = value.strip()
    if not value or len(value) > 64 or any(ch.isspace() for ch in value):
        return None
    return value
