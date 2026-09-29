import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {Expand, X} from 'lucide-react';

import {MediaPlaceholder} from './PetMascot';

export function Lightbox({src, alt, onClose}: {src: string; alt: string; onClose: () => void}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="ปิด">
        <X size={22} />
      </button>
      <img src={src} alt={alt} onClick={e => e.stopPropagation()} />
    </div>,
    document.body,
  );
}

/** Photo with a mascot fallback when missing or broken; `zoomable` opens it full screen. */
export function MediaImage({src, alt, type, zoomable, lazy}: {
  src?: string | null;
  alt: string;
  type?: string | null;
  zoomable?: boolean;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <MediaPlaceholder type={type} />;

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading={lazy ? 'lazy' : undefined}
        onError={() => setFailed(true)}
        className={zoomable ? 'zoomable' : undefined}
        onClick={zoomable ? () => setOpen(true) : undefined}
      />
      {zoomable ? (
        <button type="button" className="media-zoom glass-strong" onClick={() => setOpen(true)} aria-label="ดูรูปใหญ่">
          <Expand size={16} />
        </button>
      ) : null}
      {open ? <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Large post photo with thumbnails to switch between up to a few photos. */
export function PostGallery({urls, alt, type, background}: {
  urls: string[];
  alt: string;
  type?: string | null;
  background?: string;
}) {
  const [index, setIndex] = useState(0);
  const current = urls[Math.min(index, urls.length - 1)];
  return (
    <div className="post-gallery">
      <div className="detail-media" style={background ? {background} : undefined}>
        <MediaImage src={current} alt={alt} type={type} zoomable />
        {urls.length > 1 ? <span className="gallery-count glass-strong">{Math.min(index, urls.length - 1) + 1}/{urls.length}</span> : null}
      </div>
      {urls.length > 1 ? (
        <div className="gallery-thumbs">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`gallery-thumb ${url === current ? 'active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`ดูรูปที่ ${i + 1}`}>
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
