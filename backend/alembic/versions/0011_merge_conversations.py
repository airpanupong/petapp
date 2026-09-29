"""Merge duplicate 1:1 conversations into one per pair of users

Each former conversation's post becomes a "context" marker message so the merged
thread still shows which post each part of the chat was about.

Revision ID: 0011_merge_conversations
Revises: 0010_post_images
Create Date: 2026-09-29
"""

import uuid
from collections import defaultdict

from alembic import op
import sqlalchemy as sa

revision = "0011_merge_conversations"
down_revision = "0010_post_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    members: dict[str, set[str]] = defaultdict(set)
    for cid, uid in bind.execute(sa.text("SELECT conversation_id, user_id FROM conversation_members")):
        members[cid].add(uid)
    conversations = {
        row.id: row for row in bind.execute(sa.text("SELECT id, type, reference_id, created_at FROM conversations"))
    }

    pairs: dict[frozenset[str], list] = defaultdict(list)
    for cid, users in members.items():
        if len(users) == 2 and cid in conversations:
            pairs[frozenset(users)].append(conversations[cid])

    for users, items in pairs.items():
        items.sort(key=lambda c: c.created_at)
        sender = sorted(users)[0]
        previous_topic = None
        for c in items:
            topic = (c.type, c.reference_id)
            if not c.reference_id or topic == previous_topic:
                continue
            previous_topic = topic
            has_marker = bind.execute(
                sa.text("SELECT 1 FROM messages WHERE conversation_id = :c AND message_type = 'context' LIMIT 1"),
                {"c": c.id},
            ).first()
            if has_marker is None:
                bind.execute(
                    sa.text(
                        "INSERT INTO messages (id, conversation_id, sender_id, message_type, content, created_at, read_at) "
                        "VALUES (:id, :c, :s, 'context', :content, :at, :at)"
                    ),
                    {"id": str(uuid.uuid4()), "c": c.id, "s": sender, "content": f"{c.type}:{c.reference_id}", "at": c.created_at},
                )
        if len(items) < 2:
            continue

        def last_activity(c):
            at = bind.execute(
                sa.text("SELECT MAX(created_at) FROM messages WHERE conversation_id = :c AND message_type <> 'context'"),
                {"c": c.id},
            ).scalar()
            return at or c.created_at

        keep = max(items, key=last_activity)
        latest_topic = items[-1]
        for c in items:
            if c.id == keep.id:
                continue
            bind.execute(sa.text("UPDATE messages SET conversation_id = :k WHERE conversation_id = :c"), {"k": keep.id, "c": c.id})
            bind.execute(
                sa.text("UPDATE notifications SET reference_id = :k WHERE reference_type = 'conversation' AND reference_id = :c"),
                {"k": keep.id, "c": c.id},
            )
            bind.execute(sa.text("DELETE FROM conversation_members WHERE conversation_id = :c"), {"c": c.id})
            bind.execute(sa.text("DELETE FROM conversations WHERE id = :c"), {"c": c.id})
        bind.execute(
            sa.text("UPDATE conversations SET type = :t, reference_id = :r, created_at = :at WHERE id = :k"),
            {"t": latest_topic.type, "r": latest_topic.reference_id, "at": items[0].created_at, "k": keep.id},
        )


def downgrade() -> None:
    pass
