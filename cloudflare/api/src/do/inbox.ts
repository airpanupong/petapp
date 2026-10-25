import {DurableObject} from 'cloudflare:workers';

type Attachment = {viewing: string | null};

// Someone who just loaded the thread, or has it open on the inbox socket, is looking at it and needs no alert.
const VIEWING_WINDOW_MS = 15_000;

/**
 * One instance per user: holds that user's inbox sockets (hibernatable) and which conversation each one shows.
 * The Worker authenticates the socket and passes the user id and starting unread count in headers.
 */
export class InboxDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get('x-user-id');
    if (!userId || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', {status: 426});
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [userId]);
    server.serializeAttachment({viewing: null} satisfies Attachment);
    await this.ctx.storage.put('user_id', userId);
    server.send(JSON.stringify({type: 'unread', unread_count: Number(request.headers.get('x-unread') ?? 0)}));
    return new Response(null, {status: 101, webSocket: client});
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return;
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return;
    }
    if (!body || typeof body !== 'object' || (body as {type?: unknown}).type !== 'view') return;
    let conversationId = (body as {conversation_id?: unknown}).conversation_id;
    if (typeof conversationId !== 'string' || !conversationId) conversationId = null;
    if (conversationId) {
      const userId = this.ctx.getTags(ws)[0];
      const member = await this.env.DB.prepare(
        'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      )
        .bind(conversationId, userId)
        .first();
      if (!member) conversationId = null;
    }
    ws.serializeAttachment({viewing: conversationId as string | null} satisfies Attachment);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  async webSocketError(): Promise<void> {}

  /** RPC: send an event to every open socket of this user. */
  async push(event: Record<string, unknown>): Promise<void> {
    const text = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // Socket went away; the runtime cleans it up.
      }
    }
  }

  /** RPC: is any socket showing the conversation, or was the thread loaded in the last few seconds? */
  async isViewing(conversationId: string): Promise<boolean> {
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Attachment | null)?.viewing === conversationId) return true;
    }
    const seen = await this.ctx.storage.get<number>(`viewed:${conversationId}`);
    return seen !== undefined && Date.now() - seen < VIEWING_WINDOW_MS;
  }

  /** RPC: the user just loaded the thread over HTTP. */
  async markViewed(conversationId: string): Promise<void> {
    await this.ctx.storage.put(`viewed:${conversationId}`, Date.now());
  }
}
