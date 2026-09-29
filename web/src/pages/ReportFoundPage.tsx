import {FormEvent, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {HeartHandshake, Save} from 'lucide-react';

import {createFoundPost, getFoundPost, updateFoundPost} from '../api/community.api';
import {uploadImage} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {fromLocalInput, toLocalInput} from '../lib/format';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {useAuthStore} from '../store/authStore';
import {FoundPost} from '../types/api';
import {LatLng} from '../components/MapView';
import {LocationPicker} from '../components/LocationPicker';
import {MultiImagePicker} from '../components/MultiImagePicker';
import {downscaleImage} from '../lib/image';
import {CatLoader} from '../components/CatLoader';
import {AnimalOption} from '../components/PetMascot';
import {PetAttributeField} from '../components/PetAttributeField';
import {EmptyState, PageTitle} from '../components/ui';

const ANIMALS = ['dog', 'cat', 'other'] as const;

export default function ReportFoundPage() {
  const {id} = useParams();
  if (id) return <EditFoundPost id={id} />;
  return <FoundPostForm />;
}

function EditFoundPost({id}: {id: string}) {
  const me = useAuthStore(s => s.user);
  const post = useQuery({queryKey: ['found-post', id], queryFn: () => getFoundPost(id)});
  if (post.isLoading) return <CatLoader label="กำลังเปิดประกาศ" />;
  if (!post.data) return <EmptyState animal="cat" title="ไม่พบประกาศนี้" />;
  if (post.data.reporter_id !== me?.id) return <EmptyState animal="cat" title="แก้ไขได้เฉพาะผู้โพสต์" />;
  if (post.data.status !== 'active') return <EmptyState animal="cat" title="ประกาศนี้ปิดแล้ว แก้ไขไม่ได้" />;
  return <FoundPostForm key={post.data.id} editing={post.data} />;
}

function FoundPostForm({editing}: {editing?: FoundPost}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [animal, setAnimal] = useState<'dog' | 'cat' | 'other'>(editing?.animal_type ?? 'dog');
  const [breed, setBreed] = useState(editing?.breed_guess ?? '');
  const [color, setColor] = useState(editing?.color ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [foundAt, setFoundAt] = useState(toLocalInput(editing ? new Date(editing.found_at) : undefined));
  const [position, setPosition] = useState<LatLng | null>(
    editing ? {latitude: editing.latitude, longitude: editing.longitude} : null,
  );
  const [locationText, setLocationText] = useState(editing?.location_text ?? '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<string[]>(editing?.image_urls ?? (editing?.image_url ? [editing.image_url] : []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!position) {
      setError('กรุณาปักหมุดตำแหน่งที่พบ');
      return;
    }
    if (editing) {
      const ok = await confirmAction({
        title: 'บันทึกการแก้ไข?',
        message: 'ข้อมูลประกาศพบน้องจะถูกอัปเดตทันที',
        confirmLabel: 'บันทึก',
        tone: 'primary',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploaded = await Promise.all(photos.map(async f => uploadImage(await downscaleImage(f))));
      const fields = {
        animal_type: animal,
        image_urls: [...keptPhotos, ...uploaded],
        found_at: fromLocalInput(foundAt),
        latitude: position.latitude,
        longitude: position.longitude,
      };
      const post = editing
        ? await updateFoundPost(editing.id, {
            ...fields,
            breed_guess: breed.trim() || null,
            color: color.trim() || null,
            description: description || null,
            location_text: locationText || null,
          })
        : await createFoundPost({
            ...fields,
            breed_guess: breed.trim() || undefined,
            color: color.trim() || undefined,
            description: description || undefined,
            location_text: locationText || undefined,
          });
      void qc.invalidateQueries({queryKey: ['feed']});
      void qc.invalidateQueries({queryKey: ['found-post', post.id]});
      void qc.invalidateQueries({queryKey: ['my-posts']});
      toast.ok(editing ? 'บันทึกการแก้ไขแล้ว' : 'ขอบคุณที่ช่วยน้องนะ');
      navigate(`/found/${post.id}`, {replace: true});
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageTitle
        title={editing ? 'แก้ไขประกาศพบน้อง' : 'ฉันพบน้อง'}
        subtitle={editing ? 'อัปเดตรูป ตำแหน่ง หรือรายละเอียดให้ชัดขึ้น' : 'ขอบคุณที่ใจดี รูปชัด ๆ ช่วยให้เจ้าของจำน้องได้เร็วขึ้น'}
      />
      <form className="split" onSubmit={submit}>
        <div className="card form">
          <MultiImagePicker
            value={photos}
            onChange={setPhotos}
            existing={keptPhotos}
            onExistingChange={setKeptPhotos}
            label="ถ่ายรูปน้องที่พบ"
            coverLabel="รูปหน้าปก"
            large
          />
          <div className="field">
            <span>ชนิดสัตว์</span>
            <div className="chips">
              {ANIMALS.map(a => (
                <button type="button" key={a} className={`chip ${animal === a ? 'active' : ''}`} onClick={() => {
                    if (a === animal) return;
                    setAnimal(a);
                    setBreed('');
                    setColor('');
                  }}>
                  <AnimalOption type={a} />
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <PetAttributeField
              key={`${animal}-breed`}
              animal={animal}
              attribute="breed"
              label="สายพันธุ์ (ถ้าพอเดาได้)"
              value={breed}
              onChange={setBreed}
              emptyLabel="ไม่แน่ใจ"
              freePlaceholder="เช่น กระต่าย"
            />
            <PetAttributeField
              key={`${animal}-color`}
              animal={animal}
              attribute="color"
              label="สี"
              value={color}
              onChange={setColor}
              emptyLabel="ไม่แน่ใจ"
              freePlaceholder="เช่น ขาว-เทา"
            />
          </div>
          <label className="field">
            <span>พบเมื่อ</span>
            <input className="input" type="datetime-local" value={foundAt} onChange={e => setFoundAt(e.target.value)} required />
          </label>
          <label className="field">
            <span>รายละเอียด</span>
            <textarea
              className="textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ใส่ปลอกคอ? ตอนนี้น้องอยู่กับใคร?"
            />
          </label>
        </div>
        <div className="card form split-sticky">
          <LocationPicker value={position} onChange={setPosition} locationText={locationText} onLocationTextChange={setLocationText} />
          {error ? <p className="error-text">{error}</p> : null}
          {editing ? (
            <div className="btn-row">
              <button type="button" className="btn btn-soft" onClick={() => navigate(-1)} disabled={busy}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'กำลังบันทึก...' : <><Save size={18} /> บันทึกการแก้ไข</>}
              </button>
            </div>
          ) : (
            <button className="btn btn-mint btn-block" disabled={busy}>
              {busy ? 'กำลังโพสต์...' : <><HeartHandshake size={18} /> โพสต์ว่าพบน้อง</>}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
