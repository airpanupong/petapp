import {useEffect, useState} from 'react';

import {findPetOption, OTHER_OPTION, PetAttribute, petOptions} from '../lib/petOptions';

const PLACEHOLDER: Record<PetAttribute, string> = {
  breed: 'พิมพ์สายพันธุ์',
  color: 'พิมพ์สี / ลาย',
};

/** Breed or color picker from the master list; "อื่นๆ" (and animals without a list) switch to typing it in. */
export function PetAttributeField({
  animal,
  attribute,
  label,
  value,
  onChange,
  emptyLabel = 'ไม่ระบุ',
  freePlaceholder,
}: {
  animal: string;
  attribute: PetAttribute;
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  freePlaceholder?: string;
}) {
  const options = petOptions(animal, attribute);
  const matched = options ? findPetOption(options, value) : undefined;
  const [typing, setTyping] = useState(() => !!value.trim() && !matched);

  useEffect(() => {
    if (!options) return;
    if (matched && matched.th !== value) onChange(matched.th);
    else if (!matched && value.trim()) setTyping(true);
  }, [options, matched, value, onChange]);

  if (!options) {
    return (
      <label className="field">
        <span>{label}</span>
        <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={freePlaceholder} maxLength={120} />
      </label>
    );
  }

  const selected = matched ? matched.id : typing ? OTHER_OPTION : '';
  return (
    <div className="field">
      <span>{label}</span>
      <select
        className="select"
        aria-label={label}
        value={selected}
        onChange={e => {
          const id = e.target.value;
          if (id === OTHER_OPTION) {
            setTyping(true);
            onChange('');
            return;
          }
          setTyping(false);
          onChange(options.find(o => o.id === id)?.th ?? '');
        }}>
        <option value="">{emptyLabel}</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.th}
          </option>
        ))}
        <option value={OTHER_OPTION}>อื่นๆ (พิมพ์เอง)</option>
      </select>
      {selected === OTHER_OPTION ? (
        <input
          className="input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={PLACEHOLDER[attribute]}
          aria-label={`${label} (อื่นๆ)`}
          maxLength={120}
          required
          autoFocus={!value}
        />
      ) : null}
    </div>
  );
}
