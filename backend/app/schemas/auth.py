"""Auth API schemas.

Auth-v1 reconciles the backend auth surface: mobile talks to Supabase Auth
directly, and the backend verifies JWTs and exposes an identity-aware read
helper only. No credential-proxying endpoints exist here.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.identity import Identity


class MeResponse(BaseModel):
    """Resolved identity derived from the verified Bearer token."""

    user_id: str | None = Field(default=None, description="Authenticated user id (sub claim)")
    guest_session_id: str | None = Field(
        default=None,
        description="Anonymous-auth sub when the token is an anonymous guest",
    )
    is_guest: bool = Field(description="True when the token is an anonymous guest")

    @classmethod
    def from_identity(cls, identity: Identity) -> MeResponse:
        return cls(
            user_id=identity.user_id,
            guest_session_id=identity.guest_session_id,
            is_guest=identity.is_guest,
        )
