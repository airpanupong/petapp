// Row -> JSON shapes matching the Pydantic *Read models, field order included.
import type {Row} from './db';
import {addMs, DAY_MS} from './time';

export const CHECKIN_RESPONSE_WINDOW_MS = 7 * DAY_MS;

export const bool = (v: unknown): boolean => v === 1 || v === true || v === '1';

const s = (v: unknown) => (v ?? null) as string | null;
const n = (v: unknown) => (v == null ? null : Number(v));

export function jsonList(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v as string[];
  try {
    const parsed = JSON.parse(String(v));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function photoRead(row: Row) {
  const list = jsonList(row.image_urls) ?? [];
  const image_url = s(row.image_url);
  return {image_url, image_urls: list.length ? list : image_url ? [image_url] : []};
}

export function userRead(u: Row) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    phone: s(u.phone),
    avatar_url: s(u.avatar_url),
    role: u.role,
    status: u.status,
    created_at: u.created_at,
  };
}

export function petRead(p: Row) {
  return {
    id: p.id,
    owner_id: p.owner_id,
    pet_code: p.pet_code,
    qr_token: p.qr_token,
    name: p.name,
    animal_type: p.animal_type,
    breed: s(p.breed),
    gender: s(p.gender),
    color: s(p.color),
    birth_date: s(p.birth_date),
    // Numeric(7, 2) serialized by Pydantic as a decimal string.
    weight: p.weight == null ? null : Number(p.weight).toFixed(2),
    description: s(p.description),
    distinctive_marks: s(p.distinctive_marks),
    microchip_id: s(p.microchip_id),
    profile_image_url: s(p.profile_image_url),
    emergency_note: s(p.emergency_note),
    status: p.status,
    is_public: bool(p.is_public),
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export function publicPetRead(p: Row) {
  return {
    id: p.id,
    pet_code: p.pet_code,
    name: p.name,
    animal_type: p.animal_type,
    breed: s(p.breed),
    gender: s(p.gender),
    color: s(p.color),
    description: s(p.description),
    distinctive_marks: s(p.distinctive_marks),
    profile_image_url: s(p.profile_image_url),
    emergency_note: s(p.emergency_note),
    status: p.status,
  };
}

export function petSummary(p: Row) {
  return {
    id: p.id,
    name: p.name,
    animal_type: p.animal_type,
    breed: s(p.breed),
    color: s(p.color),
    profile_image_url: s(p.profile_image_url),
  };
}

export function petImageRead(r: Row) {
  return {id: r.id, pet_id: r.pet_id, image_url: r.image_url, is_primary: bool(r.is_primary), created_at: r.created_at};
}

export function checkinDeadline(p: Row): string | null {
  if (p.checkin_asked_at == null || p.status !== 'active') return null;
  return addMs(String(p.checkin_asked_at), CHECKIN_RESPONSE_WINDOW_MS);
}

export function lostPostRead(p: Row) {
  return {
    ...photoRead(p),
    id: p.id,
    pet_id: p.pet_id,
    owner_id: p.owner_id,
    status: p.status,
    title: p.title,
    description: s(p.description),
    lost_at: p.lost_at,
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    location_text: s(p.location_text),
    search_radius_km: Number(p.search_radius_km),
    reward_enabled: bool(p.reward_enabled),
    reward_text: s(p.reward_text),
    share_token: p.share_token,
    view_count: Number(p.view_count ?? 0),
    created_at: p.created_at,
    closed_at: s(p.closed_at),
    checkin_asked_at: s(p.checkin_asked_at),
    checkin_deadline_at: checkinDeadline(p),
    created_by_admin: bool(p.created_by_admin),
  };
}

/** Contact details the public site must never receive. Attach only for staff viewers. */
export function staffPrivate(p: Row) {
  return {
    private_owner_name: s(p.private_owner_name),
    private_phone: s(p.private_phone),
    private_link: s(p.private_link),
    private_note: s(p.private_note),
  };
}

export function foundPostRead(p: Row) {
  return {
    ...photoRead(p),
    id: p.id,
    reporter_id: s(p.reporter_id),
    animal_type: p.animal_type,
    breed_guess: s(p.breed_guess),
    color: s(p.color),
    description: s(p.description),
    found_at: p.found_at,
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    location_text: s(p.location_text),
    status: p.status,
    share_token: p.share_token,
    is_guest: bool(p.is_guest),
    view_count: Number(p.view_count ?? 0),
    created_at: p.created_at,
    created_by_admin: bool(p.created_by_admin),
  };
}

export function sightingRead(r: Row) {
  return {
    id: r.id,
    lost_post_id: r.lost_post_id,
    reporter_id: s(r.reporter_id),
    seen_at: r.seen_at,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    location_text: s(r.location_text),
    direction: s(r.direction),
    description: s(r.description),
    image_url: s(r.image_url),
    image_urls: jsonList(r.image_urls) ?? [],
    created_at: r.created_at,
  };
}

export function guardianRead(g: Row) {
  return {
    id: g.id,
    pet_id: g.pet_id,
    user_id: g.user_id,
    role: g.role,
    can_edit: bool(g.can_edit),
    can_mark_lost: bool(g.can_mark_lost),
    can_view_private_info: bool(g.can_view_private_info),
    can_receive_notifications: bool(g.can_receive_notifications),
    created_at: g.created_at,
    display_name: s(g.display_name),
    email: s(g.email),
  };
}

export function adRead(a: Row) {
  return {
    id: a.id,
    advertiser_name: a.advertiser_name,
    title: a.title,
    description: a.description,
    image_url: s(a.image_url),
    target_url: s(a.target_url),
    ad_type: a.ad_type,
  };
}

export function conversationRead(c: Row) {
  return {id: c.id, type: c.type, reference_id: s(c.reference_id), created_at: c.created_at};
}

export function messageRead(m: Row) {
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    message_type: m.message_type,
    content: s(m.content),
    image_url: s(m.image_url),
    created_at: m.created_at,
    read_at: s(m.read_at),
    context: null as unknown,
  };
}

export function healthRead(h: Row) {
  return {
    allergies: s(h.allergies),
    medications: s(h.medications),
    conditions: s(h.conditions),
    vet_name: s(h.vet_name),
    vet_phone: s(h.vet_phone),
    notes: s(h.notes),
    id: h.id,
    pet_id: h.pet_id,
    updated_at: h.updated_at,
  };
}

export function vaccinationRead(v: Row) {
  return {
    name: v.name,
    given_at: v.given_at,
    next_due_at: s(v.next_due_at),
    clinic_name: s(v.clinic_name),
    note: s(v.note),
    id: v.id,
    pet_id: v.pet_id,
    created_at: v.created_at,
  };
}

export function emergencyRead(e: Row) {
  return {
    public_allergies: s(e.public_allergies),
    public_medications: s(e.public_medications),
    public_conditions: s(e.public_conditions),
    emergency_note: s(e.emergency_note),
    emergency_contact_name: s(e.emergency_contact_name),
    emergency_contact_phone: s(e.emergency_contact_phone),
    show_contact_phone: bool(e.show_contact_phone),
    id: e.id,
    pet_id: e.pet_id,
    updated_at: e.updated_at,
  };
}

export function ownershipRead(o: Row) {
  return {
    id: o.id,
    pet_id: o.pet_id,
    owner_id: o.owner_id,
    method: o.method,
    evidence_note: s(o.evidence_note),
    evidence_url: s(o.evidence_url),
    status: o.status,
    reviewer_note: s(o.reviewer_note),
    submitted_at: o.submitted_at,
    reviewed_at: s(o.reviewed_at),
  };
}

export function preferencesRead(p: Row) {
  return {
    lost_alerts: bool(p.lost_alerts),
    radius_km: Number(p.radius_km),
    animal_type: p.animal_type,
    chat_notifications: bool(p.chat_notifications),
    marketing_notifications: bool(p.marketing_notifications),
    id: p.id,
    user_id: p.user_id,
    updated_at: p.updated_at,
  };
}

export function notificationRead(r: Row) {
  return {
    id: r.id,
    user_id: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    reference_type: s(r.reference_type),
    reference_id: s(r.reference_id),
    is_read: bool(r.is_read),
    created_at: r.created_at,
  };
}

export function deviceTokenRead(d: Row) {
  return {id: d.id, platform: d.platform, token: d.token, device_id: s(d.device_id), is_active: bool(d.is_active)};
}

export function reportRead(r: Row) {
  return {
    id: r.id,
    reporter_id: r.reporter_id,
    target_type: r.target_type,
    target_id: r.target_id,
    reason: r.reason,
    details: s(r.details),
    status: r.status,
    resolver_id: s(r.resolver_id),
    resolver_note: s(r.resolver_note),
    created_at: r.created_at,
    resolved_at: s(r.resolved_at),
  };
}

export {n as numOrNull};
