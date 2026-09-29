import {OTHER_OPTION, PetAttribute, petOptions} from '../lib/petOptions';

type Props = {
  animal: string;
  breed: string;
  color: string;
  onBreedChange: (value: string) => void;
  onColorChange: (value: string) => void;
};

const ALL_LABEL: Record<PetAttribute, string> = {breed: 'ทุกสายพันธุ์', color: 'ทุกสี'};

/** Breed and color dropdowns for dog/cat filters; renders nothing for other animals. */
export function BreedColorFilter({animal, breed, color, onBreedChange, onColorChange}: Props) {
  if (!petOptions(animal, 'breed')) return null;
  return (
    <div className="filter-selects">
      <AttributeSelect animal={animal} attribute="breed" value={breed} onChange={onBreedChange} />
      <AttributeSelect animal={animal} attribute="color" value={color} onChange={onColorChange} />
    </div>
  );
}

function AttributeSelect({animal, attribute, value, onChange}: {animal: string; attribute: PetAttribute; value: string; onChange: (value: string) => void}) {
  const options = petOptions(animal, attribute) ?? [];
  return (
    <select
      className={`select select-sm ${value ? 'active' : ''}`}
      value={value}
      aria-label={ALL_LABEL[attribute]}
      onChange={e => onChange(e.target.value)}>
      <option value="">{ALL_LABEL[attribute]}</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>
          {o.th}
        </option>
      ))}
      <option value={OTHER_OPTION}>อื่นๆ</option>
    </select>
  );
}
