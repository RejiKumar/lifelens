"""Shared pytest fixtures.

Installs the offline :class:`SupabaseJWTVerifier` (backed by a test RSA key)
as the app identity verifier so API tests exercise the real bearer-token path
without network access. API tests that re-assert their own dependency
overrides via ``app.dependency_overrides.clear()`` still get this autouse
fixture restored on the next test because it re-installs per test.
"""

from __future__ import annotations

import pytest

from app.api.deps import get_verifier
from app.main import app
from tests.jwt_support import make_verifier


@pytest.fixture(autouse=True)
def install_test_verifier() -> None:
    app.dependency_overrides[get_verifier] = lambda: make_verifier()
    yield
    app.dependency_overrides.pop(get_verifier, None)
