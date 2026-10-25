// Every stored timestamp uses Date#toISOString() ("2026-10-01T12:00:00.000Z") so text order is time order.

export function now(): string {
  return new Date().toISOString();
}

export function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export const DAY_MS = 24 * 60 * 60 * 1000;

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Parses an ISO date-time; values without a zone are UTC, like naive datetimes stored in timestamptz. */
export function parseDateTime(value: string): string | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?/.test(v)) return null;
  let text = v.replace(' ', 'T');
  if (!text.includes('T')) text += 'T00:00:00';
  if (!HAS_ZONE.test(text)) text += 'Z';
  // Date.parse handles at most millisecond precision.
  text = text.replace(/(\.\d{3})\d+/, '$1');
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** strftime("%d %b %Y") in UTC. */
export function formatDayMonYear(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
