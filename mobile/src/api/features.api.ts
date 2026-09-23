import {api} from './client';
import {
  ApiSuccess,
  AppNotification,
  EmergencyInfo,
  Guardian,
  HealthProfile,
  NotificationPreference,
  OwnershipVerification,
  Vaccination,
} from '../types/api';

export async function listGuardians(petId: string) {
  const r = await api.get<ApiSuccess<Guardian[]>>(`/pets/${petId}/guardians`);
  return r.data.data;
}

export async function addGuardian(petId: string, payload: {
  email: string;
  role?: string;
  can_edit?: boolean;
  can_mark_lost?: boolean;
  can_view_private_info?: boolean;
  can_receive_notifications?: boolean;
}) {
  const r = await api.post<ApiSuccess<Guardian>>(`/pets/${petId}/guardians`, payload);
  return r.data.data;
}

export async function removeGuardian(petId: string, guardianId: string) {
  await api.delete(`/pets/${petId}/guardians/${guardianId}`);
}

export async function getHealth(petId: string) {
  const r = await api.get<ApiSuccess<HealthProfile>>(`/pets/${petId}/health`);
  return r.data.data;
}

export async function updateHealth(petId: string, payload: Partial<HealthProfile>) {
  const r = await api.put<ApiSuccess<HealthProfile>>(`/pets/${petId}/health`, payload);
  return r.data.data;
}

export async function listVaccinations(petId: string) {
  const r = await api.get<ApiSuccess<Vaccination[]>>(`/pets/${petId}/vaccinations`);
  return r.data.data;
}

export async function addVaccination(petId: string, payload: {
  name: string;
  given_at: string;
  next_due_at?: string;
  clinic_name?: string;
  note?: string;
}) {
  const r = await api.post<ApiSuccess<Vaccination>>(`/pets/${petId}/vaccinations`, payload);
  return r.data.data;
}

export async function removeVaccination(petId: string, vaccinationId: string) {
  await api.delete(`/pets/${petId}/vaccinations/${vaccinationId}`);
}

export async function getEmergencyInfo(petId: string) {
  const r = await api.get<ApiSuccess<EmergencyInfo>>(`/pets/${petId}/emergency`);
  return r.data.data;
}

export async function updateEmergencyInfo(petId: string, payload: Partial<EmergencyInfo>) {
  const r = await api.put<ApiSuccess<EmergencyInfo>>(`/pets/${petId}/emergency`, payload);
  return r.data.data;
}

export async function getOwnershipVerification(petId: string) {
  const r = await api.get<ApiSuccess<OwnershipVerification | null>>(`/pets/${petId}/ownership-verification`);
  return r.data.data;
}

export async function submitOwnershipVerification(petId: string, payload: {
  method: 'microchip' | 'documents' | 'photos' | 'other';
  evidence_note?: string;
  evidence_url?: string;
}) {
  const r = await api.post<ApiSuccess<OwnershipVerification>>(`/pets/${petId}/ownership-verification`, payload);
  return r.data.data;
}

export async function listNotifications() {
  const r = await api.get<ApiSuccess<AppNotification[]>>('/notifications');
  return r.data.data;
}

export async function markNotificationRead(id: string) {
  const r = await api.post<ApiSuccess<AppNotification>>(`/notifications/${id}/read`);
  return r.data.data;
}

export async function markAllNotificationsRead() {
  const r = await api.post<ApiSuccess<{updated: number}>>('/notifications/read-all');
  return r.data.data;
}

export async function getNotificationPreferences() {
  const r = await api.get<ApiSuccess<NotificationPreference>>('/notification-preferences');
  return r.data.data;
}

export async function updateNotificationPreferences(payload: {
  lost_alerts: boolean;
  radius_km: number;
  animal_type: 'all' | 'dog' | 'cat' | 'other';
  chat_notifications: boolean;
  marketing_notifications: boolean;
}) {
  const r = await api.put<ApiSuccess<NotificationPreference>>('/notification-preferences', payload);
  return r.data.data;
}

export async function syncUserLocation(latitude: number, longitude: number) {
  const r = await api.put<ApiSuccess<{latitude: number; longitude: number; updated_at: string}>>('/me/location', {latitude, longitude});
  return r.data.data;
}

export async function getFollowStatus(postId: string) {
  const r = await api.get<ApiSuccess<{following: boolean}>>(`/lost-posts/${postId}/follow`);
  return r.data.data.following;
}

export async function followLostCase(postId: string) {
  const r = await api.post<ApiSuccess<{following: boolean}>>(`/lost-posts/${postId}/follow`);
  return r.data.data.following;
}

export async function unfollowLostCase(postId: string) {
  await api.delete(`/lost-posts/${postId}/follow`);
}

export async function trackAdEvent(adId: string, event_type: 'impression' | 'click') {
  await api.post(`/ads/${adId}/events`, {event_type});
}


export async function reportRegisteredPetFound(qrToken: string, payload: {latitude: number; longitude: number; location_text?: string; note?: string}) {
  const r = await api.post<ApiSuccess<{reported: boolean; pet_id: string}>>(`/public/pets/qr/${qrToken}/found-alert`, payload);
  return r.data.data;
}
