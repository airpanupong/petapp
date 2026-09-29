import {useEffect, useMemo, useState} from 'react';
import {ImagePlus, X} from 'lucide-react';

import {resolveMediaUrl} from '../api/uploads.api';
import {Lightbox} from './MediaImage';

const MAX_BYTES = 25 * 1024 * 1024;

export function MultiImagePicker({
  value,
  onChange,
  existing = [],
  onExistingChange,
  max = 3,
  label = 'แนบรูป',
  coverLabel,
  large,
}: {
  value: File[];
  onChange: (files: File[]) => void;
  /** Already-uploaded photos, shown before the new files. */
  existing?: string[];
  onExistingChange?: (urls: string[]) => void;
  max?: number;
  label?: string;
  coverLabel?: string;
  /** Three equal tiles across the form instead of small thumbnails. */
  large?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const previews = useMemo(() => value.map(f => URL.createObjectURL(f)), [value]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);
  const count = existing.length + value.length;

  return (
    <div className="field">
      <span>
        {label} <span className="muted small">(ไม่บังคับ · สูงสุด {max} รูป)</span>
      </span>
      <div className={`multi-pick ${large ? 'multi-pick-lg' : ''}`}>
        {existing.map((url, i) => {
          const src = resolveMediaUrl(url)!;
          return (
            <div key={url} className="multi-pick-item">
              <img src={src} alt={`รูปที่ ${i + 1}`} onClick={() => setZoom(src)} />
              {coverLabel && i === 0 ? <span className="multi-pick-cover">{coverLabel}</span> : null}
              <button
                type="button"
                className="multi-pick-remove"
                aria-label="ลบรูป"
                onClick={() => onExistingChange?.(existing.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          );
        })}
        {previews.map((src, i) => (
          <div key={src} className="multi-pick-item">
            <img src={src} alt={`รูปที่ ${existing.length + i + 1}`} onClick={() => setZoom(src)} />
            {coverLabel && !existing.length && i === 0 ? <span className="multi-pick-cover">{coverLabel}</span> : null}
            <button
              type="button"
              className="multi-pick-remove"
              aria-label="ลบรูป"
              onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X size={14} />
            </button>
          </div>
        ))}
        {count < max ? (
          <label className="multi-pick-add">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={e => {
                const files = [...(e.target.files ?? [])];
                e.target.value = '';
                const ok = files.filter(f => f.size <= MAX_BYTES);
                const room = max - count;
                setError(
                  ok.length < files.length
                    ? 'บางรูปใหญ่เกิน 25MB'
                    : ok.length > room
                      ? `แนบได้สูงสุด ${max} รูป`
                      : null,
                );
                if (ok.length) onChange([...value, ...ok.slice(0, room)]);
              }}
            />
            <ImagePlus size={22} />
            <span className="small">
              {count}/{max}
            </span>
          </label>
        ) : null}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {zoom ? <Lightbox src={zoom} alt="รูปที่แนบ" onClose={() => setZoom(null)} /> : null}
    </div>
  );
}

/** Thumbnails of already-uploaded photos that open full screen when tapped. */
export function PhotoStrip({urls, alt}: {urls: string[]; alt: string}) {
  const [zoom, setZoom] = useState<string | null>(null);
  if (!urls.length) return null;
  return (
    <div className="multi-pick">
      {urls.map((src, i) => (
        <div key={src} className="multi-pick-item">
          <img src={src} alt={`${alt} ${i + 1}`} loading="lazy" onClick={() => setZoom(src)} />
        </div>
      ))}
      {zoom ? <Lightbox src={zoom} alt={alt} onClose={() => setZoom(null)} /> : null}
    </div>
  );
}
