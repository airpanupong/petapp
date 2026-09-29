from app.api.v1 import chat
from tests.test_api import register
from tests.test_super_admin import bearer

API = "/api/v1"


def test_message_marked_read_when_recipient_opens_thread(client):
    alice = register(client, "alice-chat@example.com")
    bob = register(client, "bob-chat@example.com")
    conv = client.post(f"{API}/conversations", headers=bearer(alice), json={"member_user_id": bob["user"]["id"]})
    assert conv.status_code == 201, conv.text
    conv_id = conv.json()["data"]["id"]

    sent = client.post(f"{API}/conversations/{conv_id}/messages", headers=bearer(alice), json={"content": "เจอน้องไหม"})
    assert sent.status_code == 201, sent.text
    assert sent.json()["data"]["read_at"] is None

    # The sender re-reading their own thread must not mark it read.
    [own] = client.get(f"{API}/conversations/{conv_id}/messages", headers=bearer(alice)).json()["data"]
    assert own["read_at"] is None

    [seen] = client.get(f"{API}/conversations/{conv_id}/messages", headers=bearer(bob)).json()["data"]
    assert seen["read_at"] is not None

    [after] = client.get(f"{API}/conversations/{conv_id}/messages", headers=bearer(alice)).json()["data"]
    assert after["read_at"] is not None


def _chat_notifications(client, auth):
    rows = client.get(f"{API}/notifications", headers=bearer(auth)).json()["data"]
    return [n for n in rows if n["type"] == "chat_message"]


def test_new_message_notifies_recipient_once_per_conversation(client):
    chat._last_viewed.clear()
    alice = register(client, "alice-notify@example.com")
    bob = register(client, "bob-notify@example.com")
    conv_id = client.post(
        f"{API}/conversations", headers=bearer(alice), json={"member_user_id": bob["user"]["id"]}
    ).json()["data"]["id"]
    send = lambda text: client.post(  # noqa: E731
        f"{API}/conversations/{conv_id}/messages", headers=bearer(alice), json={"content": text}
    )

    send("สวัสดี")
    send("เห็นน้องแถวอารีย์")
    [note] = _chat_notifications(client, bob)
    assert note["is_read"] is False and note["reference_id"] == conv_id
    assert note["body"] == "เห็นน้องแถวอารีย์"
    assert not _chat_notifications(client, alice)
    assert client.get(f"{API}/conversations/unread-count", headers=bearer(bob)).json()["data"]["count"] == 2
    listed = client.get(f"{API}/conversations", headers=bearer(bob)).json()["data"]
    assert listed[0]["unread_count"] == 2

    client.get(f"{API}/conversations/{conv_id}/messages", headers=bearer(bob))
    assert all(n["is_read"] for n in _chat_notifications(client, bob))
    assert client.get(f"{API}/conversations/unread-count", headers=bearer(bob)).json()["data"]["count"] == 0

    # Bob just opened the thread, so a reply while he is looking needs no alert.
    send("ตอนนี้อยู่ไหน")
    assert all(n["is_read"] for n in _chat_notifications(client, bob))

    chat._last_viewed.clear()
    send("ยังอยู่ไหม")
    assert [n["is_read"] for n in _chat_notifications(client, bob)].count(False) == 1


def test_user_can_delete_own_notifications(client):
    chat._last_viewed.clear()
    alice = register(client, "alice-delete@example.com")
    bob = register(client, "bob-delete@example.com")
    carol = register(client, "carol-delete@example.com")
    for sender in (alice, carol):
        conv_id = client.post(
            f"{API}/conversations", headers=bearer(sender), json={"member_user_id": bob["user"]["id"]}
        ).json()["data"]["id"]
        client.post(f"{API}/conversations/{conv_id}/messages", headers=bearer(sender), json={"content": "hi"})
    first, second = _chat_notifications(client, bob)

    assert client.delete(f"{API}/notifications/{first['id']}", headers=bearer(alice)).status_code == 204
    assert len(_chat_notifications(client, bob)) == 2

    assert client.delete(f"{API}/notifications/{first['id']}", headers=bearer(bob)).status_code == 204
    assert [n["id"] for n in _chat_notifications(client, bob)] == [second["id"]]

    assert client.delete(f"{API}/notifications", headers=bearer(bob)).json()["data"]["deleted"] == 1
    assert client.get(f"{API}/notifications", headers=bearer(bob)).json()["data"] == []
