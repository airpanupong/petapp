import {api} from './client';
import {ApiSuccess} from '../types/api';

export type Conversation = {
  id: string;
  type: string;
  reference_id?: string | null;
  created_at: string;
  members?: {id: string; display_name: string; avatar_url?: string | null}[];
  other_member?: {id: string; display_name: string; avatar_url?: string | null} | null;
  last_message?: ChatMessage | null;
  unread_count?: number;
  context?: ConversationContext | null;
  cursor?: string;
};

export type ConversationContext = {
  kind: 'sighting' | 'lost' | 'found' | 'pet';
  post_id?: string | null;
  pet_name?: string | null;
  animal_type?: 'dog' | 'cat' | 'other' | null;
  image_url?: string | null;
  status?: string | null;
  mine: boolean;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: string;
  content?: string | null;
  image_url?: string | null;
  created_at: string;
  read_at?: string | null;
  context?: ConversationContext | null;
};

export async function listConversations(params: {before?: string; limit?: number} = {}) {
  const response = await api.get<ApiSuccess<Conversation[]>>('/conversations', {params});
  return response.data.data;
}

export async function createConversation(payload: {
  member_user_id: string;
  type?: string;
  reference_id?: string;
}) {
  const response = await api.post<ApiSuccess<Conversation>>('/conversations', payload);
  return response.data.data;
}

export async function getConversation(id: string) {
  const response = await api.get<ApiSuccess<Conversation>>(`/conversations/${id}`);
  return response.data.data;
}

export async function getUnreadChatCount() {
  const response = await api.get<ApiSuccess<{count: number}>>('/conversations/unread-count');
  return response.data.data.count;
}

/** Latest `limit` messages before the cursor, oldest first. */
export async function listMessages(conversationId: string, params: {before?: string; limit?: number} = {}) {
  const response = await api.get<ApiSuccess<ChatMessage[]>>(`/conversations/${conversationId}/messages`, {params});
  return response.data.data;
}

export async function sendMessage(
  conversationId: string,
  payload: {content?: string; image_url?: string; message_type?: string},
) {
  const response = await api.post<ApiSuccess<ChatMessage>>(
    `/conversations/${conversationId}/messages`,
    {message_type: 'text', ...payload},
  );
  return response.data.data;
}

export async function contactLostOwner(postId: string) {
  const response = await api.post<ApiSuccess<Conversation>>(`/lost-posts/${postId}/contact`);
  return response.data.data;
}

export async function contactFoundReporter(postId: string) {
  const response = await api.post<ApiSuccess<Conversation>>(`/found-posts/${postId}/contact`);
  return response.data.data;
}

export async function contactPetOwner(qrToken: string) {
  const response = await api.post<ApiSuccess<Conversation>>(`/public/pets/qr/${qrToken}/contact`);
  return response.data.data;
}
