import {z} from 'zod';
import type {Context} from 'hono';
import {AppError} from './errors';
import {isValidDate, parseDateTime} from './time';

export function validationError(details: unknown): AppError {
  return new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details);
}

function valueAt(raw: unknown, path: PropertyKey[]): unknown {
  let cur = raw;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur ?? null;
}

function issues(error: z.ZodError, where: string, raw: unknown) {
  return error.issues.map(i => ({type: i.code, loc: [where, ...i.path], msg: i.message, input: valueAt(raw, i.path)}));
}

export async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let raw: unknown;
  const text = await c.req.text();
  if (!text.trim()) {
    throw validationError([{type: 'missing', loc: ['body'], msg: 'Field required'}]);
  }
  try {
    raw = JSON.parse(text);
  } catch {
    throw validationError([{type: 'json_invalid', loc: ['body'], msg: 'JSON decode error', input: {}}]);
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw validationError(issues(result.error, 'body', raw));
  return result.data;
}

export function parseQuery<T extends z.ZodType>(c: Context, schema: T): z.output<T> {
  const raw: Record<string, string> = {};
  for (const [k, v] of new URL(c.req.url).searchParams) raw[k] = v;
  const result = schema.safeParse(raw);
  if (!result.success) throw validationError(issues(result.error, 'query', raw));
  return result.data;
}

// ---------- Field helpers mirroring the Pydantic schemas ----------

const numeric = (v: unknown) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);

/** Pydantic float: numbers or numeric strings. */
export const num = () => z.preprocess(numeric, z.number());

export const int = () => z.preprocess(numeric, z.number().int());

/** Pydantic bool in lax mode. */
export const bool = () =>
  z.preprocess(v => {
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (['true', '1', 'yes', 'on', 't', 'y'].includes(s)) return true;
      if (['false', '0', 'no', 'off', 'f', 'n'].includes(s)) return false;
    }
    if (v === 1) return true;
    if (v === 0) return false;
    return v;
  }, z.boolean());

export const datetime = () =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const parsed = typeof v === 'number' ? new Date(v * 1000).toISOString() : parseDateTime(v);
    if (!parsed) {
      ctx.addIssue({code: 'custom', message: 'Input should be a valid datetime'});
      return z.NEVER;
    }
    return parsed;
  });

export const date = () =>
  z.string().refine(v => isValidDate(v.slice(0, 10)) && (v.length === 10 || /^\d{4}-\d{2}-\d{2}T00:00(:00(\.0+)?)?Z?$/.test(v)), {
    message: 'Input should be a valid date',
  }).transform(v => v.slice(0, 10));

export const email = () => z.string().trim().pipe(z.email());

export const str = (max?: number, min?: number) => {
  let s = z.string();
  if (min !== undefined) s = s.min(min);
  if (max !== undefined) s = s.max(max);
  return s;
};

/** Optional, nullable string like `str | None = None`. */
export const optStr = (max?: number) => str(max).nullish();

export const photoList = () => z.array(z.string().min(1).max(1000)).max(3);
