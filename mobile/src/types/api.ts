export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string | null;
};

export type ApiErrorBody = {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type User = {
  id: string;
  email: string;
  display_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: string;
  status: string;
  created_at: string;
};

export type AuthPayload = {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type Pet = {
  id: string;
  owner_id: string;
  pet_code: string;
  qr_token: string;
  name: string;
  animal_type: 'dog' | 'cat' | 'other';
  breed?: string | null;
  gender?: string | null;
  color?: string | null;
  birth_date?: string | null;
  weight?: string | number | null;
  description?: string | null;
  distinctive_marks?: string | null;
  microchip_id?: string | null;
  profile_image_url?: string | null;
  emergency_note?: string | null;
  status: 'normal' | 'lost' | 'found' | 'deceased' | 'inactive' | string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type LostPost = {
  id: string;
  pet_id: string;
  owner_id: string;
  status: string;
  title: string;
  description?: string | null;
  lost_at: string;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  search_radius_km: number;
  reward_enabled: boolean;
  reward_text?: string | null;
  image_url?: string | null;
  share_token: string;
  created_at: string;
  closed_at?: string | null;
  distance_km?: number;
  pet?: Pick<Pet, 'id' | 'name' | 'animal_type' | 'breed' | 'color' | 'profile_image_url'>;
};

export type FoundPost = {
  id: string;
  reporter_id?: string | null;
  animal_type: 'dog' | 'cat' | 'other';
  breed_guess?: string | null;
  color?: string | null;
  description?: string | null;
  image_url?: string | null;
  found_at: string;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  status: string;
  share_token: string;
  created_at: string;
  distance_km?: number;
};

export type Sighting = {
  id: string;
  lost_post_id: string;
  reporter_id?: string | null;
  seen_at: string;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  direction?: string | null;
  description?: string | null;
  image_url?: string | null;
  created_at: string;
};

export type NearbySighting = {
  id: string;
  lost_post_id: string;
  seen_at: string;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  direction?: string | null;
  description?: string | null;
  distance_km?: number;
  pet_name?: string | null;
};

export type NearbyResult = {
  lost: LostPost[];
  found: FoundPost[];
  sightings?: NearbySighting[];
};

export type Ad = {
  id: string;
  advertiser_name: string;
  title: string;
  description: string;
  image_url?: string | null;
  target_url?: string | null;
  ad_type: string;
};

export type Guardian = {
  id: string;
  pet_id: string;
  user_id: string;
  role: string;
  can_edit: boolean;
  can_mark_lost: boolean;
  can_view_private_info: boolean;
  can_receive_notifications: boolean;
  display_name?: string | null;
  email?: string | null;
  created_at: string;
};

export type HealthProfile = {
  id: string;
  pet_id: string;
  allergies?: string | null;
  medications?: string | null;
  conditions?: string | null;
  vet_name?: string | null;
  vet_phone?: string | null;
  notes?: string | null;
  updated_at: string;
};

export type Vaccination = {
  id: string;
  pet_id: string;
  name: string;
  given_at: string;
  next_due_at?: string | null;
  clinic_name?: string | null;
  note?: string | null;
  created_at: string;
};

export type EmergencyInfo = {
  id: string;
  pet_id: string;
  public_allergies?: string | null;
  public_medications?: string | null;
  public_conditions?: string | null;
  emergency_note?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  show_contact_phone: boolean;
  updated_at: string;
};

export type OwnershipVerification = {
  id: string;
  pet_id: string;
  owner_id: string;
  method: 'microchip' | 'documents' | 'photos' | 'other' | string;
  evidence_note?: string | null;
  evidence_url?: string | null;
  status: 'pending' | 'verified' | 'rejected' | string;
  reviewer_note?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
};

export type NotificationPreference = {
  id: string;
  user_id: string;
  lost_alerts: boolean;
  radius_km: number;
  animal_type: 'all' | 'dog' | 'cat' | 'other';
  chat_notifications: boolean;
  marketing_notifications: boolean;
  updated_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  reference_type?: string | null;
  reference_id?: string | null;
  is_read: boolean;
  created_at: string;
};

export type PublicPet = Pick<Pet,
  'id' | 'pet_code' | 'name' | 'animal_type' | 'breed' | 'gender' | 'color' |
  'description' | 'distinctive_marks' | 'profile_image_url' | 'emergency_note' | 'status'
> & {
  owner_id?: string;
  ownership_verified?: boolean;
  emergency?: Partial<EmergencyInfo> | null;
  actions?: {report_found: boolean; contact_owner: boolean};
};