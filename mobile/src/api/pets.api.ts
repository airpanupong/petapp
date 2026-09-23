import {api} from './client';
import {ApiSuccess, Pet, PublicPet} from '../types/api';

export type PetCreateInput = {
  name: string;
  animal_type: 'dog' | 'cat' | 'other';
  breed?: string;
  gender?: string;
  color?: string;
  description?: string;
  distinctive_marks?: string;
  emergency_note?: string;
  microchip_id?: string;
  profile_image_url?: string;
  birth_date?: string;
  weight?: number;
  is_public?: boolean;
};

export async function listPets() {
  const response = await api.get<ApiSuccess<Pet[]>>('/pets');
  return response.data.data;
}

export async function createPet(payload: PetCreateInput) {
  const response = await api.post<ApiSuccess<Pet>>('/pets', payload);
  return response.data.data;
}

export async function getPet(id: string) {
  const response = await api.get<ApiSuccess<Pet>>(`/pets/${id}`);
  return response.data.data;
}

export async function updatePet(id: string, payload: Partial<PetCreateInput>) {
  const response = await api.patch<ApiSuccess<Pet>>(`/pets/${id}`, payload);
  return response.data.data;
}

export async function getPublicPetByQr(qrToken: string) {
  const response = await api.get<ApiSuccess<PublicPet>>(`/public/pets/qr/${qrToken}`);
  return response.data.data;
}

export type PetImage = {
  id: string;
  pet_id: string;
  image_url: string;
  is_primary: boolean;
  created_at: string;
};

export async function listPetImages(petId: string) {
  const response = await api.get<ApiSuccess<PetImage[]>>(`/pets/${petId}/images`);
  return response.data.data;
}

export async function addPetImage(petId: string, payload: {image_url: string; is_primary?: boolean}) {
  const response = await api.post<ApiSuccess<PetImage>>(`/pets/${petId}/images`, payload);
  return response.data.data;
}

export async function setPrimaryPetImage(petId: string, imageId: string) {
  const response = await api.post<ApiSuccess<PetImage>>(`/pets/${petId}/images/${imageId}/primary`);
  return response.data.data;
}

export async function deletePetImage(petId: string, imageId: string) {
  await api.delete(`/pets/${petId}/images/${imageId}`);
}
