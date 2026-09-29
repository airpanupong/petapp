from __future__ import annotations

import logging
import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import SessionLocal, get_db
from app.core.exceptions import AppError
from app.core.pagination import is_older, make_cursor, older_than, parse_cursor
from app.core.responses import success
from app.core.security import decode_token
from app.models.community import Conversation, ConversationMember, Message
from app.models.features import AppNotification
from app.models.lost_found import FoundPost, LostPost, Sighting
from app.models.pet import Pet
from app.models.user import User
from app.schemas.community import ConversationCreate, ConversationRead, MessageCreate, MessageRead
from app.services.chat_service import CONTEXT_MESSAGE, find_or_create_conversation
from app.services.notification_service import add_notification
from app.services.push_service import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["chat"])

CHAT_NOTIFICATION = "chat_message"
# The thread page polls every 5s; someone who polled this recently is looking at it and needs no alert.
VIEWING_WINDOW_SECONDS = 15
_last_viewed: dict[tuple[str, str], float] = {}


def _is_viewing(conversation_id: str, user_id: str) -> bool:
    seen = _last_viewed.get((conversation_id, user_id))
    return seen is not None and time.monotonic() - seen < VIEWING_WINDOW_SECONDS


def notify_new_message(db: Session, conversation_id: str, sender: User, message: Message) -> None:
    preview = (message.content or "").strip()
    body = (preview[:117] + "...") if len(preview) > 120 else preview or "ส่งรูปภาพ"
    title = f"{sender.display_name} ส่งข้อความถึงคุณ"
    recipients = db.scalars(
        select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id != sender.id,
        )
    ).all()
    for user_id in recipients:
        if _is_viewing(conversation_id, user_id):
            continue
        try:
            # One unread notification per conversation; later messages refresh it instead of piling up.
            existing = db.scalar(
                select(AppNotification).where(
                    AppNotification.user_id == user_id,
                    AppNotification.type == CHAT_NOTIFICATION,
                    AppNotification.reference_id == conversation_id,
                    AppNotification.is_read.is_(False),
                )
            )
            if existing is None:
                add_notification(db, user_id, CHAT_NOTIFICATION, title, body, "conversation", conversation_id)
                continue
            existing.title = title
            existing.body = body
            existing.created_at = datetime.now(timezone.utc)
            db.flush()
            send_push_to_user(
                db,
                user_id,
                title,
                body,
                {"type": CHAT_NOTIFICATION, "reference_type": "conversation", "reference_id": conversation_id},
            )
        except Exception:  # noqa: BLE001
            logger.exception("Chat notification failed for user %s", user_id)


def ensure_member(db: Session, conversation_id: str, user_id: str) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found")
    membership = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    if membership is None:
        raise AppError(403, "MESSAGE_FORBIDDEN", "You are not a member of this conversation")
    return conversation


def _unread_filter(user_id: str):
    return (
        Message.sender_id != user_id,
        Message.read_at.is_(None),
        Message.conversation_id.in_(
            select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_id)
        ),
    )


def conversation_context(db: Session, conversation: Conversation, current_user_id: str, member_ids: list[str]) -> dict | None:
    return reference_context(db, conversation.type, conversation.reference_id, current_user_id, member_ids)


def reference_context(db: Session, conv_type: str, ref: str | None, current_user_id: str, member_ids: list[str]) -> dict | None:
    if not ref:
        return None
    if conv_type == "pet_contact":
        pet = db.get(Pet, ref)
        if pet is None:
            return None
        return {
            "kind": "pet",
            "post_id": None,
            "pet_name": pet.name,
            "animal_type": pet.animal_type,
            "image_url": pet.profile_image_url,
            "status": None,
            "mine": pet.owner_id == current_user_id,
        }
    lost = db.get(LostPost, ref)
    if lost is not None:
        others = [uid for uid in member_ids if uid != lost.owner_id]
        tipped = bool(others) and db.scalar(
            select(Sighting.id).where(Sighting.lost_post_id == lost.id, Sighting.reporter_id.in_(others)).limit(1)
        ) is not None
        pet = lost.pet
        return {
            "kind": "sighting" if tipped else "lost",
            "post_id": lost.id,
            "pet_name": pet.name if pet else lost.title,
            "animal_type": pet.animal_type if pet else None,
            "image_url": lost.image_url or (pet.profile_image_url if pet else None),
            "status": lost.status,
            "mine": lost.owner_id == current_user_id,
        }
    found = db.get(FoundPost, ref)
    if found is not None:
        return {
            "kind": "found",
            "post_id": found.id,
            "pet_name": None,
            "animal_type": found.animal_type,
            "image_url": found.image_url,
            "status": found.status,
            "mine": found.reporter_id == current_user_id,
        }
    return None


def conversation_payload(db: Session, conversation: Conversation, current_user_id: str) -> dict:
    members = db.scalars(
        select(ConversationMember).where(ConversationMember.conversation_id == conversation.id)
    ).all()
    member_users = []
    for m in members:
        user = db.get(User, m.user_id)
        if user:
            member_users.append(
                {
                    "id": user.id,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                }
            )
    last = db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation.id, Message.message_type != CONTEXT_MESSAGE)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    data = ConversationRead.model_validate(conversation).model_dump(mode="json")
    data["members"] = member_users
    data["other_member"] = next((u for u in member_users if u["id"] != current_user_id), None)
    data["last_message"] = MessageRead.model_validate(last).model_dump(mode="json") if last else None
    data["context"] = conversation_context(db, conversation, current_user_id, [m.user_id for m in members])
    data["unread_count"] = db.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id == conversation.id,
            Message.sender_id != current_user_id,
            Message.read_at.is_(None),
        )
    ) or 0
    return data


@router.get("")
def list_conversations(
    before: str | None = None,
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(ConversationMember.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
    ).all()
    cursor = parse_cursor(before)
    keyed = []
    for conversation in rows:
        item = conversation_payload(db, conversation, current_user.id)
        activity = datetime.fromisoformat((item["last_message"] or {}).get("created_at") or item["created_at"])
        if is_older(activity, item["id"], cursor):
            item["cursor"] = make_cursor(activity, item["id"])
            keyed.append((activity.astimezone(timezone.utc) if activity.tzinfo else activity.replace(tzinfo=timezone.utc), item["id"], item))
    keyed.sort(key=lambda k: (k[0], k[1]), reverse=True)
    return success([item for _, _, item in keyed[:limit]])


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.scalar(select(func.count(Message.id)).where(*_unread_filter(current_user.id))) or 0
    return success({"count": count})


@router.post("", status_code=201)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = find_or_create_conversation(
        db,
        current_user=current_user,
        other_user_id=payload.member_user_id,
        conv_type=payload.type,
        reference_id=payload.reference_id,
    )
    return success(conversation_payload(db, conversation, current_user.id))


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = ensure_member(db, conversation_id, current_user.id)
    return success(conversation_payload(db, conversation, current_user.id))


@router.get("/{conversation_id}/messages")
def list_messages(
    conversation_id: str,
    before: str | None = None,
    limit: int = Query(500, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_member(db, conversation_id, current_user.id)
    # Opening the thread marks the other side's messages as read (drives the sender's double check).
    marked = db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    _last_viewed[(conversation_id, current_user.id)] = time.monotonic()
    cleared = db.execute(
        update(AppNotification)
        .where(
            AppNotification.user_id == current_user.id,
            AppNotification.type == CHAT_NOTIFICATION,
            AppNotification.reference_id == conversation_id,
            AppNotification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    if marked.rowcount or cleared.rowcount:
        db.commit()
    stmt = select(Message).where(Message.conversation_id == conversation_id)
    cursor = older_than(db, Message, Message.created_at, before)
    if cursor is not None:
        stmt = stmt.where(cursor)
    # Latest `limit` messages before the cursor, returned oldest first.
    rows = list(reversed(db.scalars(stmt.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)).all()))
    member_ids = list(
        db.scalars(select(ConversationMember.user_id).where(ConversationMember.conversation_id == conversation_id)).all()
    )
    items = []
    for row in rows:
        item = MessageRead.model_validate(row).model_dump(mode="json")
        if row.message_type == CONTEXT_MESSAGE and row.content:
            conv_type, _, ref = row.content.partition(":")
            item["context"] = reference_context(db, conv_type, ref, current_user.id, member_ids)
        items.append(item)
    return success(items)


@router.post("/{conversation_id}/messages", status_code=201)
def send_message(
    conversation_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_member(db, conversation_id, current_user.id)
    if not payload.content and not payload.image_url:
        raise AppError(422, "MESSAGE_EMPTY", "Message content or image is required")
    row = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(row)
    db.flush()
    notify_new_message(db, conversation_id, current_user, row)
    db.commit()
    db.refresh(row)
    return success(MessageRead.model_validate(row).model_dump(mode="json"))


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms[room].add(websocket)

    def disconnect(self, room: str, websocket: WebSocket):
        self.rooms[room].discard(websocket)
        if not self.rooms[room]:
            self.rooms.pop(room, None)

    async def broadcast(self, room: str, payload: dict):
        dead = []
        for socket in self.rooms.get(room, set()):
            try:
                await socket.send_json(payload)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self.disconnect(room, socket)


manager = ConnectionManager()


@router.websocket("/ws/{conversation_id}")
async def chat_ws(websocket: WebSocket, conversation_id: str, token: str):
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=4401)
            return
        user_id = payload.get("sub")
        with SessionLocal() as db:
            ensure_member(db, conversation_id, user_id)
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(conversation_id, websocket)
    try:
        while True:
            body = await websocket.receive_json()
            content = (body.get("content") or "").strip()
            if not content:
                continue
            with SessionLocal() as db:
                row = Message(
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    message_type="text",
                    content=content,
                )
                db.add(row)
                db.flush()
                sender = db.get(User, user_id)
                if sender is not None:
                    notify_new_message(db, conversation_id, sender, row)
                db.commit()
                db.refresh(row)
                saved = MessageRead.model_validate(row).model_dump(mode="json")
            await manager.broadcast(conversation_id, {"type": "message", "data": saved})
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
