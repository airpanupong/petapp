import {InfiniteData, QueryClient} from '@tanstack/react-query';

import {ChatMessage, Conversation} from '../api/chat.api';
import {refreshSession} from '../api/client';
import {API_BASE_URL} from './config';
import {loadSession} from './session';

type InboxEvent =
  | {type: 'message'; conversation_id: string; message: ChatMessage; unread_count: number; conversation_unread: number}
  | {type: 'unread'; unread_count: number; conversation_id?: string; conversation_unread?: number}
  | {type: 'read'; conversation_id: string; reader_id: string; read_at: string}
  | {type: 'notifications'};

let socket: WebSocket | null = null;
let viewing: string | null = null;

function sendViewing() {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type: 'view', conversation_id: viewing}));
}

/** Tells the server which thread is open, so it skips alerts for it. */
export function setViewingConversation(id: string | null) {
  viewing = id;
  sendViewing();
}

function appendMessage(qc: QueryClient, conversationId: string, message: ChatMessage) {
  qc.setQueryData<InfiniteData<ChatMessage[]>>(['messages', conversationId], current => {
    if (!current?.pages.length) return current;
    const pages = current.pages.map(page => page.filter(row => row.id !== message.id));
    pages[0] = [...pages[0], message];
    return {...current, pages};
  });
}

function markConversationRead(qc: QueryClient, conversationId: string, readerId: string, readAt: string) {
  qc.setQueryData<InfiniteData<ChatMessage[]>>(['messages', conversationId], current => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map(page =>
        page.map(row => (row.sender_id !== readerId && !row.read_at ? {...row, read_at: readAt} : row)),
      ),
    };
  });
}

function patchConversation(qc: QueryClient, conversationId: string, patch: Partial<Conversation>, message?: ChatMessage) {
  const current = qc.getQueryData<InfiniteData<Conversation[]>>(['conversations']);
  if (!current?.pages.length) return;
  const existing = current.pages.flat().find(row => row.id === conversationId);
  if (!existing) {
    void qc.invalidateQueries({queryKey: ['conversations']});
    return;
  }
  const next = {...existing, ...patch, last_message: message ?? existing.last_message};
  const pages = current.pages.map(page => page.filter(row => row.id !== conversationId));
  if (message) pages[0] = [next, ...pages[0]];
  else {
    const at = current.pages.findIndex(page => page.some(row => row.id === conversationId));
    pages[at] = current.pages[at].map(row => (row.id === conversationId ? next : row));
  }
  qc.setQueryData<InfiniteData<Conversation[]>>(['conversations'], {...current, pages});
}

function applyInboxEvent(qc: QueryClient, event: InboxEvent) {
  switch (event.type) {
    case 'message':
      qc.setQueryData(['chat-unread'], event.unread_count);
      appendMessage(qc, event.conversation_id, event.message);
      patchConversation(qc, event.conversation_id, {unread_count: event.conversation_unread}, event.message);
      // Refetching the open thread marks the new message read and sends the read receipt.
      if (event.conversation_id === viewing && event.conversation_unread > 0) {
        void qc.invalidateQueries({queryKey: ['messages', event.conversation_id]});
      }
      return;
    case 'unread':
      qc.setQueryData(['chat-unread'], event.unread_count);
      if (event.conversation_id && event.conversation_unread != null) {
        patchConversation(qc, event.conversation_id, {unread_count: event.conversation_unread});
      }
      return;
    case 'read':
      markConversationRead(qc, event.conversation_id, event.reader_id, event.read_at);
      return;
    case 'notifications':
      void qc.invalidateQueries({queryKey: ['notifications']});
  }
}

/** Live chat/notification badges, threads and read receipts over one socket instead of polling. */
export function startChatInbox(qc: QueryClient) {
  let closed = false;
  let connectedBefore = false;
  let retryMs = 1000;
  let retryTimer = 0;
  let pingTimer = 0;

  const scheduleRetry = () => {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => void connect(), retryMs);
    retryMs = Math.min(retryMs * 2, 30_000);
  };

  const connect = async () => {
    if (closed) return;
    const session = await loadSession();
    if (!session?.accessToken || closed) return;
    const url = `${API_BASE_URL.replace(/^http/, 'ws')}/conversations/inbox?token=${encodeURIComponent(session.accessToken)}`;
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      retryMs = 1000;
      sendViewing();
      // Events sent while we were offline are lost; catch up once.
      if (connectedBefore) {
        void qc.invalidateQueries({queryKey: ['conversations']});
        void qc.invalidateQueries({queryKey: ['notifications']});
        if (viewing) void qc.invalidateQueries({queryKey: ['messages', viewing]});
      }
      connectedBefore = true;
      window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, 25_000);
    };
    ws.onmessage = e => {
      if (e.data === 'pong') return;
      try {
        applyInboxEvent(qc, JSON.parse(String(e.data)) as InboxEvent);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = e => {
      window.clearInterval(pingTimer);
      if (closed || socket !== ws) return;
      socket = null;
      if (e.code !== 4401) {
        scheduleRetry();
        return;
      }
      void refreshSession().then(token => {
        if (token && !closed) scheduleRetry();
      });
    };
  };

  const onVisible = () => {
    if (document.visibilityState !== 'visible' || closed) return;
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      retryMs = 1000;
      void connect();
    }
  };

  document.addEventListener('visibilitychange', onVisible);
  void connect();

  return () => {
    closed = true;
    window.clearTimeout(retryTimer);
    window.clearInterval(pingTimer);
    document.removeEventListener('visibilitychange', onVisible);
    const ws = socket;
    socket = null;
    ws?.close();
  };
}
