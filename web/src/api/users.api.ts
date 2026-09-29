import {api} from './client';
import {ApiSuccess, User} from '../types/api';
import {FoundPost, LostPost} from '../types/api';

export async function updateMe(payload: {
  display_name?: string;
  phone?: string;
  avatar_url?: string;
}) {
  const response = await api.patch<ApiSuccess<User>>('/users/me', payload);
  return response.data.data;
}

export async function getMyPosts() {
  const response = await api.get<ApiSuccess<{lost: LostPost[]; found: FoundPost[]}>>('/users/me/posts');
  return response.data.data;
}
