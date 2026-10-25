import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, deps, type AppEnv} from '../app';
import {uuid, type Row} from '../lib/db';
import {AppError, success} from '../lib/errors';
import {isStaff} from '../lib/roles';
import {
  bool,
  conversationRead,
  emergencyRead,
  guardianRead,
  healthRead,
  ownershipRead,
  petImageRead,
  petRead,
  publicPetRead,
  vaccinationRead,
} from '../lib/serialize';
import {now} from '../lib/time';
import {bool as boolField, date, email, num, optStr, parseBody, str} from '../lib/validate';
import {findOrCreateConversation} from '../services/chat';
import {addNotification, notifyPetGuardians} from '../services/notifications';
import {getOwnedPet, uniquePetCode, uniqueQrToken} from '../services/pets';

const weight = () => num().pipe(z.number().min(0).max(500));

const PetCreate = z.object({
  name: str(120, 1),
  animal_type: z.enum(['dog', 'cat', 'other']),
  breed: optStr(120),
  gender: optStr(30),
  color: optStr(120),
  birth_date: date().nullish(),
  weight: weight().nullish(),
  description: optStr(),
  distinctive_marks: optStr(),
  microchip_id: optStr(120),
  profile_image_url: optStr(),
  emergency_note: optStr(),
  is_public: boolField().default(true),
});

const PetUpdate = z.object({
  name: str(120, 1).nullish(),
  breed: optStr(),
  gender: optStr(),
  color: optStr(),
  birth_date: date().nullish(),
  weight: weight().nullish(),
  description: optStr(),
  distinctive_marks: optStr(),
  microchip_id: optStr(),
  profile_image_url: optStr(),
  emergency_note: optStr(),
  is_public: boolField().nullish(),
});

const PetFoundAlertCreate = z.object({
  latitude: num().pipe(z.number().min(-90).max(90)),
  longitude: num().pipe(z.number().min(-180).max(180)),
  location_text: optStr(300),
  note: optStr(2000),
});

const PetImageCreate = z.object({image_url: str(1000, 1), is_primary: boolField().default(false)});

const GuardianCreate = z.object({
  email: email(),
  role: z.string().default('guardian'),
  can_edit: boolField().default(false),
  can_mark_lost: boolField().default(true),
  can_view_private_info: boolField().default(false),
  can_receive_notifications: boolField().default(true),
});
const GuardianUpdate = z.object({
  role: z.string().nullish(),
  can_edit: boolField().nullish(),
  can_mark_lost: boolField().nullish(),
  can_view_private_info: boolField().nullish(),
  can_receive_notifications: boolField().nullish(),
});

const HealthProfileUpdate = z.object({
  allergies: optStr(),
  medications: optStr(),
  conditions: optStr(),
  vet_name: optStr(160),
  vet_phone: optStr(60),
  notes: optStr(),
});
const VaccinationCreate = z.object({
  name: str(160, 1),
  given_at: date(),
  next_due_at: date().nullish(),
  clinic_name: optStr(200),
  note: optStr(),
});
const EmergencyInfoUpdate = z.object({
  public_allergies: optStr(),
  public_medications: optStr(),
  public_conditions: optStr(),
  emergency_note: optStr(),
  emergency_contact_name: optStr(160),
  emergency_contact_phone: optStr(60),
  show_contact_phone: boolField().default(false),
});
const OwnershipVerificationCreate = z.object({
  method: z.enum(['microchip', 'documents', 'photos', 'other']),
  evidence_note: optStr(4000),
  evidence_url: optStr(1000),
});
export const OwnershipReview = z.object({
  status: z.enum(['verified', 'rejected']),
  reviewer_note: optStr(4000),
});

const MAX_IMAGES = 8;

export const pets = new Hono<AppEnv>();

/** `model_dump()` of an all-optional model: every field, None when absent. */
function fullDump<T extends Record<string, unknown>>(schema: z.ZodObject, body: T): Record<string, unknown> {
  return Object.fromEntries(Object.keys(schema.shape).map(k => [k, body[k] ?? null]));
}

// ---------- Pets ----------

pets.get('/pets', async c => {
  const user = await currentUser(c);
  const rows = await deps(c).db.all<Row>(
    'SELECT * FROM pets WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    user.id,
  );
  return c.json(success(rows.map(petRead)));
});

pets.post('/pets', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, PetCreate);
  const d = deps(c);
  const ts = now();
  const pet: Row = {
    id: uuid(),
    owner_id: user.id,
    pet_code: await uniquePetCode(d),
    qr_token: await uniqueQrToken(d),
    ...fullDump(PetCreate, body),
    status: 'normal',
    deleted_at: null,
    created_at: ts,
    updated_at: ts,
  };
  await d.db.insert('pets', pet as Record<string, string | number | boolean | null>);
  return c.json(success(petRead(pet)), 201);
});

pets.get('/pets/:petId', async c => {
  const user = await currentUser(c);
  return c.json(success(petRead(await getOwnedPet(deps(c), user, c.req.param('petId')))));
});

pets.patch('/pets/:petId', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, PetUpdate);
  const d = deps(c);
  const pet = await getOwnedPet(d, user, c.req.param('petId'));
  const fields: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    // name and is_public are NOT NULL columns.
    if ((key === 'name' || key === 'is_public') && value === null) continue;
    fields[key] = value as string | number | boolean | null;
  }
  if (Object.keys(fields).length) {
    fields.updated_at = now();
    await d.db.update('pets', String(pet.id), fields);
  }
  return c.json(success(petRead({...pet, ...fields})));
});

pets.delete('/pets/:petId', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const pet = await getOwnedPet(d, user, c.req.param('petId'));
  await d.db.run('UPDATE pets SET deleted_at = ?, updated_at = ? WHERE id = ?', now(), now(), String(pet.id));
  return c.body(null, 204);
});

// ---------- Public QR profile ----------

pets.get('/public/pets/qr/:qrToken', async c => {
  const {db} = deps(c);
  const pet = await db.one<Row>(
    'SELECT * FROM pets WHERE qr_token = ? AND deleted_at IS NULL AND is_public = 1',
    c.req.param('qrToken'),
  );
  if (!pet) throw new AppError(404, 'PET_NOT_FOUND', 'Public pet profile not found');
  const data: Record<string, unknown> = publicPetRead(pet);
  const emergency = await db.one<Row>('SELECT * FROM pet_emergency_infos WHERE pet_id = ?', String(pet.id));
  if (emergency) {
    const showPhone = bool(emergency.show_contact_phone);
    data.emergency = {
      public_allergies: emergency.public_allergies ?? null,
      public_medications: emergency.public_medications ?? null,
      public_conditions: emergency.public_conditions ?? null,
      emergency_note: emergency.emergency_note ?? null,
      emergency_contact_name: emergency.emergency_contact_name ?? null,
      emergency_contact_phone: showPhone ? emergency.emergency_contact_phone ?? null : null,
      show_contact_phone: showPhone,
    };
  }
  const verified = await db.one(
    "SELECT id FROM ownership_verifications WHERE pet_id = ? AND status = 'verified' LIMIT 1",
    String(pet.id),
  );
  data.ownership_verified = verified !== null;
  data.owner_id = pet.owner_id;
  data.actions = {report_found: true, contact_owner: true};
  return c.json(success(data));
});

pets.post('/public/pets/qr/:qrToken/contact', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const pet = await d.db.one<Row>('SELECT * FROM pets WHERE qr_token = ? AND deleted_at IS NULL', c.req.param('qrToken'));
  if (!pet) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
  const conversation = await findOrCreateConversation(d, user, String(pet.owner_id), 'pet_contact', String(pet.id));
  return c.json(success(conversationRead(conversation)), 201);
});

pets.post('/public/pets/qr/:qrToken/found-alert', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, PetFoundAlertCreate);
  const d = deps(c);
  const pet = await d.db.one<Row>('SELECT * FROM pets WHERE qr_token = ? AND deleted_at IS NULL', c.req.param('qrToken'));
  if (!pet) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
  if (pet.owner_id === user.id) throw new AppError(409, 'PET_IS_OWNED_BY_REPORTER', 'This is your own pet');
  const where = body.location_text || `${body.latitude.toFixed(5)}, ${body.longitude.toFixed(5)}`;
  let text = `มีผู้ใช้แจ้งว่าพบ ${pet.name} บริเวณ ${where}`;
  if (body.note) text += ` · ${body.note}`;
  const title = `มีคนพบ ${pet.name} 🐾`;
  await addNotification(d, String(pet.owner_id), 'registered_pet_found', title, text, 'pet', String(pet.id));
  await notifyPetGuardians(d, String(pet.id), 'registered_pet_found', title, text, 'pet', String(pet.id), user.id);
  return c.json(success({reported: true, pet_id: pet.id}), 201);
});

// ---------- Pet images ----------

pets.get('/pets/:petId/images', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const rows = await d.db.all<Row>(
    'SELECT * FROM pet_images WHERE pet_id = ? ORDER BY is_primary DESC, created_at DESC',
    petId,
  );
  return c.json(success(rows.map(petImageRead)));
});

pets.post('/pets/:petId/images', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, PetImageCreate);
  const d = deps(c);
  const petId = c.req.param('petId');
  const pet = await getOwnedPet(d, user, petId);
  const count = await d.db.count('SELECT COUNT(*) FROM pet_images WHERE pet_id = ?', petId);
  if (count >= MAX_IMAGES) throw new AppError(400, 'PET_IMAGE_LIMIT', `Maximum ${MAX_IMAGES} images per pet`);
  const makePrimary = body.is_primary || count === 0;
  const row = {id: uuid(), pet_id: petId, image_url: body.image_url, is_primary: makePrimary ? 1 : 0, created_at: now()};
  const statements = [];
  if (makePrimary) statements.push(d.db.stmt('UPDATE pet_images SET is_primary = 0 WHERE pet_id = ?', petId));
  statements.push(d.db.insertStmt('pet_images', row));
  if (makePrimary) {
    statements.push(
      d.db.stmt('UPDATE pets SET profile_image_url = ?, updated_at = ? WHERE id = ?', body.image_url, now(), String(pet.id)),
    );
  }
  await d.db.batch(statements);
  return c.json(success(petImageRead(row)), 201);
});

pets.post('/pets/:petId/images/:imageId/primary', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  const imageId = c.req.param('imageId');
  await getOwnedPet(d, user, petId);
  const row = await d.db.get<Row>('pet_images', imageId);
  if (!row || row.pet_id !== petId) throw new AppError(404, 'PET_IMAGE_NOT_FOUND', 'Image not found');
  await d.db.batch([
    d.db.stmt('UPDATE pet_images SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE pet_id = ?', imageId, petId),
    d.db.stmt('UPDATE pets SET profile_image_url = ?, updated_at = ? WHERE id = ?', String(row.image_url), now(), petId),
  ]);
  return c.json(success(petImageRead({...row, is_primary: 1})));
});

pets.delete('/pets/:petId/images/:imageId', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  const imageId = c.req.param('imageId');
  await getOwnedPet(d, user, petId);
  const row = await d.db.get<Row>('pet_images', imageId);
  if (!row || row.pet_id !== petId) throw new AppError(404, 'PET_IMAGE_NOT_FOUND', 'Image not found');
  await d.db.run('DELETE FROM pet_images WHERE id = ?', imageId);
  if (bool(row.is_primary)) {
    const next = await d.db.one<Row>('SELECT * FROM pet_images WHERE pet_id = ? ORDER BY created_at DESC LIMIT 1', petId);
    await d.db.batch([
      ...(next ? [d.db.stmt('UPDATE pet_images SET is_primary = 1 WHERE id = ?', String(next.id))] : []),
      d.db.stmt('UPDATE pets SET profile_image_url = ?, updated_at = ? WHERE id = ?', next ? String(next.image_url) : null, now(), petId),
    ]);
  }
  return c.body(null, 204);
});

// ---------- Guardians ----------

async function guardianPayload(c: Parameters<typeof deps>[0], id: string) {
  const row = await deps(c).db.one<Row>(
    'SELECT g.*, u.display_name, u.email FROM pet_guardians g LEFT JOIN users u ON u.id = g.user_id WHERE g.id = ?',
    id,
  );
  return guardianRead(row!);
}

pets.get('/pets/:petId/guardians', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const rows = await d.db.all<Row>(
    'SELECT g.*, u.display_name, u.email FROM pet_guardians g LEFT JOIN users u ON u.id = g.user_id WHERE g.pet_id = ? ORDER BY g.created_at, g.rowid',
    petId,
  );
  return c.json(success(rows.map(guardianRead)));
});

pets.post('/pets/:petId/guardians', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, GuardianCreate);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const guardian = await d.db.one<Row>('SELECT id FROM users WHERE email = ?', body.email.toLowerCase().trim());
  if (!guardian) throw new AppError(404, 'USER_NOT_FOUND', 'Guardian must already have an account');
  if (guardian.id === user.id) throw new AppError(409, 'GUARDIAN_IS_OWNER', 'Owner is already the primary guardian');
  if (await d.db.one('SELECT id FROM pet_guardians WHERE pet_id = ? AND user_id = ?', petId, String(guardian.id))) {
    throw new AppError(409, 'GUARDIAN_EXISTS', 'User is already a guardian');
  }
  const id = uuid();
  await d.db.insert('pet_guardians', {
    id,
    pet_id: petId,
    user_id: String(guardian.id),
    role: body.role,
    can_edit: body.can_edit,
    can_mark_lost: body.can_mark_lost,
    can_view_private_info: body.can_view_private_info,
    can_receive_notifications: body.can_receive_notifications,
    created_at: now(),
  });
  return c.json(success(await guardianPayload(c, id)), 201);
});

pets.patch('/pets/:petId/guardians/:guardianId', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, GuardianUpdate);
  const d = deps(c);
  const petId = c.req.param('petId');
  const guardianId = c.req.param('guardianId');
  await getOwnedPet(d, user, petId);
  const row = await d.db.one('SELECT id FROM pet_guardians WHERE id = ? AND pet_id = ?', guardianId, petId);
  if (!row) throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found');
  const fields: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(body)) if (value !== undefined && value !== null) fields[key] = value;
  await d.db.update('pet_guardians', guardianId, fields);
  return c.json(success(await guardianPayload(c, guardianId)));
});

pets.delete('/pets/:petId/guardians/:guardianId', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const removed = await d.db.run('DELETE FROM pet_guardians WHERE id = ? AND pet_id = ?', c.req.param('guardianId'), petId);
  if (!removed) throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found');
  return c.body(null, 204);
});

// ---------- Health ----------

async function getOrCreate(c: Parameters<typeof deps>[0], table: string, petId: string): Promise<Row> {
  const {db} = deps(c);
  const existing = await db.one<Row>(`SELECT * FROM ${table} WHERE pet_id = ?`, petId);
  if (existing) return existing;
  await db.run(`INSERT INTO ${table} (id, pet_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(pet_id) DO NOTHING`, uuid(), petId, now());
  return (await db.one<Row>(`SELECT * FROM ${table} WHERE pet_id = ?`, petId))!;
}

pets.get('/pets/:petId/health', async c => {
  const user = await currentUser(c);
  const petId = c.req.param('petId');
  await getOwnedPet(deps(c), user, petId);
  return c.json(success(healthRead(await getOrCreate(c, 'pet_health_profiles', petId))));
});

pets.put('/pets/:petId/health', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, HealthProfileUpdate);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const row = await getOrCreate(c, 'pet_health_profiles', petId);
  const fields = {...fullDump(HealthProfileUpdate, body), updated_at: now()} as Record<string, string | null>;
  await d.db.update('pet_health_profiles', String(row.id), fields);
  return c.json(success(healthRead({...row, ...fields})));
});

pets.get('/pets/:petId/vaccinations', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const rows = await d.db.all<Row>('SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY given_at DESC', petId);
  return c.json(success(rows.map(vaccinationRead)));
});

pets.post('/pets/:petId/vaccinations', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, VaccinationCreate);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const row = {id: uuid(), pet_id: petId, ...fullDump(VaccinationCreate, body), created_at: now()} as Record<string, string | null>;
  await d.db.insert('vaccinations', row);
  return c.json(success(vaccinationRead(row)), 201);
});

pets.delete('/pets/:petId/vaccinations/:vaccinationId', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const removed = await d.db.run('DELETE FROM vaccinations WHERE id = ? AND pet_id = ?', c.req.param('vaccinationId'), petId);
  if (!removed) throw new AppError(404, 'VACCINATION_NOT_FOUND', 'Vaccination not found');
  return c.body(null, 204);
});

// ---------- Emergency ----------

pets.get('/pets/:petId/emergency', async c => {
  const user = await currentUser(c);
  const petId = c.req.param('petId');
  await getOwnedPet(deps(c), user, petId);
  return c.json(success(emergencyRead(await getOrCreate(c, 'pet_emergency_infos', petId))));
});

pets.put('/pets/:petId/emergency', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, EmergencyInfoUpdate);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const row = await getOrCreate(c, 'pet_emergency_infos', petId);
  const fields = {...fullDump(EmergencyInfoUpdate, body), show_contact_phone: body.show_contact_phone, updated_at: now()} as Record<
    string,
    string | boolean | null
  >;
  await d.db.batch([
    d.db.updateStmt('pet_emergency_infos', String(row.id), fields),
    d.db.stmt('UPDATE pets SET emergency_note = ?, updated_at = ? WHERE id = ?', body.emergency_note ?? null, now(), petId),
  ]);
  return c.json(success(emergencyRead({...row, ...fields})));
});

// ---------- Ownership verification ----------

pets.get('/pets/:petId/ownership-verification', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const petId = c.req.param('petId');
  await getOwnedPet(d, user, petId);
  const row = await d.db.one<Row>(
    'SELECT * FROM ownership_verifications WHERE pet_id = ? AND owner_id = ? ORDER BY submitted_at DESC LIMIT 1',
    petId,
    user.id,
  );
  return c.json(success(row ? ownershipRead(row) : null));
});

pets.post('/pets/:petId/ownership-verification', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, OwnershipVerificationCreate);
  const d = deps(c);
  const petId = c.req.param('petId');
  const pet = await getOwnedPet(d, user, petId);
  const previous = await d.db.one<Row>(
    'SELECT status FROM ownership_verifications WHERE pet_id = ? AND owner_id = ? ORDER BY submitted_at DESC LIMIT 1',
    petId,
    user.id,
  );
  if (previous?.status === 'verified') throw new AppError(409, 'OWNERSHIP_ALREADY_VERIFIED', 'Ownership is already verified');
  if (body.method === 'microchip' && !pet.microchip_id && !body.evidence_note) {
    throw new AppError(422, 'MICROCHIP_REQUIRED', 'Add a microchip ID or evidence note before submitting');
  }
  const row = {
    id: uuid(),
    pet_id: petId,
    owner_id: user.id,
    status: 'pending',
    method: body.method,
    evidence_note: body.evidence_note ?? null,
    evidence_url: body.evidence_url ?? null,
    reviewer_note: null,
    submitted_at: now(),
    reviewed_at: null,
  };
  await d.db.insert('ownership_verifications', row);
  return c.json(success(ownershipRead(row)), 201);
});

export async function listOwnership(c: Parameters<typeof deps>[0]) {
  const rows = await deps(c).db.all<Row>('SELECT * FROM ownership_verifications ORDER BY submitted_at DESC LIMIT 200');
  return c.json(success(rows.map(ownershipRead)));
}

export async function reviewOwnership(c: Parameters<typeof deps>[0]) {
  const d = deps(c);
  const body = await parseBody(c, OwnershipReview);
  const id = c.req.param('verificationId')!;
  const row = await d.db.get<Row>('ownership_verifications', id);
  if (!row) throw new AppError(404, 'VERIFICATION_NOT_FOUND', 'Verification not found');
  const fields = {status: body.status, reviewer_note: body.reviewer_note ?? null, reviewed_at: now()};
  await d.db.update('ownership_verifications', id, fields);
  return c.json(success(ownershipRead({...row, ...fields})));
}

pets.get('/admin/ownership-verifications', async c => {
  const user = await currentUser(c);
  if (!isStaff(user.role)) throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin role required');
  return listOwnership(c);
});

pets.post('/admin/ownership-verifications/:verificationId/review', async c => {
  const user = await currentUser(c);
  if (!isStaff(user.role)) throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin role required');
  return reviewOwnership(c);
});
