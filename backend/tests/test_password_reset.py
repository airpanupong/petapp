import re
from datetime import timedelta

from app.core.database import SessionLocal
from app.models.user import PasswordResetCode
from app.services import email_service

from tests.test_api import register
from tests.test_super_admin import login

API = "/api/v1"


def last_code():
    body = email_service.outbox[-1].get_body(("plain",)).get_content()
    return re.search(r"\b(\d{6})\b", body).group(1)


def forgot(client, email="big@example.com"):
    return client.post(f"{API}/auth/password/forgot", json={"email": email})


def setup_function():
    email_service.outbox.clear()


def test_unknown_email_is_reported_and_nothing_is_sent(client):
    res = forgot(client, "nobody@example.com")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "EMAIL_NOT_FOUND"
    assert email_service.outbox == []


def test_full_reset_flow_logs_in_and_revokes_old_sessions(client):
    old = register(client)
    res = forgot(client)
    assert res.status_code == 200, res.text
    assert email_service.outbox[-1]["To"] == "big@example.com"
    code = last_code()

    assert client.post(f"{API}/auth/password/verify", json={"email": "big@example.com", "code": code}).status_code == 200
    res = client.post(f"{API}/auth/password/reset", json={"email": "big@example.com", "code": code, "new_password": "BrandNew123!"})
    assert res.status_code == 200, res.text
    assert res.json()["data"]["access_token"]

    assert login(client, "big@example.com").status_code == 401
    assert login(client, "big@example.com", "BrandNew123!").status_code == 200
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": old["refresh_token"]}).status_code == 401
    # The code is single use.
    res = client.post(f"{API}/auth/password/reset", json={"email": "big@example.com", "code": code, "new_password": "Another123!"})
    assert res.status_code == 400


def test_resend_cooldown(client):
    register(client)
    assert forgot(client).status_code == 200
    res = forgot(client)
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "RESET_COOLDOWN"
    assert len(email_service.outbox) == 1


def test_new_code_replaces_old_one(client):
    register(client)
    forgot(client)
    first = last_code()
    with SessionLocal() as db:
        for row in db.query(PasswordResetCode).all():
            row.created_at = row.created_at - timedelta(minutes=2)
        db.commit()
    forgot(client)
    second = last_code()
    if first != second:
        res = client.post(f"{API}/auth/password/verify", json={"email": "big@example.com", "code": first})
        assert res.status_code == 400
    assert client.post(f"{API}/auth/password/verify", json={"email": "big@example.com", "code": second}).status_code == 200


def test_wrong_code_locks_after_five_attempts(client):
    register(client)
    forgot(client)
    code = last_code()
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        res = client.post(f"{API}/auth/password/verify", json={"email": "big@example.com", "code": wrong})
        assert res.status_code == 400
    assert res.json()["error"]["code"] == "RESET_CODE_LOCKED"
    res = client.post(f"{API}/auth/password/verify", json={"email": "big@example.com", "code": code})
    assert res.json()["error"]["code"] == "RESET_CODE_LOCKED"


def test_resend_api_is_used_when_configured(client, monkeypatch):
    from app.core.config import settings

    calls = []

    class Ok:
        status_code = 200
        text = "{}"

    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(email_service.httpx, "post", lambda url, **kw: calls.append((url, kw)) or Ok())
    register(client)
    assert forgot(client).status_code == 200
    url, kw = calls[0]
    assert url == "https://api.resend.com/emails"
    assert kw["json"]["to"] == ["big@example.com"]
    assert re.search(r"\d{6}", kw["json"]["text"])
    assert email_service.outbox == []
