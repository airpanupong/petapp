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
};

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

export async function listAdminLostPosts() {
  const r = await api.get<ApiSuccess<LostPost[]>>('/admin/lost-posts');
  return r.data.data;
}

export async function listAdminFoundPosts() {
  const r = await api.get<ApiSuccess<FoundPost[]>>('/admin/found-posts');
  return r.data.data;
}

export async function adminCloseLost(id: string) {
  const r = await api.post<ApiSuccess<LostPost>>(`/admin/lost-posts/${id}/close`);
  return r.data.data;
}

export async function adminCloseFound(id: string) {
  const r = await api.post<ApiSuccess<FoundPost>>(`/admin/found-posts/${id}/close`);
  return r.data.data;
}

export async function listAdminUsers() {
  const r = await api.get<ApiSuccess<User[]>>('/admin/users');
  return r.data.data;
}
