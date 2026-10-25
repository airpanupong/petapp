from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models import AppNotification, Conversation, FoundPost, LostPost, Message, Pet, Sighting, User
from app.services import account_service
from app.services.account_service import wipe_content
from tests.test_pagination import found_post, lost_post
from tests.test_lost_checkin import auth_headers
from tests.test_super_admin import login, set_role

API = "/api/v1"


def count(model):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_delete_account_removes_user_content_and_keeps_others(client):
    alice = auth_headers(client, "alice@example.com")
    bob = auth_headers(client, "bob@example.com")
    bob_id = client.get(f"{API}/users/me", headers=bob).json()["data"]["id"]

    alice_lost = lost_post(client, alice, "Momo", 20)
    found_post(client, alice, 21)
    bob_lost = lost_post(client, bob, "Taro", 22)
    client.post(
        f"{API}/lost-posts/{bob_lost['id']}/sightings",
        headers=alice,
        json={"seen_at": "2026-09-22T05:00:00Z", "latitude": 13.7, "longitude": 100.5},
    )
    assert client.post(f"{API}/lost-posts/{alice_lost['id']}/follow", headers=bob).status_code == 201
    conv = client.post(f"{API}/conversations", headers=alice, json={"member_user_id": bob_id}).json()["data"]
    client.post(f"{API}/conversations/{conv['id']}/messages", headers=alice, json={"content": "hi"})

    wrong = client.request("DELETE", f"{API}/users/me", headers=alice, json={"password": "nope-nope"})
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "INVALID_PASSWORD"

    res = client.request("DELETE", f"{API}/users/me", headers=alice, json={"password": "StrongPass123!"})
    assert res.status_code == 204, res.text

    assert login(client, "alice@example.com").status_code == 401
    assert client.get(f"{API}/users/me", headers=alice).status_code == 401
    assert client.get(f"{API}/conversations", headers=bob).json()["data"] == []
    assert client.get(f"{API}/me/following-cases", headers=bob).json()["data"] == []
    assert client.get(f"{API}/lost-posts/{bob_lost['id']}/sightings", headers=bob).json()["data"] == []
    assert client.get(f"{API}/lost-posts/{bob_lost['id']}", headers=bob).status_code == 200
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 1
        assert db.scalar(select(func.count()).select_from(Pet)) == 1
        assert db.scalar(select(func.count()).select_from(FoundPost)) == 0
        refs = db.scalars(select(AppNotification.reference_id)).all()
        assert alice_lost["id"] not in refs and conv["id"] not in refs


def test_super_admin_cannot_delete_own_account(client):
    boss = auth_headers(client, "boss@example.com")
    set_role("boss@example.com", "super_admin")
    res = client.request("DELETE", f"{API}/users/me", headers=boss, json={"password": "StrongPass123!"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "SUPER_ADMIN_UNDELETABLE"


def test_wipe_content_keeps_accounts(client, tmp_path, monkeypatch):
    monkeypatch.setattr(account_service, "LOCAL_UPLOAD_DIR", tmp_path)
    (tmp_path / "old-post.jpg").write_bytes(b"x")
    alice = auth_headers(client, "alice@example.com")
    bob = auth_headers(client, "bob@example.com")
    bob_id = client.get(f"{API}/users/me", headers=bob).json()["data"]["id"]
    lost = lost_post(client, alice, "Momo", 20)
    found_post(client, bob, 21)
    client.post(
        f"{API}/lost-posts/{lost['id']}/sightings",
        headers=bob,
        json={"seen_at": "2026-09-22T05:00:00Z", "latitude": 13.7, "longitude": 100.5},
    )
    conv = client.post(f"{API}/conversations", headers=alice, json={"member_user_id": bob_id}).json()["data"]
    client.post(f"{API}/conversations/{conv['id']}/messages", headers=alice, json={"content": "hi"})

    with SessionLocal() as db:
        wipe_content(db)

    for model in (Pet, LostPost, FoundPost, Sighting, Conversation, Message, AppNotification):
        assert count(model) == 0, model.__tablename__
    assert count(User) == 2
    assert list(tmp_path.iterdir()) == []
    assert login(client, "alice@example.com").status_code == 200
