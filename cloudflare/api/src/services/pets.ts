import type {Deps, User} from '../app';
import type {Row} from '../lib/db';
import {AppError} from '../lib/errors';
import {generatePetCode, generateQrToken} from '../lib/security';

export async function getOwnedPet(deps: Deps, user: User, petId: string): Promise<Row> {
  const pet = await deps.db.one<Row>('SELECT * FROM pets WHERE id = ? AND deleted_at IS NULL', petId);
  if (!pet) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
  if (pet.owner_id !== user.id) throw new AppError(403, 'PET_FORBIDDEN', 'You do not own this pet');
  return pet;
}

export async function uniquePetCode(deps: Deps): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generatePetCode();
    if (!(await deps.db.one('SELECT id FROM pets WHERE pet_code = ?', code))) return code;
  }
  throw new Error('Could not allocate pet code');
}

export async function uniqueQrToken(deps: Deps): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const token = generateQrToken();
    if (!(await deps.db.one('SELECT id FROM pets WHERE qr_token = ?', token))) return token;
  }
  throw new Error('Could not allocate QR token');
}
