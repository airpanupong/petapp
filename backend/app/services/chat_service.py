from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.community import Conversation, ConversationMember, Message
from app.models.moderation import UserBlock
from app.models.user import User


# A chat marker saying which post the conversation moved on to; content is "<type>:<reference_id>".
CONTEXT_MESSAGE = "context"


def add_context_message(db: Session, conversation: Conversation, sender_id: str) -> None:
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_id=sender_id,
            message_type=CONTEXT_MESSAGE,
            content=f"{conversation.type}:{conversation.reference_id}",
            read_at=datetime.now(timezone.utc),
        )
    )


def find_or_create_conversation(
    db: Session,
    *,
    current_user: User,
    other_user_id: str,
    conv_type: str = "lost_found",
    reference_id: str | None = None,
) -> Conversation:
    if other_user_id == current_user.id:
        raise AppError(400, "CHAT_SELF", "Cannot start a chat with yourself")

    blocked = db.scalar(
        select(UserBlock).where(
            or_(
                (UserBlock.blocker_id == current_user.id) & (UserBlock.blocked_id == other_user_id),
                (UserBlock.blocker_id == other_user_id) & (UserBlock.blocked_id == current_user.id),
            )
        )
    )
    if blocked:
        raise AppError(403, "USER_BLOCKED", "Chat is unavailable because one user blocked the other")

    other = db.get(User, other_user_id)
    if other is None:
        raise AppError(404, "USER_NOT_FOUND", "User not found")

    # One conversation per pair of people; a different post just adds a topic marker.
    my_ids = set(
        db.scalars(
            select(ConversationMember.conversation_id).where(ConversationMember.user_id == current_user.id)
        ).all()
    )
    other_ids = set(
        db.scalars(
            select(ConversationMember.conversation_id).where(ConversationMember.user_id == other_user_id)
        ).all()
    )
    shared = my_ids & other_ids
    if shared:
        existing = db.scalars(
            select(Conversation).where(Conversation.id.in_(shared)).order_by(Conversation.created_at.desc())
        ).first()
        if existing is not None:
            if reference_id and (existing.type, existing.reference_id) != (conv_type, reference_id):
                existing.type = conv_type
                existing.reference_id = reference_id
                add_context_message(db, existing, current_user.id)
                db.commit()
                db.refresh(existing)
            return existing

    conversation = Conversation(type=conv_type, reference_id=reference_id)
    db.add(conversation)
    db.flush()
    db.add_all(
        [
            ConversationMember(conversation_id=conversation.id, user_id=current_user.id),
            ConversationMember(conversation_id=conversation.id, user_id=other_user_id),
        ]
    )
    if reference_id:
        add_context_message(db, conversation, current_user.id)
    db.commit()
    db.refresh(conversation)
    return conversation
