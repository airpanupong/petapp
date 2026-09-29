from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.features import AppNotification
from app.models.lost_found import LostPost
from app.services.lost_checkin_service import run_lost_checkins


def auth_headers(client, email):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPass123!", "display_name": email.split("@")[0]},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['data']['access_token']}"}


def create_lost(client, headers, name="Momo", animal="cat", lat=13.7563, lng=100.5018, radius=3):
    pet = client.post("/api/v1/pets", headers=headers, json={"name": name, "animal_type": animal, "gender": "female"})
    assert pet.status_code == 201, pet.text
    lost = client.post(
        "/api/v1/lost-posts",
        headers=headers,
        json={
            "pet_id": pet.json()["data"]["id"],
            "lost_at": "2026-09-22T04:30:00Z",
            "latitude": lat,
            "longitude": lng,
            "search_radius_km": radius,
        },
    )
    assert lost.status_code == 201, lost.text
    return lost.json()["data"]


def notifications(client, headers):
    return client.get("/api/v1/notifications", headers=headers).json()["data"]


def test_lost_alert_reaches_users_without_saved_preferences(client):
    owner = auth_headers(client, "owner@example.com")
    near = auth_headers(client, "near@example.com")
    far = auth_headers(client, "far@example.com")
    client.put("/api/v1/me/location", headers=near, json={"latitude": 13.7600, "longitude": 100.5050})
    client.put("/api/v1/me/location", headers=far, json={"latitude": 14.5, "longitude": 100.9})

    create_lost(client, owner)

    assert [n["type"] for n in notifications(client, near)] == ["lost_pet_alert"]
    assert notifications(client, far) == []


def test_found_post_alerts_matching_lost_owner_and_neighbours(client):
    owner = auth_headers(client, "owner@example.com")
    finder = auth_headers(client, "finder@example.com")
    neighbour = auth_headers(client, "neighbour@example.com")
    client.put("/api/v1/me/location", headers=neighbour, json={"latitude": 13.7580, "longitude": 100.5030})
    client.put("/api/v1/me/location", headers=owner, json={"latitude": 13.7560, "longitude": 100.5010})
    create_lost(client, owner)

    found = client.post(
        "/api/v1/found-posts",
        headers=finder,
        json={"animal_type": "cat", "found_at": "2026-09-23T04:30:00Z", "latitude": 13.7570, "longitude": 100.5020},
    )
    assert found.status_code == 201, found.text

    owner_types = [n["type"] for n in notifications(client, owner)]
    assert owner_types == ["found_match_alert"]
    assert sorted(n["type"] for n in notifications(client, neighbour)) == ["found_pet_alert", "lost_pet_alert"]
    assert notifications(client, finder) == []

    cancel = client.post(f"/api/v1/found-posts/{found.json()['data']['id']}/cancel", headers=finder)
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["data"]["status"] == "cancelled"


def test_owner_can_edit_lost_and_found_posts(client):
    owner = auth_headers(client, "owner@example.com")
    other = auth_headers(client, "other@example.com")
    lost = create_lost(client, owner)

    edited = client.patch(
        f"/api/v1/lost-posts/{lost['id']}",
        headers=owner,
        json={"latitude": 13.8, "longitude": 100.6, "location_text": "Chatuchak", "description": "grey collar", "reward_enabled": True, "reward_text": "1,000"},
    )
    assert edited.status_code == 200, edited.text
    data = edited.json()["data"]
    assert (data["latitude"], data["location_text"], data["reward_text"]) == (13.8, "Chatuchak", "1,000")
    assert client.patch(f"/api/v1/lost-posts/{lost['id']}", headers=other, json={"description": "x"}).status_code == 403

    found = client.post(
        "/api/v1/found-posts",
        headers=owner,
        json={"animal_type": "cat", "found_at": "2026-09-23T04:30:00Z", "latitude": 13.7, "longitude": 100.5},
    ).json()["data"]
    edited_found = client.patch(f"/api/v1/found-posts/{found['id']}", headers=owner, json={"animal_type": "dog", "color": "brown"})
    assert edited_found.status_code == 200, edited_found.text
    assert (edited_found.json()["data"]["animal_type"], edited_found.json()["data"]["color"]) == ("dog", "brown")
    assert client.patch(f"/api/v1/found-posts/{found['id']}", headers=other, json={"color": "x"}).status_code == 403


def test_posts_keep_up_to_three_photos(client):
    owner = auth_headers(client, "owner@example.com")
    pet = client.post("/api/v1/pets", headers=owner, json={"name": "Momo", "animal_type": "cat", "gender": "female"}).json()["data"]
    lost = client.post(
        "/api/v1/lost-posts",
        headers=owner,
        json={"pet_id": pet["id"], "lost_at": "2026-09-22T04:30:00Z", "latitude": 13.7, "longitude": 100.5, "image_urls": ["/a.jpg", "/b.jpg", "/c.jpg"]},
    ).json()["data"]
    assert (lost["image_url"], lost["image_urls"]) == ("/a.jpg", ["/a.jpg", "/b.jpg", "/c.jpg"])
    too_many = client.post(
        "/api/v1/found-posts",
        headers=owner,
        json={"animal_type": "cat", "found_at": "2026-09-23T04:30:00Z", "latitude": 13.7, "longitude": 100.5, "image_urls": ["/1", "/2", "/3", "/4"]},
    )
    assert too_many.status_code == 422

    edited = client.patch(f"/api/v1/lost-posts/{lost['id']}", headers=owner, json={"image_urls": ["/c.jpg", "/d.jpg"]}).json()["data"]
    assert (edited["image_url"], edited["image_urls"]) == ("/c.jpg", ["/c.jpg", "/d.jpg"])
    untouched = client.patch(f"/api/v1/lost-posts/{lost['id']}", headers=owner, json={"description": "x"}).json()["data"]
    assert untouched["image_urls"] == ["/c.jpg", "/d.jpg"]
    cleared = client.patch(f"/api/v1/lost-posts/{lost['id']}", headers=owner, json={"image_urls": []}).json()["data"]
    assert (cleared["image_url"], cleared["image_urls"]) == (None, [])

    found = client.post(
        "/api/v1/found-posts",
        headers=owner,
        json={"animal_type": "dog", "found_at": "2026-09-23T04:30:00Z", "latitude": 13.7, "longitude": 100.5, "image_url": "/legacy.jpg"},
    ).json()["data"]
    assert found["image_urls"] == ["/legacy.jpg"]


def test_chat_context_labels_sighting_and_post_threads(client):
    owner = auth_headers(client, "owner@example.com")
    helper = auth_headers(client, "helper@example.com")
    lost = create_lost(client, owner, name="Yuzu")
    helper_lost = create_lost(client, helper, name="Air")

    tip = client.post(
        f"/api/v1/lost-posts/{lost['id']}/sightings",
        headers=helper,
        json={"seen_at": "2026-09-22T05:00:00Z", "latitude": 13.7, "longitude": 100.5},
    )
    assert tip.status_code == 201, tip.text
    tip_chat = client.post(f"/api/v1/lost-posts/{lost['id']}/contact", headers=helper).json()["data"]
    client.post(f"/api/v1/conversations/{tip_chat['id']}/messages", headers=helper, json={"content": "saw Yuzu"})
    post_chat = client.post(f"/api/v1/lost-posts/{helper_lost['id']}/contact", headers=owner).json()["data"]
    assert post_chat["id"] == tip_chat["id"]
    again = client.post(f"/api/v1/lost-posts/{helper_lost['id']}/contact", headers=owner).json()["data"]
    assert again["id"] == tip_chat["id"]

    [chat] = client.get("/api/v1/conversations", headers=owner).json()["data"]
    assert (chat["context"]["kind"], chat["context"]["pet_name"], chat["context"]["mine"]) == ("lost", "Air", False)
    assert chat["last_message"]["content"] == "saw Yuzu"
    assert chat["unread_count"] == 1

    messages = client.get(f"/api/v1/conversations/{chat['id']}/messages", headers=owner).json()["data"]
    assert [m["message_type"] for m in messages] == ["context", "text", "context"]
    assert [(m["context"]["kind"], m["context"]["pet_name"]) for m in messages if m["context"]] == [("sighting", "Yuzu"), ("lost", "Air")]


def _age_post(post_id, **fields):
    with SessionLocal() as db:
        post = db.get(LostPost, post_id)
        for key, value in fields.items():
            setattr(post, key, value)
        db.commit()


def test_weekly_checkin_asks_then_restarts_when_still_searching(client):
    owner = auth_headers(client, "owner@example.com")
    lost = create_lost(client, owner)
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        assert run_lost_checkins(db, now) == {"asked": 0, "cancelled": 0}

    _age_post(lost["id"], created_at=now - timedelta(days=8))
    with SessionLocal() as db:
        assert run_lost_checkins(db, now) == {"asked": 1, "cancelled": 0}
        assert run_lost_checkins(db, now) == {"asked": 0, "cancelled": 0}

    detail = client.get(f"/api/v1/lost-posts/{lost['id']}", headers=owner).json()["data"]
    assert detail["checkin_asked_at"] is not None
    assert detail["checkin_deadline_at"] is not None
    assert notifications(client, owner)[0]["type"] == "lost_checkin"

    answer = client.post(f"/api/v1/lost-posts/{lost['id']}/checkin", headers=owner, json={"found": False})
    assert answer.status_code == 200, answer.text
    data = answer.json()["data"]
    assert data["status"] == "active"
    assert data["checkin_asked_at"] is None
    assert all(n["is_read"] for n in notifications(client, owner) if n["type"] == "lost_checkin")

    with SessionLocal() as db:
        assert run_lost_checkins(db, now + timedelta(days=6)) == {"asked": 0, "cancelled": 0}
        assert run_lost_checkins(db, now + timedelta(days=7, minutes=1)) == {"asked": 1, "cancelled": 0}


def test_weekly_checkin_found_marks_resolved(client):
    owner = auth_headers(client, "owner@example.com")
    lost = create_lost(client, owner)
    now = datetime.now(timezone.utc)
    _age_post(lost["id"], created_at=now - timedelta(days=8))
    with SessionLocal() as db:
        run_lost_checkins(db, now)

    answer = client.post(f"/api/v1/lost-posts/{lost['id']}/checkin", headers=owner, json={"found": True})
    assert answer.status_code == 200, answer.text
    assert answer.json()["data"]["status"] == "resolved"
    assert answer.json()["data"]["checkin_deadline_at"] is None


def test_weekly_checkin_without_answer_cancels_post(client):
    owner = auth_headers(client, "owner@example.com")
    lost = create_lost(client, owner)
    now = datetime.now(timezone.utc)
    _age_post(lost["id"], created_at=now - timedelta(days=8))
    with SessionLocal() as db:
        run_lost_checkins(db, now)
        assert run_lost_checkins(db, now + timedelta(days=6)) == {"asked": 0, "cancelled": 0}
        assert run_lost_checkins(db, now + timedelta(days=7, minutes=1)) == {"asked": 0, "cancelled": 1}

    detail = client.get(f"/api/v1/lost-posts/{lost['id']}", headers=owner).json()["data"]
    assert detail["status"] == "cancelled"
    with SessionLocal() as db:
        types = [n.type for n in db.query(AppNotification).all()]
    assert "lost_auto_cancelled" in types

    other = auth_headers(client, "other@example.com")
    forbidden = client.post(f"/api/v1/lost-posts/{lost['id']}/checkin", headers=other, json={"found": False})
    assert forbidden.status_code == 403
