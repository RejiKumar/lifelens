from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_ok() -> None:
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "environment" in body
