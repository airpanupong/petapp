import type {Deps, User} from '../app';
import {chunks, placeholders, uuid, type Db, type Row} from '../lib/db';
import {AppError} from '../lib/errors';
import {ADMIN, SUPER_ADMIN} from '../lib/roles';
import {conversationRead, messageRead} from '../lib/serialize';
import {now} from '../lib/time';
import {addNotification} from './notifications';
import {sendPushToUser} from './push';
import {isViewing, pushToUser} from './realtime';

// A chat marker saying which post the conversation moved on to; content is "<type>:<reference_id>".
export const CONTEXT_MESSAGE = 'context';
export const CHAT_NOTIFICATION = 'chat_message';

/** Runs `SELECT ... WHERE <column> IN (...)` over any number of ids. */
async function selectIn<T = Row>(db: Db, sql: (inList: string) => string, ids: string[], ...extra: string[]): Promise<T[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const results = await db.batch(chunks(unique).map(part => db.stmt(sql(placeholders(part.length)), ...part, ...extra)));
  return results.flatMap(r => r.results as T[]);
}

function contextMessage(db: Db, conversation: Row, senderId: string) {
  return db.insertStmt('messages', {
    id: uuid(),
    conversation_id: String(conversation.id),
    sender_id: senderId,
    message_type: CONTEXT_MESSAGE,
    content: `${conversation.type}:${conversation.reference_id}`,
    created_at: now(),
    read_at: now(),
  });
}

export async function findOrCreateConversation(
  deps: Deps,
  currentUser: User,
  otherUserId: string,
  convType = 'lost_found',
  referenceId: string | null = null,
): Promise<Row> {
  const {db} = deps;
  if (otherUserId === currentUser.id) throw new AppError(400, 'CHAT_SELF', 'Cannot start a chat with yourself');
  const blocked = await db.one(
    `SELECT id FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    currentUser.id,
    otherUserId,
    otherUserId,
    currentUser.id,
  );
  if (blocked) throw new AppError(403, 'USER_BLOCKED', 'Chat is unavailable because one user blocked the other');
  if (!(await db.get('users', otherUserId))) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  // One conversation per pair of people; a different post just adds a topic marker.
  const existing = await db.one<Row>(
    `SELECT c.* FROM conversations c
     WHERE c.id IN (SELECT conversation_id FROM conversation_members WHERE user_id = ?)
       AND c.id IN (SELECT conversation_id FROM conversation_members WHERE user_id = ?)
     ORDER BY c.created_at DESC LIMIT 1`,
    currentUser.id,
    otherUserId,
  );
  if (existing) {
    if (referenceId && (existing.type !== convType || existing.reference_id !== referenceId)) {
      existing.type = convType;
      existing.reference_id = referenceId;
      await db.batch([
        db.stmt('UPDATE conversations SET type = ?, reference_id = ? WHERE id = ?', convType, referenceId, String(existing.id)),
        contextMessage(db, existing, currentUser.id),
      ]);
    }
    return existing;
  }

  const conversation: Row = {id: uuid(), type: convType, reference_id: referenceId, created_at: now()};
  const statements = [
    db.insertStmt('conversations', conversation as Record<string, string | null>),
    db.insertStmt('conversation_members', {id: uuid(), conversation_id: String(conversation.id), user_id: currentUser.id, created_at: now()}),
    db.insertStmt('conversation_members', {id: uuid(), conversation_id: String(conversation.id), user_id: otherUserId, created_at: now()}),
  ];
  if (referenceId) statements.push(contextMessage(db, conversation, currentUser.id));
  await db.batch(statements);
  return conversation;
}

export async function ensureMember(db: Db, conversationId: string, userId: string): Promise<Row> {
  const conversation = await db.get('conversations', conversationId);
  if (!conversation) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
  const membership = await db.one(
    'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
    conversationId,
    userId,
  );
  if (!membership) throw new AppError(403, 'MESSAGE_FORBIDDEN', 'You are not a member of this conversation');
  return conversation;
}

// ---------- Post context shown above a chat ----------

type Ref = {type: string; ref: string | null; memberIds: string[]};

/** Resolves many (type, reference) pairs at once; results line up with `refs`. */
export async function referenceContexts(db: Db, refs: Ref[], currentUserId: string): Promise<(Row | null)[]> {
  const petRefs = refs.filter(r => r.ref && r.type === 'pet_contact').map(r => r.ref!);
  const postRefs = refs.filter(r => r.ref && r.type !== 'pet_contact').map(r => r.ref!);
  const [pets, losts, founds] = await Promise.all([
    selectIn(db, l => `SELECT id, name, animal_type, profile_image_url, owner_id FROM pets WHERE id IN (${l})`, petRefs),
    selectIn(
      db,
      l => `SELECT lp.id, lp.title, lp.status, lp.owner_id, lp.image_url, p.id AS pet_id, p.name AS pet_name,
                   p.animal_type AS pet_animal, p.profile_image_url AS pet_image
            FROM lost_posts lp LEFT JOIN pets p ON p.id = lp.pet_id WHERE lp.id IN (${l})`,
      postRefs,
    ),
    selectIn(db, l => `SELECT id, animal_type, image_url, status, reporter_id FROM found_posts WHERE id IN (${l})`, postRefs),
  ]);
  const petById = new Map(pets.map(p => [String(p.id), p]));
  const lostById = new Map(losts.map(p => [String(p.id), p]));
  const foundById = new Map(founds.map(p => [String(p.id), p]));
  const sightings = await selectIn<{lost_post_id: string; reporter_id: string | null}>(
    db,
    l => `SELECT DISTINCT lost_post_id, reporter_id FROM sightings WHERE lost_post_id IN (${l})`,
    [...lostById.keys()],
  );

  return refs.map(({type, ref, memberIds}) => {
    if (!ref) return null;
    if (type === 'pet_contact') {
      const pet = petById.get(ref);
      if (!pet) return null;
      return {
        kind: 'pet',
        post_id: null,
        pet_name: pet.name,
        animal_type: pet.animal_type,
        image_url: pet.profile_image_url ?? null,
        status: null,
        mine: pet.owner_id === currentUserId,
      };
    }
    const lost = lostById.get(ref);
    if (lost) {
      const others = new Set(memberIds.filter(id => id !== lost.owner_id));
      const tipped = sightings.some(s => s.lost_post_id === ref && s.reporter_id != null && others.has(s.reporter_id));
      const hasPet = lost.pet_id != null;
      return {
        kind: tipped ? 'sighting' : 'lost',
        post_id: lost.id,
        pet_name: hasPet ? lost.pet_name : lost.title,
        animal_type: hasPet ? lost.pet_animal : null,
        image_url: lost.image_url || (hasPet ? lost.pet_image ?? null : null),
        status: lost.status,
        mine: lost.owner_id === currentUserId,
      };
    }
    const found = foundById.get(ref);
    if (found) {
      return {
        kind: 'found',
        post_id: found.id,
        pet_name: null,
        animal_type: found.animal_type,
        image_url: found.image_url ?? null,
        status: found.status,
        mine: found.reporter_id === currentUserId,
      };
    }
    return null;
  });
}

// ---------- Conversation payloads ----------

export async function conversationPayloads(db: Db, conversations: Row[], currentUserId: string) {
  const ids = conversations.map(c => String(c.id));
  const [members, lasts, unread] = await Promise.all([
    selectIn(
      db,
      l => `SELECT cm.conversation_id, u.id, u.display_name, u.avatar_url, u.role
            FROM conversation_members cm JOIN users u ON u.id = cm.user_id
            WHERE cm.conversation_id IN (${l}) ORDER BY cm.created_at, cm.rowid`,
      ids,
    ),
    selectIn(
      db,
      l => `SELECT * FROM (
              SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.created_at DESC, m.id DESC) AS rn
              FROM messages m WHERE m.conversation_id IN (${l}) AND m.message_type != '${CONTEXT_MESSAGE}'
            ) WHERE rn = 1`,
      ids,
    ),
    selectIn<{conversation_id: string; n: number}>(
      db,
      l => `SELECT conversation_id, COUNT(*) AS n FROM messages
            WHERE conversation_id IN (${l}) AND sender_id != ? AND read_at IS NULL GROUP BY conversation_id`,
      ids,
      currentUserId,
    ),
  ]);
  const membersBy = new Map<string, Row[]>();
  for (const m of members) {
    const list = membersBy.get(String(m.conversation_id)) ?? [];
    list.push({id: m.id, display_name: m.display_name, avatar_url: m.avatar_url ?? null, role: m.role});
    membersBy.set(String(m.conversation_id), list);
  }
  const lastBy = new Map(lasts.map(m => [String(m.conversation_id), m]));
  const unreadBy = new Map(unread.map(u => [u.conversation_id, Number(u.n)]));
  const contexts = await referenceContexts(
    db,
    conversations.map(c => ({
      type: String(c.type),
      ref: (c.reference_id as string | null) ?? null,
      memberIds: (membersBy.get(String(c.id)) ?? []).map(m => String(m.id)),
    })),
    currentUserId,
  );
  return conversations.map((c, i) => {
    const memberUsers = membersBy.get(String(c.id)) ?? [];
    const last = lastBy.get(String(c.id));
    return {
      ...conversationRead(c),
      members: memberUsers,
      other_member: memberUsers.find(u => u.id !== currentUserId) ?? null,
      last_message: last ? messageRead(last) : null,
      context: contexts[i],
      unread_count: unreadBy.get(String(c.id)) ?? 0,
    };
  });
}

export async function conversationPayload(db: Db, conversation: Row, currentUserId: string) {
  return (await conversationPayloads(db, [conversation], currentUserId))[0];
}

// ---------- Unread counts and realtime ----------

const UNREAD_SQL = `SELECT COUNT(*) AS n FROM messages WHERE sender_id != ? AND read_at IS NULL
  AND conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = ?)`;

export async function chatUnread(db: Db, userId: string): Promise<number> {
  return db.count(UNREAD_SQL, userId, userId);
}

export async function memberIds(db: Db, conversationId: string): Promise<string[]> {
  return (
    await db.all<{user_id: string}>('SELECT user_id FROM conversation_members WHERE conversation_id = ?', conversationId)
  ).map(r => r.user_id);
}

async function unreadFor(db: Db, conversationId: string, users: string[]) {
  const stmts = users.flatMap(u => [
    db.stmt(UNREAD_SQL, u, u),
    db.stmt(
      'SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL',
      conversationId,
      u,
    ),
  ]);
  const results = await db.batch(stmts);
  const count = (i: number) => Number((results[i].results[0] as {n: number} | undefined)?.n ?? 0);
  return users.map((u, i) => ({user: u, total: count(i * 2), conversation: count(i * 2 + 1)}));
}

export async function publishMessage(deps: Deps, conversationId: string, message: Record<string, unknown>) {
  const users = await memberIds(deps.db, conversationId);
  for (const {user, total, conversation} of await unreadFor(deps.db, conversationId, users)) {
    pushToUser(deps, user, {
      type: 'message',
      conversation_id: conversationId,
      message,
      unread_count: total,
      conversation_unread: conversation,
    });
  }
}

export async function publishRead(deps: Deps, conversationId: string, readerId: string, readAt: string) {
  for (const user of await memberIds(deps.db, conversationId)) {
    if (user === readerId) {
      pushToUser(deps, user, {
        type: 'unread',
        unread_count: await chatUnread(deps.db, user),
        conversation_id: conversationId,
        conversation_unread: 0,
      });
      continue;
    }
    pushToUser(deps, user, {type: 'read', conversation_id: conversationId, reader_id: readerId, read_at: readAt});
  }
}

export async function notifyNewMessage(deps: Deps, conversationId: string, sender: User, message: Row) {
  const preview = String(message.content ?? '').trim();
  const chars = Array.from(preview);
  const body = chars.length > 120 ? chars.slice(0, 117).join('') + '...' : preview || 'ส่งรูปภาพ';
  const role = ({[ADMIN]: 'Admin', [SUPER_ADMIN]: 'Super Admin'} as Record<string, string>)[sender.role];
  const name = role ? `${sender.display_name} (${role})` : sender.display_name;
  const title = `${name} ส่งข้อความถึงคุณ`;
  const recipients = (await memberIds(deps.db, conversationId)).filter(id => id !== sender.id);
  for (const userId of recipients) {
    if (await isViewing(deps.env, userId, conversationId)) continue;
    try {
      // One unread notification per conversation; later messages refresh it instead of piling up.
      const existing = await deps.db.one<{id: string}>(
        'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND reference_id = ? AND is_read = 0 LIMIT 1',
        userId,
        CHAT_NOTIFICATION,
        conversationId,
      );
      if (!existing) {
        await addNotification(deps, userId, CHAT_NOTIFICATION, title, body, 'conversation', conversationId);
        continue;
      }
      await deps.db.run('UPDATE notifications SET title = ?, body = ?, created_at = ? WHERE id = ?', title, body, now(), existing.id);
      await sendPushToUser(deps, userId, title, body, {
        type: CHAT_NOTIFICATION,
        reference_type: 'conversation',
        reference_id: conversationId,
      });
    } catch (err) {
      console.error(JSON.stringify({msg: 'chat notification failed', userId, error: String(err)}));
    }
  }
}
