import {useEffect, useRef, useState} from 'react';
import {Camera, Crop, ImagePlus} from 'lucide-react';

import {resolveMediaUrl} from '../api/uploads.api';
import {ImageCropper} from './ImageCropper';

type Props = {
  value?: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  label?: string;
  height?: number;
};

// The cropper re-encodes to a ~1600px JPEG, so large camera originals are fine here.
const MAX_BYTES = 25 * 1024 * 1024;

export function ImagePicker({value, existingUrl, onChange, label = 'เพิ่มรูปน้อง', height = 200}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    if (!value) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const shown = preview ?? resolveMediaUrl(existingUrl);

  return (
    <div className="field">
      <label className="image-pick" style={{minHeight: height}}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={e => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (!file) return;
            if (file.size > MAX_BYTES) {
              setError('รูปใหญ่เกิน 25MB');
              return;
            }
            setError(null);
            setSource(file);
            setCropping(true);
          }}
        />
        {shown ? (
          <>
            <img src={shown} alt="preview" />
            <span className="overlay-row">
              {value && source ? (
                <button
                  type="button"
                  className="overlay glass-strong"
                  onClick={e => {
                    e.preventDefault();
                    setCropping(true);
                  }}>
                  <Crop size={13} style={{verticalAlign: -2}} /> ปรับตำแหน่ง
                </button>
              ) : null}
              <span className="overlay glass-strong">
                <Camera size={13} style={{verticalAlign: -2}} /> เปลี่ยนรูป
              </span>
            </span>
          </>
        ) : (
          <div style={{display: 'grid', placeItems: 'center', gap: 6}}>
            <ImagePlus size={30} />
            <b style={{fontWeight: 500}}>{label}</b>
            <span className="muted small">เลือกรูปแล้วเลือกส่วนที่จะขึ้นปกได้</span>
          </div>
        )}
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      {cropping && source ? (
        <ImageCropper
          file={source}
          onCancel={() => setCropping(false)}
          onDone={file => {
            setCropping(false);
            onChange(file);
          }}
        />
      ) : null}
    </div>
  );
}
