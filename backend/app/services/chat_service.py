from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.community import Conversation, ConversationMember
from app.models.moderation import UserBlock
from app.models.user import User


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

    # Reuse existing 1:1 conversation with same type + reference when possible
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
        stmt = select(Conversation).where(Conversation.id.in_(shared), Conversation.type == conv_type)
        if reference_id:
            stmt = stmt.where(Conversation.reference_id == reference_id)
        existing = db.scalars(stmt.order_by(Conversation.created_at.desc())).first()
        if existing is not None:
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
    db.commit()
    db.refresh(conversation)
    return conversation
