import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, deps, type AppEnv, type Ctx, type User} from '../app';
import {uuid, type Row} from '../lib/db';
import {AppError, success} from '../lib/errors';
import {isOlder, makeCursor, olderThan, parseCursor} from '../lib/pagination';
import {decodeToken} from '../lib/security';
import {messageRead} from '../lib/serialize';
import {now} from '../lib/time';
import {int, parseBody, parseQuery} from '../lib/validate';
import {
  CHAT_NOTIFICATION,
  CONTEXT_MESSAGE,
  chatUnread,
  conversationPayload,
  conversationPayloads,
  ensureMember,
  findOrCreateConversation,
  memberIds,
  notifyNewMessage,
  publishMessage,
  publishRead,
  referenceContexts,
} from '../services/chat';
import {connectInbox, markViewed} from '../services/realtime';

const ConversationCreate = z.object({
  member_user_id: z.string(),
  type: z.string().default('lost_found'),
  reference_id: z.string().nullish(),
});
const MessageCreate = z.object({
  message_type: z.string().default('text'),
  content: z.string().max(4000).nullish(),
  image_url: z.string().nullish(),
});
const PageQuery = (max: number) =>
  z.object({before: z.string().optional(), limit: int().pipe(z.number().min(1).max(max)).default(max)});

export const chat = new Hono<AppEnv>().basePath('/conversations');

/** Browsers only see close codes after the handshake; 4401 tells the client to refresh its token. */
function rejectSocket(c: Ctx): Response {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  const closed = new Promise<void>(resolve => {
    server.addEventListener('close', () => resolve());
    server.addEventListener('error', () => resolve());
    setTimeout(resolve, 5000);
  });
  c.executionCtx.waitUntil(closed);
  server.close(4401, 'unauthorized');
  return new Response(null, {status: 101, webSocket: client});
}

async function socketUser(env: Env, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const payload = await decodeToken(env.SECRET_KEY, token);
    return payload.type === 'access' && payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

chat.get('/inbox', async (c, next) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return next();
  const userId = await socketUser(c.env, c.req.query('token'));
  if (!userId) return rejectSocket(c);
  const headers = new Headers(c.req.raw.headers);
  headers.set('x-user-id', userId);
  headers.set('x-unread', String(await chatUnread(deps(c).db, userId)));
  return connectInbox(c.env, userId, new Request(c.req.raw, {headers}));
});

// Legacy per-conversation socket: text sent here becomes a chat message. Like the Python API it
// refuses bad tokens and non-members during the handshake (HTTP 403).
chat.get('/ws/:conversationId', async (c, next) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return next();
  const d = deps(c);
  const conversationId = c.req.param('conversationId');
  const userId = await socketUser(c.env, c.req.query('token'));
  if (!userId) return new Response(null, {status: 403});
  try {
    await ensureMember(d.db, conversationId, userId);
  } catch {
    return new Response(null, {status: 403});
  }
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.addEventListener('error', () => {});
  server.addEventListener('close', () => {
    try {
      server.close();
    } catch {
      // Already closed.
    }
  });
  server.addEventListener('message', event => {
    const handle = async () => {
      let content = '';
      try {
        content = String(JSON.parse(String(event.data))?.content ?? '').trim();
      } catch {
        return;
      }
      if (!content) return;
      const row: Row = {
        id: uuid(),
        conversation_id: conversationId,
        sender_id: userId,
        message_type: 'text',
        content,
        image_url: null,
        created_at: now(),
        read_at: null,
      };
      await d.db.insert('messages', row as Record<string, string | null>);
      const sender = await d.db.get<User>('users', userId);
      if (sender) await notifyNewMessage(d, conversationId, sender, row);
      const saved = messageRead(row);
      await publishMessage(d, conversationId, saved);
      try {
        server.send(JSON.stringify({type: 'message', data: saved}));
      } catch {
        // The client went away before the reply.
      }
    };
    d.waitUntil(handle());
  });
  return new Response(null, {status: 101, webSocket: client});
});

chat.get('/', async c => {
  const user = await currentUser(c);
  const q = parseQuery(c, PageQuery(100));
  const {db} = deps(c);
  const rows = await db.all<Row>(
    `SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id
     WHERE m.user_id = ? ORDER BY c.created_at DESC`,
    user.id,
  );
  const cursor = parseCursor(q.before);
  const keyed: [string, string, Record<string, unknown>][] = [];
  for (const item of await conversationPayloads(db, rows, user.id)) {
    const activity = String((item.last_message?.created_at as string | undefined) || item.created_at);
    if (isOlder(activity, String(item.id), cursor)) {
      keyed.push([activity, String(item.id), {...item, cursor: makeCursor(activity, String(item.id))}]);
    }
  }
  keyed.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0) : a[0] < b[0] ? 1 : -1));
  return c.json(success(keyed.slice(0, q.limit).map(k => k[2])));
});

chat.get('/unread-count', async c => {
  const user = await currentUser(c);
  return c.json(success({count: await chatUnread(deps(c).db, user.id)}));
});

chat.post('/', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, ConversationCreate);
  const d = deps(c);
  const conversation = await findOrCreateConversation(d, user, body.member_user_id, body.type, body.reference_id ?? null);
  return c.json(success(await conversationPayload(d.db, conversation, user.id)), 201);
});

chat.get('/:conversationId', async c => {
  const user = await currentUser(c);
  const {db} = deps(c);
  const conversation = await ensureMember(db, c.req.param('conversationId'), user.id);
  return c.json(success(await conversationPayload(db, conversation, user.id)));
});

chat.get('/:conversationId/messages', async c => {
  const user = await currentUser(c);
  const q = parseQuery(c, PageQuery(500));
  const d = deps(c);
  const conversationId = c.req.param('conversationId');
  await ensureMember(d.db, conversationId, user.id);
  // Opening the thread marks the other side's messages as read (drives the sender's double check).
  const readAt = now();
  const [marked] = await d.db.batch([
    d.db.stmt(
      'UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL',
      readAt,
      conversationId,
      user.id,
    ),
    d.db.stmt(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = ? AND reference_id = ? AND is_read = 0',
      user.id,
      CHAT_NOTIFICATION,
      conversationId,
    ),
  ]);
  markViewed(d, user.id, conversationId);
  if (marked.meta.changes) await publishRead(d, conversationId, user.id, readAt);

  const cursor = await olderThan(d.db, 'messages', 'created_at', q.before);
  const rows = (
    await d.db.all<Row>(
      `SELECT * FROM messages WHERE conversation_id = ? ${cursor ? `AND ${cursor.sql}` : ''}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      conversationId,
      ...(cursor?.params ?? []),
      q.limit,
    )
  ).reverse();
  const members = await memberIds(d.db, conversationId);
  const contextRows = rows.filter(r => r.message_type === CONTEXT_MESSAGE && r.content);
  const contexts = await referenceContexts(
    d.db,
    contextRows.map(r => {
      const content = String(r.content);
      const sep = content.indexOf(':');
      return {type: sep >= 0 ? content.slice(0, sep) : content, ref: sep >= 0 ? content.slice(sep + 1) : '', memberIds: members};
    }),
    user.id,
  );
  const contextById = new Map(contextRows.map((r, i) => [String(r.id), contexts[i]]));
  return c.json(
    success(
      rows.map(row => {
        const item = messageRead(row);
        if (contextById.has(String(row.id))) item.context = contextById.get(String(row.id)) ?? null;
        return item;
      }),
    ),
  );
});

chat.post('/:conversationId/messages', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, MessageCreate);
  const d = deps(c);
  const conversationId = c.req.param('conversationId');
  await ensureMember(d.db, conversationId, user.id);
  if (!body.content && !body.image_url) throw new AppError(422, 'MESSAGE_EMPTY', 'Message content or image is required');
  const row: Row = {
    id: uuid(),
    conversation_id: conversationId,
    sender_id: user.id,
    message_type: body.message_type,
    content: body.content ?? null,
    image_url: body.image_url ?? null,
    created_at: now(),
    read_at: null,
  };
  await d.db.insert('messages', row as Record<string, string | null>);
  await notifyNewMessage(d, conversationId, user, row);
  const saved = messageRead(row);
  await publishMessage(d, conversationId, saved);
  return c.json(success(saved), 201);
});
