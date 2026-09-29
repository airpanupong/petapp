from app.api.v1 import chat
from tests.test_lost_checkin import auth_headers

API = "/api/v1"


def lost_post(client, headers, name, day, breed=None, color=None, animal="cat"):
    pet = client.post(
        f"{API}/pets", headers=headers, json={"name": name, "animal_type": animal, "gender": "female", "breed": breed, "color": color}
    ).json()["data"]
    res = client.post(
        f"{API}/lost-posts",
        headers=headers,
        json={"pet_id": pet["id"], "lost_at": f"2026-09-{day:02d}T04:30:00Z", "latitude": 13.7, "longitude": 100.5},
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


def found_post(client, headers, day, **extra):
    res = client.post(
        f"{API}/found-posts",
        headers=headers,
        json={"animal_type": "cat", "found_at": f"2026-09-{day:02d}T04:30:00Z", "latitude": 13.7, "longitude": 100.5, **extra},
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


def all_pages(fetch):
    items, cursor = [], None
    while True:
        page = fetch(cursor)
        items += page["items"]
        cursor = page["next_cursor"]
        if not cursor:
            return items


def test_feed_pages_newest_first_and_skips_own_posts(client):
    owner = auth_headers(client, "feed-owner@example.com")
    viewer = auth_headers(client, "feed-viewer@example.com")
    for day in range(1, 6):
        lost_post(client, owner, f"Cat{day}", day)
    found_post(client, owner, 10)
    lost_post(client, viewer, "Mine", 20)

    fetch = lambda cursor: client.get(  # noqa: E731
        f"{API}/feed", headers=viewer, params={"limit": 2, **({"cursor": cursor} if cursor else {})}
    ).json()["data"]
    first = fetch(None)
    assert first["counts"] == {"lost": 6, "found": 1}
    items = all_pages(fetch)
    assert [(i["kind"], i["post"].get("pet", {}).get("name")) for i in items] == [
        ("found", None), ("lost", "Cat5"), ("lost", "Cat4"), ("lost", "Cat3"), ("lost", "Cat2"), ("lost", "Cat1"),
    ]

    anonymous = client.get(f"{API}/feed", params={"kind": "lost", "limit": 50}).json()["data"]["items"]
    assert [i["post"]["pet"]["name"] for i in anonymous][0] == "Mine"


def test_feed_filters_breed_and_color_including_typed_values(client):
    owner = auth_headers(client, "feed-filter@example.com")
    lost_post(client, owner, "Air", 1, breed="แมนคูน", color="ดำ")
    lost_post(client, owner, "Pixel", 2, breed="เมนคูน", color="สีขาวปลอด")
    lost_post(client, owner, "Odd", 3, breed="แมวลายหินอ่อน", color="ดำแต้มขาว")
    found_post(client, owner, 4, breed_guess="Maine Coon", color="black")

    def names(**params):
        items = client.get(f"{API}/feed", params={"animal_type": "cat", **params}).json()["data"]["items"]
        return sorted(i["post"]["pet"]["name"] if i["kind"] == "lost" else "found" for i in items)

    assert names(breed="maine_coon") == ["Air", "Pixel", "found"]
    assert names(color="black") == ["Air", "found"]
    assert names(breed="maine_coon", color="white") == ["Pixel"]
    assert names(breed="other") == ["Odd"]
    assert names(color="other") == ["Odd"]


def test_notifications_page_with_cursor(client):
    chat._last_viewed.clear()
    me = auth_headers(client, "notif-pages@example.com")
    senders = [auth_headers(client, f"notif-sender{i}@example.com") for i in range(5)]
    me_id = client.get(f"{API}/users/me", headers=me).json()["data"]["id"]
    for i, sender in enumerate(senders):
        conv = client.post(f"{API}/conversations", headers=sender, json={"member_user_id": me_id}).json()["data"]
        client.post(f"{API}/conversations/{conv['id']}/messages", headers=sender, json={"content": f"hi {i}"})

    seen, before = [], None
    while True:
        params = {"limit": 2, **({"before": before} if before else {})}
        page = client.get(f"{API}/notifications", headers=me, params=params).json()["data"]
        seen += [n["body"] for n in page]
        if len(page) < 2:
            break
        before = f"{page[-1]['created_at']}|{page[-1]['id']}"
    assert seen == ["hi 4", "hi 3", "hi 2", "hi 1", "hi 0"]
    assert client.get(f"{API}/notifications/unread-count", headers=me).json()["data"]["count"] == 0

    chats = client.get(f"{API}/conversations", headers=me, params={"limit": 3}).json()["data"]
    assert [c["last_message"]["content"] for c in chats] == ["hi 4", "hi 3", "hi 2"]
    rest = client.get(f"{API}/conversations", headers=me, params={"limit": 3, "before": chats[-1]["cursor"]}).json()["data"]
    assert [c["last_message"]["content"] for c in rest] == ["hi 1", "hi 0"]


def test_messages_load_latest_first_then_older(client):
    alice = auth_headers(client, "msg-alice@example.com")
    bob = auth_headers(client, "msg-bob@example.com")
    bob_id = client.get(f"{API}/users/me", headers=bob).json()["data"]["id"]
    conv_id = client.post(f"{API}/conversations", headers=alice, json={"member_user_id": bob_id}).json()["data"]["id"]
    for i in range(7):
        client.post(f"{API}/conversations/{conv_id}/messages", headers=alice, json={"content": str(i)})

    url = f"{API}/conversations/{conv_id}/messages"
    latest = client.get(url, headers=bob, params={"limit": 3}).json()["data"]
    assert [m["content"] for m in latest] == ["4", "5", "6"]
    older = client.get(url, headers=bob, params={"limit": 3, "before": f"{latest[0]['created_at']}|{latest[0]['id']}"}).json()["data"]
    assert [m["content"] for m in older] == ["1", "2", "3"]
    assert [m["content"] for m in client.get(url, headers=bob).json()["data"]] == [str(i) for i in range(7)]
