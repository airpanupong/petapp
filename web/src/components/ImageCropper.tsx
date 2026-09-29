import {PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState, WheelEvent} from 'react';
import {Maximize, Minimize, ZoomIn, ZoomOut} from 'lucide-react';

import {Modal} from './ui';

const OUT_WIDTH = 1600;
const MAX_ZOOM = 4;
const FILL = '#fff4ec';

type Point = {x: number; y: number};

/** Pick which part of a photo becomes the cover. Zoom below 1 fits the whole photo with padding. */
export function ImageCropper({file, aspect = 4 / 3, onCancel, onDone}: {
  file: File;
  aspect?: number;
  onCancel: () => void;
  onDone: (file: File) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{dist: number; zoom: number} | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{w: number; h: number} | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({x: 0, y: 0});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({w: img.naturalWidth, h: img.naturalHeight});
    };
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setFrameW(el.clientWidth));
    observer.observe(el);
    setFrameW(el.clientWidth);
    return () => observer.disconnect();
  }, [url]);

  const frameH = frameW / aspect;
  const cover = natural && frameW ? Math.max(frameW / natural.w, frameH / natural.h) : 1;
  const contain = natural && frameW ? Math.min(frameW / natural.w, frameH / natural.h) : 1;
  const minZoom = contain / cover;
  const scale = cover * zoom;
  const drawW = (natural?.w ?? 0) * scale;
  const drawH = (natural?.h ?? 0) * scale;

  const clamp = useCallback(
    (p: Point): Point => {
      const maxX = Math.max(0, (drawW - frameW) / 2);
      const maxY = Math.max(0, (drawH - frameH) / 2);
      return {x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y))};
    },
    [drawW, drawH, frameW, frameH],
  );

  useEffect(() => setOffset(o => clamp(o)), [clamp]);

  const setZoomClamped = (z: number) => setZoom(Math.min(MAX_ZOOM, Math.max(minZoom, z)));

  const onPointerDown = (e: PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {dist: Math.hypot(a.x - b.x, a.y - b.y), zoom};
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = {x: e.clientX, y: e.clientY};
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomClamped((pinchStart.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinchStart.current.dist);
    } else if (pointers.current.size === 1) {
      setOffset(o => clamp({x: o.x + next.x - prev.x, y: o.y + next.y - prev.y}));
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  const onWheel = (e: WheelEvent) => setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));

  const confirm = async () => {
    const img = imgRef.current;
    if (!img || !frameW) return;
    setBusy(true);
    const k = OUT_WIDTH / frameW;
    const canvas = document.createElement('canvas');
    canvas.width = OUT_WIDTH;
    canvas.height = Math.round(OUT_WIDTH / aspect);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = FILL;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (frameW / 2 + offset.x - drawW / 2) * k, (frameH / 2 + offset.y - drawH / 2) * k, drawW * k, drawH * k);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    setBusy(false);
    if (!blob) return;
    onDone(new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, {type: 'image/jpeg'}));
  };

  return (
    <Modal open onClose={onCancel} title="เลือกส่วนที่จะขึ้นปก">
      <div className="cropper">
        <div
          ref={frameRef}
          className="cropper-frame"
          style={{aspectRatio: String(aspect)}}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}>
          {url && natural ? (
            <img
              src={url}
              alt=""
              draggable={false}
              style={{
                width: drawW,
                height: drawH,
                left: frameW / 2 + offset.x - drawW / 2,
                top: frameH / 2 + offset.y - drawH / 2,
              }}
            />
          ) : null}
          <div className="cropper-grid" aria-hidden />
        </div>
        <p className="muted small" style={{textAlign: 'center'}}>
          ลากรูปเพื่อเลือกส่วนที่จะแสดง · ซูมออกสุดเพื่อให้เห็นทั้งรูป
        </p>
        <div className="cropper-zoom">
          <ZoomOut size={18} />
          <input
            type="range"
            min={minZoom}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={e => setZoomClamped(Number(e.target.value))}
            aria-label="ซูม"
          />
          <ZoomIn size={18} />
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-soft btn-sm" onClick={() => { setZoom(minZoom); setOffset({x: 0, y: 0}); }}>
            <Minimize size={15} /> พอดีทั้งรูป
          </button>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => { setZoom(1); setOffset({x: 0, y: 0}); }}>
            <Maximize size={15} /> เต็มกรอบ
          </button>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void confirm()} disabled={busy || !natural}>
            {busy ? 'กำลังเตรียมรูป...' : 'ใช้รูปนี้'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
