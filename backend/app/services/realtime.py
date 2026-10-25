from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket
from sqlalchemy import event
from sqlalchemy.orm import Session

PENDING_NOTIFY_KEY = "realtime_notify_users"


class Inbox:
    """One socket per signed-in tab, so badges and threads update without polling."""

    def __init__(self) -> None:
        self.users: dict[str, set[WebSocket]] = defaultdict(set)
        self.viewing: dict[WebSocket, str] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.users[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        self.viewing.pop(websocket, None)
        sockets = self.users.get(user_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            self.users.pop(user_id, None)

    def set_viewing(self, websocket: WebSocket, conversation_id: str | None) -> None:
        if conversation_id:
            self.viewing[websocket] = conversation_id
        else:
            self.viewing.pop(websocket, None)

    def is_viewing(self, user_id: str, conversation_id: str) -> bool:
        return any(self.viewing.get(socket) == conversation_id for socket in self.users.get(user_id, ()))

    async def send_user(self, user_id: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for socket in list(self.users.get(user_id, ())):
            try:
                await socket.send_json(payload)
            except Exception:  # noqa: BLE001
                dead.append(socket)
        for socket in dead:
            self.disconnect(user_id, socket)

    def push(self, user_id: str, payload: dict) -> None:
        """Thread-safe: sync request handlers run off the event loop."""
        loop = self.loop
        if loop is None or loop.is_closed() or user_id not in self.users:
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            loop.create_task(self.send_user(user_id, payload))
        else:
            asyncio.run_coroutine_threadsafe(self.send_user(user_id, payload), loop)


inbox = Inbox()


def queue_notification_ping(db: Session, user_id: str) -> None:
    db.info.setdefault(PENDING_NOTIFY_KEY, set()).add(user_id)


@event.listens_for(Session, "after_commit")
def _flush_notification_pings(session: Session) -> None:
    users = session.info.pop(PENDING_NOTIFY_KEY, None)
    for user_id in users or ():
        inbox.push(user_id, {"type": "notifications"})


@event.listens_for(Session, "after_rollback")
def _drop_notification_pings(session: Session) -> None:
    session.info.pop(PENDING_NOTIFY_KEY, None)
