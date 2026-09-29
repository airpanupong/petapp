def register(client, email="big@example.com"):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPass123!", "display_name": "Big"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_pet_lost_sighting_nearby(client):
    auth = register(client)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    pet_res = client.post(
        "/api/v1/pets",
        headers=headers,
        json={
            "name": "Momo",
            "animal_type": "cat",
            "gender": "female",
            "color": "white-orange",
            "distinctive_marks": "Orange spot above left eye",
        },
    )
    assert pet_res.status_code == 201, pet_res.text
    pet = pet_res.json()["data"]
    assert pet["pet_code"].startswith("PET-")

    public_res = client.get(f"/api/v1/public/pets/qr/{pet['qr_token']}")
    assert public_res.status_code == 200
    assert public_res.json()["data"]["name"] == "Momo"

    lost_res = client.post(
        "/api/v1/lost-posts",
        headers=headers,
        json={
            "pet_id": pet["id"],
            "lost_at": "2026-09-22T04:30:00Z",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "location_text": "Bangkok",
            "search_radius_km": 5,
            "description": "Last seen near the road",
            "reward_enabled": False,
        },
    )
    assert lost_res.status_code == 201, lost_res.text
    lost = lost_res.json()["data"]

    sighting_res = client.post(
        f"/api/v1/lost-posts/{lost['id']}/sightings",
        headers=headers,
        json={
            "seen_at": "2026-09-22T05:00:00Z",
            "latitude": 13.757,
            "longitude": 100.502,
            "description": "Saw a similar cat",
        },
    )
    assert sighting_res.status_code == 201, sighting_res.text

    nearby_res = client.get(
        "/api/v1/nearby",
        params={"latitude": 13.7563, "longitude": 100.5018, "radius_km": 5},
    )
    assert nearby_res.status_code == 200
    assert len(nearby_res.json()["data"]["lost"]) == 1

    resolve_res = client.post(f"/api/v1/lost-posts/{lost['id']}/resolve", headers=headers)
    assert resolve_res.status_code == 200
    assert resolve_res.json()["data"]["status"] == "resolved"


def test_refresh_rotation(client):
    auth = register(client)
    first = auth["refresh_token"]
    res = client.post("/api/v1/auth/refresh", json={"refresh_token": first})
    assert res.status_code == 200, res.text
    second = res.json()["data"]["refresh_token"]
    assert second != first
    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": first})
    assert replay.status_code == 401


def test_full_feature_modules(client):
    owner = register(client, "owner@example.com")
    helper = register(client, "helper@example.com")
    oh = {"Authorization": f"Bearer {owner['access_token']}"}
    hh = {"Authorization": f"Bearer {helper['access_token']}"}

    pet_res = client.post(
        "/api/v1/pets",
        headers=oh,
        json={
            "name": "Lucky",
            "animal_type": "dog",
            "color": "brown-white",
            "microchip_id": "MC-123456",
            "distinctive_marks": "white left paw",
        },
    )
    assert pet_res.status_code == 201, pet_res.text
    pet = pet_res.json()["data"]

    health = client.put(
        f"/api/v1/pets/{pet['id']}/health",
        headers=oh,
        json={"allergies": "chicken", "medications": "daily tablet", "conditions": "none", "vet_name": "Happy Vet"},
    )
    assert health.status_code == 200, health.text
    vaccination = client.post(
        f"/api/v1/pets/{pet['id']}/vaccinations",
        headers=oh,
        json={"name": "Rabies", "given_at": "2026-09-01", "next_due_at": "2027-09-01"},
    )
    assert vaccination.status_code == 201, vaccination.text

    emergency = client.put(
        f"/api/v1/pets/{pet['id']}/emergency",
        headers=oh,
        json={
            "public_allergies": "Chicken",
            "emergency_note": "Please keep calm and call owner",
            "emergency_contact_name": "Big",
            "emergency_contact_phone": "0800000000",
            "show_contact_phone": True,
        },
    )
    assert emergency.status_code == 200, emergency.text

    verification = client.post(
        f"/api/v1/pets/{pet['id']}/ownership-verification",
        headers=oh,
        json={"method": "microchip", "evidence_note": "Microchip certificate available"},
    )
    assert verification.status_code == 201, verification.text
    assert verification.json()["data"]["status"] == "pending"

    guardian = client.post(
        f"/api/v1/pets/{pet['id']}/guardians",
        headers=oh,
        json={"email": "helper@example.com", "role": "family", "can_mark_lost": True},
    )
    assert guardian.status_code == 201, guardian.text
    assert guardian.json()["data"]["email"] == "helper@example.com"

    prefs = client.put(
        "/api/v1/notification-preferences",
        headers=hh,
        json={"lost_alerts": True, "radius_km": 5, "animal_type": "dog", "chat_notifications": True, "marketing_notifications": False},
    )
    assert prefs.status_code == 200, prefs.text
    loc = client.put("/api/v1/me/location", headers=hh, json={"latitude": 13.7565, "longitude": 100.5020})
    assert loc.status_code == 200, loc.text

    lost = client.post(
        "/api/v1/lost-posts",
        headers=oh,
        json={
            "pet_id": pet["id"],
            "lost_at": "2026-09-22T04:30:00Z",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "location_text": "Ratchada",
            "search_radius_km": 5,
            "reward_enabled": False,
        },
    )
    assert lost.status_code == 201, lost.text
    lost_id = lost.json()["data"]["id"]

    helper_notifications = client.get("/api/v1/notifications", headers=hh)
    assert helper_notifications.status_code == 200
    assert any(n["type"] == "lost_pet_alert" for n in helper_notifications.json()["data"])

    follow = client.post(f"/api/v1/lost-posts/{lost_id}/follow", headers=hh)
    assert follow.status_code == 201
    sighting = client.post(
        f"/api/v1/lost-posts/{lost_id}/sightings",
        headers=hh,
        json={"seen_at": "2026-09-22T05:00:00Z", "latitude": 13.757, "longitude": 100.502, "location_text": "Nearby road"},
    )
    assert sighting.status_code == 201, sighting.text
    assert sighting.json()["data"]["image_urls"] == []

    photos = [f"https://cdn.example.com/s{i}.jpg" for i in range(3)]
    with_photos = client.post(
        f"/api/v1/lost-posts/{lost_id}/sightings",
        headers=hh,
        json={"seen_at": "2026-09-22T06:00:00Z", "latitude": 13.757, "longitude": 100.502, "image_urls": photos},
    )
    assert with_photos.status_code == 201, with_photos.text
    assert with_photos.json()["data"]["image_urls"] == photos
    assert with_photos.json()["data"]["image_url"] == photos[0]
    too_many = client.post(
        f"/api/v1/lost-posts/{lost_id}/sightings",
        headers=hh,
        json={"seen_at": "2026-09-22T06:00:00Z", "latitude": 13.757, "longitude": 100.502, "image_urls": [*photos, photos[0]]},
    )
    assert too_many.status_code == 422

    found_alert = client.post(
        f"/api/v1/public/pets/qr/{pet['qr_token']}/found-alert",
        headers=hh,
        json={"latitude": 13.757, "longitude": 100.502, "location_text": "Nearby road"},
    )
    assert found_alert.status_code == 201, found_alert.text

    owner_notifications = client.get("/api/v1/notifications", headers=oh)
    types = {n["type"] for n in owner_notifications.json()["data"]}
    assert "new_sighting" in types
    assert "registered_pet_found" in types

    public = client.get(f"/api/v1/public/pets/qr/{pet['qr_token']}")
    assert public.status_code == 200
    assert public.json()["data"]["emergency"]["public_allergies"] == "Chicken"
    assert public.json()["data"]["emergency"]["emergency_contact_phone"] == "0800000000"


def test_upload_is_downscaled_and_reencoded(client):
    import io

    from PIL import Image

    auth = register(client, "uploader@example.com")
    buf = io.BytesIO()
    Image.linear_gradient("L").resize((3000, 2000)).convert("RGB").save(buf, "PNG")
    res = client.post(
        "/api/v1/uploads",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
        files={"file": ("big.png", buf.getvalue(), "image/png")},
    )
    assert res.status_code == 201, res.text
    filename = res.json()["data"]["filename"]
    assert filename.endswith(".jpg")
    got = client.get(f"/api/v1/uploads/files/{filename}")
    assert got.status_code == 200
    assert "immutable" in got.headers["cache-control"]
    with Image.open(io.BytesIO(got.content)) as img:
        assert max(img.size) == 1600
