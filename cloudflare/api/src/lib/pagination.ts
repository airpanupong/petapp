import type {Db} from './db';
import {AppError} from './errors';
import {parseDateTime} from './time';

export type Cursor = [at: string, id: string];

/** Cursors look like "<ISO timestamp>|<id>": the last item of the previous page. */
export function makeCursor(at: string, id: string): string {
  return `${at}|${id}`;
}

export function parseCursor(cursor: string | null | undefined): Cursor | null {
  if (!cursor) return null;
  const sep = cursor.lastIndexOf('|');
  const at = sep >= 0 ? parseDateTime(cursor.slice(0, sep)) : null;
  const id = sep >= 0 ? cursor.slice(sep + 1) : '';
  if (!at || !id) throw new AppError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
  return [at, id];
}

/** SQL filter for rows after the cursor in newest-first order, or null without a cursor. */
export async function olderThan(
  db: Db,
  table: string,
  column: string,
  cursor: string | null | undefined,
): Promise<{sql: string; params: string[]} | null> {
  const parsed = parseCursor(cursor);
  if (!parsed) return null;
  const [at, id] = parsed;
  const ref = await db.value<string>(`SELECT ${column} FROM ${table} WHERE id = ?`, id);
  if (ref == null) return {sql: `${table}.${column} < ?`, params: [at]};
  return {
    sql: `(${table}.${column} < ? OR (${table}.${column} = ? AND ${table}.id < ?))`,
    params: [ref, ref, id],
  };
}

export function isOlder(at: string, id: string, cursor: Cursor | null): boolean {
  if (!cursor) return true;
  return at < cursor[0] || (at === cursor[0] && id < cursor[1]);
}
