import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, deps, type AppEnv, type User} from '../app';
import type {Row} from '../lib/db';
import {AppError, success} from '../lib/errors';
import {SUPER_ADMIN} from '../lib/roles';
import {verifyPassword} from '../lib/security';
import {foundPostRead, lostPostRead, petSummary, userRead} from '../lib/serialize';
import {now} from '../lib/time';
import {parseBody} from '../lib/validate';
import {deleteAccount} from '../services/account';

const UserUpdate = z.object({
  display_name: z.string().nullish(),
  phone: z.string().nullish(),
  avatar_url: z.string().nullish(),
});
const DeleteAccountRequest = z.object({password: z.string()});

export const users = new Hono<AppEnv>().basePath('/users');

users.get('/me', async c => c.json(success(userRead(await currentUser(c)))));

users.patch('/me', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, UserUpdate);
  const fields: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || (key === 'display_name' && value === null)) continue;
    fields[key] = value;
  }
  if (Object.keys(fields).length) {
    fields.updated_at = now();
    await deps(c).db.update('users', user.id, fields);
  }
  return c.json(success(userRead({...user, ...fields} as User)));
});

users.delete('/me', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, DeleteAccountRequest);
  if (user.role === SUPER_ADMIN) throw new AppError(400, 'SUPER_ADMIN_UNDELETABLE', 'Super admin accounts cannot be deleted');
  if (!(await verifyPassword(body.password, user.password_hash))) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Password is incorrect');
  }
  await deleteAccount(deps(c), user);
  return c.body(null, 204);
});

users.get('/me/posts', async c => {
  const user = await currentUser(c);
  const {db} = deps(c);
  const [lost, found] = await Promise.all([
    db.all<Row>(
      `SELECT l.*, p.id AS p_id, p.name AS p_name, p.animal_type AS p_animal_type, p.breed AS p_breed,
              p.color AS p_color, p.profile_image_url AS p_profile_image_url
       FROM lost_posts l LEFT JOIN pets p ON p.id = l.pet_id
       WHERE l.owner_id = ? ORDER BY l.created_at DESC LIMIT 100`,
      user.id,
    ),
    db.all<Row>('SELECT * FROM found_posts WHERE reporter_id = ? ORDER BY created_at DESC LIMIT 100', user.id),
  ]);
  const lostItems = lost.map(post => {
    const item: Record<string, unknown> = lostPostRead(post);
    if (post.p_id) item.pet = petSummary(prefixed(post, 'p_'));
    return item;
  });
  return c.json(success({lost: lostItems, found: found.map(foundPostRead)}));
});

/** Picks "<prefix>column" fields of a joined row back into a plain row. */
export function prefixed(row: Row, prefix: string): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  return out;
}
