import {FormEvent, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {HeartHandshake, Save} from 'lucide-react';

import {createFoundPost, getFoundPost, updateFoundPost} from '../api/community.api';
import {createGuestFoundPost, createGuestSession, guestUploadImage} from '../api/guest.api';
import {Turnstile} from '../components/Turnstile';
import {useRequireLogin} from '../store/loginPromptStore';
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
import {AssembleScope, useAssembleHold} from '../lib/assembleHold';
import {AnimalOption, PetMascot} from '../components/PetMascot';
import {PetAttributeField} from '../components/PetAttributeField';
import {EmptyState, Optional, PageTitle} from '../components/ui';

const ANIMALS = ['dog', 'cat', 'other'] as const;

export default function ReportFoundPage() {
  const {id} = useParams();
  if (id) return <EditFoundPost id={id} />;
  return <FoundPostForm />;
}

function EditFoundPost({id}: {id: string}) {
  const me = useAuthStore(s => s.user);
  const post = useQuery({queryKey: ['found-post', id], queryFn: () => getFoundPost(id)});
  const opening = useAssembleHold(post.isLoading);
  if (opening.show) return <AssembleScope id={opening.id}><CatLoader label="กำลังเปิดประกาศ" /></AssembleScope>;
  if (!post.data) return <EmptyState animal="cat" title="ไม่พบประกาศนี้" />;
  if (post.data.reporter_id !== me?.id) return <EmptyState animal="cat" title="แก้ไขได้เฉพาะผู้โพสต์" />;
  if (post.data.status !== 'active') return <EmptyState animal="cat" title="ประกาศนี้ปิดแล้ว แก้ไขไม่ได้" />;
  return <FoundPostForm key={post.data.id} editing={post.data} />;
}

const LINK = /(https?:\/\/|www\.|line\.me|t\.me\/|bit\.ly|\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|xyz|info|shop|site|online|link|app|top|vip|club|bet)\b)/i;

let guestPass: {token: string; expiresAt: number} | null = null;

function FoundPostForm({editing}: {editing?: FoundPost}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const guest = useAuthStore(s => s.status === 'guest') && !editing;
  const requireLogin = useRequireLogin();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
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

  const guestToken = async () => {
    if (guestPass && guestPass.expiresAt - Date.now() > 60_000) return guestPass.token;
    if (!turnstileToken) throw new Error('กรุณายืนยันว่าไม่ใช่บอทก่อนส่ง');
    setTurnstileToken(null);
    setTurnstileKey(k => k + 1);
    const session = await createGuestSession(turnstileToken);
    guestPass = {token: session.guest_token, expiresAt: Date.parse(session.expires_at)};
    return guestPass.token;
  };

  const submitGuest = async (at: LatLng) => {
    const token = await guestToken();
    const image_urls = [];
    for (const f of photos) image_urls.push(await guestUploadImage(await downscaleImage(f), token));
    return createGuestFoundPost(
      {
        animal_type: animal,
        image_urls,
        found_at: fromLocalInput(foundAt),
        latitude: at.latitude,
        longitude: at.longitude,
        breed_guess: breed.trim() || undefined,
        color: color.trim() || undefined,
        description: description || undefined,
        location_text: locationText || undefined,
      },
      token,
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!position) {
      setError('กรุณาปักหมุดตำแหน่งที่พบ');
      return;
    }
    if (guest && !photos.length) {
      setError('กรุณาเพิ่มรูปน้องอย่างน้อย 1 รูป');
      return;
    }
    if (guest && [description, locationText, breed, color].some(v => LINK.test(v))) {
      setError('ไม่สามารถใส่ลิงก์ในการแจ้งแบบไม่เข้าสู่ระบบได้');
      return;
    }
    if (guest) {
      setBusy(true);
      setError(null);
      try {
        const post = await submitGuest(position);
        void qc.invalidateQueries({queryKey: ['feed']});
        toast.ok('ขอบคุณที่ช่วยแจ้งเบาะแสนะ');
        navigate(`/found/${post.id}`, {replace: true});
      } catch (err) {
        const code = (err as {response?: {data?: {error?: {code?: string}}}}).response?.data?.error?.code;
        if (code?.startsWith('GUEST_TOKEN')) guestPass = null;
        setError(getApiErrorMessage(err));
      } finally {
        setBusy(false);
      }
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
      {guest ? (
        <div className="locked-note" style={{marginBottom: 16}}>
          <PetMascot type="cat" size={40} />
          <span className="grow">
            <b>แจ้งแบบไม่เข้าสู่ระบบเป็นเบาะแสเท่านั้น</b>
            <br />
            เจ้าของจะติดต่อคุณไม่ได้ หากคุณรับน้องไว้ดูแล กรุณาเข้าสู่ระบบเพื่อให้เจ้าของติดต่อกลับได้
          </span>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => requireLogin(() => undefined, 'เข้าสู่ระบบเพื่อให้เจ้าของน้องติดต่อคุณได้')}>
            เข้าสู่ระบบ
          </button>
        </div>
      ) : null}
      <form className="split" onSubmit={submit}>
        <div className="card form">
          <MultiImagePicker
            value={photos}
            onChange={setPhotos}
            existing={keptPhotos}
            onExistingChange={setKeptPhotos}
            label="ถ่ายรูปน้องที่พบ"
            coverLabel="รูปหน้าปก"
            required={guest}
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
              optional
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
              optional
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
            <span>รายละเอียด <Optional /></span>
            <textarea
              className="textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ที่อยู่หรือสถานที่ที่น้องพบ หรือคุณสมบัติที่น้องมี เช่น ปลอกคอสีแดง ขี้กลัวคนแปลกหน้า ชอบขนม..."
            />
          </label>
        </div>
        <div className="card form split-sticky">
          <LocationPicker value={position} onChange={setPosition} locationText={locationText} onLocationTextChange={setLocationText} />
          {guest ? <Turnstile onToken={setTurnstileToken} resetKey={turnstileKey} /> : null}
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
            <button className="btn btn-mint btn-block" disabled={busy || (guest && !turnstileToken && !guestPass)}>
              {busy ? (guest ? 'กำลังตรวจรูปและส่ง...' : 'กำลังโพสต์...') : <><HeartHandshake size={18} /> {guest ? 'ส่งเบาะแส' : 'โพสต์ว่าพบน้อง'}</>}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
