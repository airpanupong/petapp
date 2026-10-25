// Breed/color filter matching; mirrors web/src/lib/petOptions.ts via the shared option list.
import options from '../data/pet_options.json';

type Option = {id: string; th: string; en: string; aliases?: string[]};
type Options = Record<string, Record<string, Option[]>>;

const OTHER_OPTION = 'other';
const all = options as Options;

const key = (value: string) => value.toLowerCase().replace(/สี|ปลอด|\s|-/g, '');

function find(list: Option[], value: string): Option | null {
  const v = value.trim().toLowerCase();
  for (const o of list) {
    if (o.th.toLowerCase() === v || o.en.toLowerCase() === v || o.id === v) return o;
  }
  // Older posts were typed freely ("ดำ", "แมนคูน"), so compare against each part of a label.
  const k = key(value);
  for (const o of list) {
    for (const label of [o.th, o.en, ...(o.aliases ?? [])]) {
      if ([label, ...label.split(/[/()]/)].some(part => key(part) === k)) return o;
    }
  }
  return null;
}

/** `filter` is an option id, "other" for typed-in values, or empty for anything. */
export function matchesPetOption(
  animal: string | null | undefined,
  attribute: string,
  value: string | null | undefined,
  filter: string | null | undefined,
): boolean {
  if (!filter) return true;
  const list = all[animal ?? '']?.[attribute];
  if (!list || !(value ?? '').trim()) return false;
  const hit = find(list, value ?? '');
  return filter === OTHER_OPTION ? hit === null : hit !== null && hit.id === filter;
}
