import json

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.features import WebPushSubscription
from app.services import web_push_service
from app.services.notification_service import add_notification

from tests.test_api import register
from tests.test_super_admin import bearer

API = "/api/v1"
SUB = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
    "keys": {"p256dh": "BPk3-test-key", "auth": "auth-secret"},
}


def enable_web_push(monkeypatch):
    monkeypatch.setattr(settings, "vapid_public_key", "BPUBLIC")
    monkeypatch.setattr(settings, "vapid_private_key", "PRIVATE")


def test_config_hides_key_when_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "vapid_private_key", None)
    data = client.get(f"{API}/push/web/config").json()["data"]
    assert data == {"enabled": False, "public_key": None}


def test_subscribe_moves_endpoint_between_users_and_unsubscribes(client, monkeypatch):
    enable_web_push(monkeypatch)
    assert client.get(f"{API}/push/web/config").json()["data"] == {"enabled": True, "public_key": "BPUBLIC"}

    first = register(client, "first@example.com")
    second = register(client, "second@example.com")
    assert client.post(f"{API}/push/web/subscriptions", headers=bearer(first), json=SUB).status_code == 201
    assert client.post(f"{API}/push/web/subscriptions", headers=bearer(second), json=SUB).status_code == 201
    with SessionLocal() as db:
        rows = db.query(WebPushSubscription).all()
        assert [r.user_id for r in rows] == [second["user"]["id"]]

    res = client.post(f"{API}/push/web/unsubscribe", headers=bearer(second), json={"endpoint": SUB["endpoint"]})
    assert res.status_code == 200
    with SessionLocal() as db:
        assert db.query(WebPushSubscription).count() == 0


def test_rejects_non_https_endpoint(client):
    auth = register(client)
    bad = {**SUB, "endpoint": "http://example.com/push"}
    assert client.post(f"{API}/push/web/subscriptions", headers=bearer(auth), json=bad).status_code == 422


def test_notification_is_pushed_with_deep_link(client, monkeypatch):
    enable_web_push(monkeypatch)
    sent = []
    monkeypatch.setattr(web_push_service._executor, "submit", lambda fn, subs, payload: sent.append((subs, json.loads(payload))))

    auth = register(client)
    client.post(f"{API}/push/web/subscriptions", headers=bearer(auth), json=SUB)
    with SessionLocal() as db:
        add_notification(db, auth["user"]["id"], "new_sighting", "มีเบาะแสใหม่", "body", "lost_post", "post-1")
        db.commit()

    assert len(sent) == 1
    subs, payload = sent[0]
    assert subs[0]["endpoint"] == SUB["endpoint"]
    assert payload["url"] == "/lost/post-1"
    assert payload["title"] == "มีเบาะแสใหม่"
