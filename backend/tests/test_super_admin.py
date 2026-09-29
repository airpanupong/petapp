from app.bootstrap_admin import ensure_super_admin
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User

from tests.test_api import register

API = "/api/v1"


def bearer(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def set_role(email, role):
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).one()
        user.role = role
        db.commit()


def login(client, email, password="StrongPass123!"):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def create_lost_post(client, headers):
    pet = client.post(f"{API}/pets", headers=headers, json={"name": "Momo", "animal_type": "cat"}).json()["data"]
    res = client.post(
        f"{API}/lost-posts",
        headers=headers,
        json={
            "pet_id": pet["id"],
            "lost_at": "2026-09-22T04:30:00Z",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "location_text": "Bangkok",
            "search_radius_km": 5,
            "reward_enabled": False,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


def test_bootstrap_creates_and_promotes_super_admin(client, monkeypatch):
    monkeypatch.setattr(settings, "super_admin_password", "SupportPass123!")
    ensure_super_admin()
    res = login(client, settings.super_admin_email, "SupportPass123!")
    assert res.status_code == 200, res.text
    assert res.json()["data"]["user"]["role"] == "super_admin"

    set_role(settings.super_admin_email, "user")
    ensure_super_admin()
    assert login(client, settings.super_admin_email, "SupportPass123!").json()["data"]["user"]["role"] == "super_admin"


def test_super_admin_blocks_user_and_hides_posts(client):
    boss = register(client, "boss@example.com")
    set_role("boss@example.com", "super_admin")
    victim = register(client, "spam@example.com")
    post = create_lost_post(client, bearer(victim))

    res = client.post(f"{API}/admin/users/{victim['user']['id']}/block", headers=bearer(boss))
    assert res.status_code == 200, res.text
    assert res.json()["data"]["status"] == "blocked"

    assert login(client, "spam@example.com").status_code == 403
    assert client.get(f"{API}/users/me", headers=bearer(victim)).status_code == 401
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": victim["refresh_token"]}).status_code == 401
    assert client.get(f"{API}/lost-posts/{post['id']}").status_code == 404
    assert all(p["id"] != post["id"] for p in client.get(f"{API}/lost-posts").json()["data"])
    assert client.get(f"{API}/lost-posts", params={"status": "hidden"}).json()["data"] == []

    assert client.post(f"{API}/admin/users/{victim['user']['id']}/unblock", headers=bearer(boss)).status_code == 200
    assert login(client, "spam@example.com").status_code == 200
    assert client.get(f"{API}/lost-posts/{post['id']}").json()["data"]["status"] == "active"


def test_hide_and_unhide_single_post(client):
    boss = register(client, "boss@example.com")
    set_role("boss@example.com", "super_admin")
    owner = register(client, "owner@example.com")
    post = create_lost_post(client, bearer(owner))

    assert client.post(f"{API}/admin/lost-posts/{post['id']}/hide", headers=bearer(boss)).status_code == 200
    assert client.get(f"{API}/lost-posts/{post['id']}").status_code == 404
    assert client.get(f"{API}/lost-posts/{post['id']}", headers=bearer(owner)).json()["data"]["status"] == "hidden"
    assert client.get(f"{API}/lost-posts/{post['id']}", headers=bearer(boss)).status_code == 200

    assert client.post(f"{API}/admin/lost-posts/{post['id']}/unhide", headers=bearer(boss)).status_code == 200
    assert client.get(f"{API}/lost-posts/{post['id']}").status_code == 200


def test_permissions(client):
    boss = register(client, "boss@example.com")
    set_role("boss@example.com", "super_admin")
    admin = register(client, "admin@example.com")
    set_role("admin@example.com", "admin")
    user = register(client, "user@example.com")
    post = create_lost_post(client, bearer(user))

    assert client.get(f"{API}/admin/users", headers=bearer(admin)).status_code == 200
    assert client.get(f"{API}/admin/users", headers=bearer(user)).status_code == 403
    assert client.post(f"{API}/admin/users/{user['user']['id']}/block", headers=bearer(admin)).status_code == 403
    assert client.post(f"{API}/admin/lost-posts/{post['id']}/hide", headers=bearer(admin)).status_code == 403
    assert client.post(f"{API}/admin/users/{boss['user']['id']}/block", headers=bearer(boss)).status_code == 409

    res = client.post(f"{API}/admin/users/{user['user']['id']}/role", headers=bearer(boss), json={"role": "admin"})
    assert res.status_code == 200 and res.json()["data"]["role"] == "admin"
    bad = client.post(f"{API}/admin/users/{user['user']['id']}/role", headers=bearer(boss), json={"role": "super_admin"})
    assert bad.status_code == 422
