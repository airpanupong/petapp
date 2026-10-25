import {api} from './client';
import {ApiSuccess, FoundPost, LostPost, User} from '../types/api';

export async function createReport(payload: {
  target_type: 'lost_post' | 'found_post' | 'user' | 'message' | 'ad' | 'post';
  target_id: string;
  reason: 'spam' | 'fake_post' | 'fraud' | 'inappropriate' | 'animal_abuse' | 'harassment' | 'other';
  details?: string;
}) {
  const response = await api.post<ApiSuccess<unknown>>('/reports', payload);
  return response.data.data;
}

export async function blockUser(userId: string) {
  const response = await api.post<ApiSuccess<{blocked: boolean}>>(`/users/${userId}/block`);
  return response.data.data;
}

export async function unblockUser(userId: string) {
  await api.delete(`/users/${userId}/block`);
}

export type AdminMetrics = {
  users: number;
  lost_active: number;
  found_active: number;
  reports_open: number;
  ownership_pending: number;
  images_flagged?: number;
};

export type ImageFlag = {
  id: string;
  url: string | null;
  verdict: 'flagged' | 'rejected' | 'reviewed' | 'removed';
  reason: string | null;
  is_guest: boolean;
  uploader_id: string | null;
  created_at: string;
};

export async function listImageFlags() {
  const r = await api.get<ApiSuccess<ImageFlag[]>>('/admin/image-flags');
  return r.data.data;
}

export async function reviewImageFlag(id: string, action: 'approve' | 'remove') {
  const r = await api.post<ApiSuccess<ImageFlag>>(`/admin/image-flags/${id}/${action}`);
  return r.data.data;
}

export async function adminBlockGuestSender(postId: string) {
  const r = await api.post<ApiSuccess<{blocked: boolean; removed_posts: number}>>(`/admin/found-posts/${postId}/block-guest`);
  return r.data.data;
}

export type AdminReport = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details?: string | null;
  status: string;
  created_at: string;
};

export type OwnershipRow = {
  id: string;
  pet_id: string;
  owner_id: string;
  status: string;
  method: string;
  evidence_note?: string | null;
  submitted_at: string;
  reviewer_note?: string | null;
};

export async function getAdminMetrics() {
  const r = await api.get<ApiSuccess<AdminMetrics>>('/admin/metrics');
  return r.data.data;
}

export async function listAdminReports(status = 'open') {
  const r = await api.get<ApiSuccess<AdminReport[]>>('/admin/reports', {params: {status}});
  return r.data.data;
}

export async function resolveAdminReport(
  id: string,
  payload: {status: 'resolved' | 'dismissed' | 'action_taken'; resolver_note?: string},
) {
  const r = await api.post<ApiSuccess<AdminReport>>(`/admin/reports/${id}/resolve`, payload);
  return r.data.data;
}

export async function listAdminOwnership() {
  const r = await api.get<ApiSuccess<OwnershipRow[]>>('/admin/ownership-verifications');
  return r.data.data;
}

export async function reviewOwnership(
  id: string,
  payload: {status: 'verified' | 'rejected'; reviewer_note?: string},
) {
  const r = await api.post<ApiSuccess<OwnershipRow>>(`/admin/ownership-verifications/${id}/review`, payload);
  return r.data.data;
}

export type AdminPostStatus = 'active' | 'resolved' | 'cancelled' | 'closed' | 'hidden' | 'removed';

export type AdminPostPage<T> = {items: T[]; total: number; page: number; page_size: number};

export async function listAdminPosts<K extends 'lost' | 'found'>(params: {
  kind: K;
  status?: AdminPostStatus;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const r = await api.get<ApiSuccess<AdminPostPage<K extends 'lost' ? LostPost : FoundPost>>>('/admin/posts', {
    params: {kind: params.kind, status: params.status || undefined, q: params.q || undefined, page: params.page, page_size: params.pageSize},
  });
  return r.data.data;
}

export async function adminSetPostStatus(kind: 'lost' | 'found', id: string, status: AdminPostStatus) {
  const r = await api.post<ApiSuccess<LostPost | FoundPost>>(`/admin/${kind}-posts/${id}/status`, {status});
  return r.data.data;
}

export type AdminUserPage = {items: User[]; total: number; page: number; page_size: number};

export async function listAdminUsers(params: {q?: string; page: number; pageSize: number}) {
  const r = await api.get<ApiSuccess<AdminUserPage>>('/admin/users', {
    params: {q: params.q || undefined, page: params.page, page_size: params.pageSize},
  });
  return r.data.data;
}

export async function adminSetUserBlocked(id: string, blocked: boolean) {
  const r = await api.post<ApiSuccess<User>>(`/admin/users/${id}/${blocked ? 'block' : 'unblock'}`);
  return r.data.data;
}

export type AdminIntakePrivate = {
  private_owner_name: string;
  private_phone: string;
  private_link?: string;
  private_note?: string;
};

export async function adminCreateLostPost(
  payload: AdminIntakePrivate & {
    name: string;
    animal_type: 'dog' | 'cat' | 'other';
    breed?: string;
    gender?: string;
    color?: string;
    distinctive_marks?: string;
    lost_at: string;
    latitude: number;
    longitude: number;
    location_text?: string;
    search_radius_km: number;
    description?: string;
    reward_enabled: boolean;
    reward_text?: string;
    image_urls: string[];
  },
) {
  const r = await api.post<ApiSuccess<LostPost>>('/admin/intake/lost', payload);
  return r.data.data;
}

export async function adminCreateFoundPost(
  payload: AdminIntakePrivate & {
    animal_type: 'dog' | 'cat' | 'other';
    breed_guess?: string;
    color?: string;
    description?: string;
    found_at: string;
    latitude: number;
    longitude: number;
    location_text?: string;
    image_urls: string[];
  },
) {
  const r = await api.post<ApiSuccess<FoundPost>>('/admin/intake/found', payload);
  return r.data.data;
}

export async function adminSetUserRole(id: string, role: 'user' | 'admin') {
  const r = await api.post<ApiSuccess<User>>(`/admin/users/${id}/role`, {role});
  return r.data.data;
}