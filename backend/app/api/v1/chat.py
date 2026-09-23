from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import SessionLocal, get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.core.security import decode_token
from app.models.community import Conversation, ConversationMember, Message
from app.models.user import User
from app.schemas.community import ConversationCreate, ConversationRead, MessageCreate, MessageRead
from app.services.chat_service import find_or_create_conversation

router = APIRouter(prefix="/conversations", tags=["chat"])


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
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    data = ConversationRead.model_validate(conversation).model_dump(mode="json")
    data["members"] = member_users
    data["other_member"] = next((u for u in member_users if u["id"] != current_user_id), None)
    data["last_message"] = MessageRead.model_validate(last).model_dump(mode="json") if last else None
    return data


@router.get("")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(ConversationMember.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
    ).all()
    return success([conversation_payload(db, x, current_user.id) for x in rows])


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_member(db, conversation_id, current_user.id)
    rows = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(500)
    ).all()
    return success([MessageRead.model_validate(x).model_dump(mode="json") for x in rows])


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
                db.commit()
                db.refresh(row)
                saved = MessageRead.model_validate(row).model_dump(mode="json")
            await manager.broadcast(conversation_id, {"type": "message", "data": saved})
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
