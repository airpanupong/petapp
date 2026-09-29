import {CSSProperties} from 'react';

import {animalLabel} from '../lib/format';

export type MascotType = 'dog' | 'cat' | 'other';

export function mascotKey(type?: string | null): MascotType {
  return type === 'dog' || type === 'cat' ? type : 'other';
}

export function mascotSrc(type?: string | null, small = false) {
  return `/mascots/${mascotKey(type)}${small ? '-sm' : ''}.webp`;
}

type Props = {
  type?: string | null;
  /** Pixel size, or 'fill' to let CSS size it (keeps a 1:1 aspect ratio). */
  size?: number | 'fill';
  className?: string;
  style?: CSSProperties;
};

export function PetMascot({type, size = 96, className = '', style}: Props) {
  const fixed = typeof size === 'number';
  return (
    <img
      className={`mascot ${fixed ? '' : 'mascot-fill'} ${className}`}
      src={mascotSrc(type, fixed && size <= 48)}
      alt={animalLabel(type)}
      width={fixed ? size : 512}
      height={fixed ? size : 512}
      style={fixed ? {width: size, height: size, ...style} : style}
      draggable={false}
    />
  );
}

export function MediaPlaceholder({type}: {type?: string | null}) {
  return <PetMascot type={type} size="fill" className="media-mascot" />;
}

export function AnimalOption({type, label}: {type: string; label?: string}) {
  return (
    <span className="animal-option">
      <PetMascot type={type} size={22} />
      {label ?? animalLabel(type)}
    </span>
  );
}
