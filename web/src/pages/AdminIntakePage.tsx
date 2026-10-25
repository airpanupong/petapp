import {FormEvent, useState} from 'react';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {HeartHandshake, Shield, Siren} from 'lucide-react';

import {adminCreateFoundPost, adminCreateLostPost} from '../api/moderation.api';
import {uploadImage} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {fromLocalInput, toLocalInput} from '../lib/format';
import {downscaleImage} from '../lib/image';
import {isStaff} from '../lib/roles';
import {LatLng} from '../components/MapView';
import {LocationPicker} from '../components/LocationPicker';
import {MultiImagePicker} from '../components/MultiImagePicker';
import {AnimalOption} from '../components/PetMascot';
import {PetAttributeField} from '../components/PetAttributeField';
import {Optional, PageTitle} from '../components/ui';

const RADII = [1, 3, 5, 10, 20];

export default function AdminIntakePage() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [kind, setKind] = useState<'lost' | 'found'>('lost');
  const [name, setName] = useState('');
  const [animal, setAnimal] = useState<'dog' | 'cat' | 'other'>('dog');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [gender, setGender] = useState('');
  const [marks, setMarks] = useState('');
  const [when, setWhen] = useState(toLocalInput());
  const [radius, setRadius] = useState(5);
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState(false);
  const [rewardText, setRewardText] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locationText, setLocationText] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isStaff(user?.role)) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!position) {
      setError(kind === 'lost' ? 'กรุณาปักหมุดตำแหน่งที่หาย' : 'กรุณาปักหมุดตำแหน่งที่พบ');
      return;
    }
    if (!ownerName.trim() || phone.replace(/\D/g, '').length < 8) {
      setError('กรอกชื่อเจ้าของและเบอร์โทรให้ครบ');
      return;
    }
    if (kind === 'lost' && !name.trim()) {
      setError('กรอกชื่อน้อง');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const image_urls = await Promise.all(photos.map(async file => uploadImage(await downscaleImage(file))));
      const privateFields = {
        private_owner_name: ownerName.trim(),
        private_phone: phone.trim(),
        private_link: link.trim() || undefined,
        private_note: note.trim() || undefined,
      };
      const place = {
        latitude: position.latitude,
        longitude: position.longitude,
        location_text: locationText.trim() || undefined,
        image_urls,
      };
      const post =
        kind === 'lost'
          ? await adminCreateLostPost({
              ...privateFields,
              ...place,
              name: name.trim(),
              animal_type: animal,
              breed: breed.trim() || undefined,
              gender: gender || undefined,
              color: color.trim() || undefined,
              distinctive_marks: marks.trim() || undefined,
              lost_at: fromLocalInput(when),
              search_radius_km: radius,
              description: description.trim() || undefined,
              reward_enabled: reward,
              reward_text: reward ? rewardText.trim() || undefined : undefined,
            })
          : await adminCreateFoundPost({
              ...privateFields,
              ...place,
              animal_type: animal,
              breed_guess: breed.trim() || undefined,
              color: color.trim() || undefined,
              description: description.trim() || undefined,
              found_at: fromLocalInput(when),
            });
      void qc.invalidateQueries({queryKey: ['feed']});
      void qc.invalidateQueries({queryKey: ['nearby']});
      toast.ok('เพิ่มประกาศแล้ว');
      navigate(kind === 'lost' ? `/lost/${post.id}` : `/found/${post.id}`, {replace: true});
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageTitle
        title="เพิ่มประกาศโดยแอดมิน"
        subtitle="ประกาศจะแสดงเหมือนประกาศทั่วไป พร้อมป้ายเพิ่มโดยแอดมิน"
        action={
          <Link to="/admin" className="btn btn-soft">
            กลับหน้าแอดมิน
          </Link>
        }
      />
      <form className="split" onSubmit={submit}>
        <div className="card form">
          <div className="chips">
            <button type="button" className={`chip ${kind === 'lost' ? 'active' : ''}`} onClick={() => setKind('lost')}>
              <Siren size={16} /> สัตว์หาย
            </button>
            <button type="button" className={`chip ${kind === 'found' ? 'active' : ''}`} onClick={() => setKind('found')}>
              <HeartHandshake size={16} /> พบสัตว์
            </button>
          </div>
          {kind === 'lost' ? (
            <label className="field">
              <span>ชื่อน้อง</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={120} required />
            </label>
          ) : null}
          <div className="field">
            <span>ชนิด</span>
            <div className="chips">
              {(['dog', 'cat', 'other'] as const).map(a => (
                <button
                  type="button"
                  key={a}
                  className={`chip ${animal === a ? 'active' : ''}`}
                  onClick={() => {
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
              label="สายพันธุ์"
              optional
              value={breed}
              onChange={setBreed}
              freePlaceholder="เช่น กระต่ายฮอลแลนด์ลอป"
            />
            <PetAttributeField
              key={`${animal}-color`}
              animal={animal}
              attribute="color"
              label="สี"
              optional
              value={color}
              onChange={setColor}
            />
          </div>
          {kind === 'lost' ? (
            <div className="form-row">
              <label className="field">
                <span>เพศ <Optional /></span>
                <select className="select" value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">ไม่ระบุ</option>
                  <option value="male">ผู้</option>
                  <option value="female">เมีย</option>
                </select>
              </label>
              <label className="field">
                <span>ตำหนิ / จุดสังเกต <Optional /></span>
                <input className="input" value={marks} onChange={e => setMarks(e.target.value)} placeholder="เช่น หูซ้ายพับ" />
              </label>
            </div>
          ) : null}
          <div className="form-row">
            <label className="field">
              <span>{kind === 'lost' ? 'หายเมื่อ' : 'พบเมื่อ'}</span>
              <input className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required />
            </label>
            {kind === 'lost' ? (
              <label className="field">
                <span>รัศมีแจ้งเตือน</span>
                <select className="select" value={radius} onChange={e => setRadius(Number(e.target.value))}>
                  {RADII.map(r => (
                    <option key={r} value={r}>{r} กม.</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <label className="field">
            <span>รายละเอียดที่แสดงบนเว็บ <Optional /></span>
            <textarea
              className="textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ลักษณะน้อง สถานที่ หรือสิ่งที่อยากให้คนเห็น"
            />
          </label>
          {kind === 'lost' ? (
            <>
              <label className="check">
                <input type="checkbox" checked={reward} onChange={e => setReward(e.target.checked)} /> มีรางวัลสำหรับผู้พบ
              </label>
              {reward ? (
                <input className="input" placeholder="เช่น 3,000 บาท" value={rewardText} onChange={e => setRewardText(e.target.value)} />
              ) : null}
            </>
          ) : null}
          <MultiImagePicker value={photos} onChange={setPhotos} label="รูปน้อง" coverLabel="รูปหน้าปก" large />
          <hr className="form-divider" />
          <div className="admin-private" style={{padding: 14, borderRadius: 16}}>
            <b style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
              <Shield size={16} /> ข้อมูลภายใน แอดมินเห็นเท่านั้น
            </b>
            <p className="muted small">ชื่อเจ้าของ เบอร์โทร ลิงก์ และรายละเอียดนี้จะไม่ถูกแสดงบนเว็บ</p>
            <div className="form-row">
              <label className="field">
                <span>ชื่อเจ้าของ</span>
                <input className="input" value={ownerName} onChange={e => setOwnerName(e.target.value)} maxLength={160} required />
              </label>
              <label className="field">
                <span>เบอร์โทร</span>
                <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} required />
              </label>
            </div>
            <label className="field">
              <span>ลิงก์ <Optional /></span>
              <input className="input" value={link} onChange={e => setLink(e.target.value)} maxLength={500} placeholder="เช่น ลิงก์แชท หรือโพสต์ต้นทาง" />
            </label>
            <label className="field">
              <span>รายละเอียดเพิ่มเติมสำหรับแอดมิน <Optional /></span>
              <textarea
                className="textarea"
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={4000}
                placeholder="โน้ตที่แอดมินคนอื่นควรรู้ เช่น นัดรับ หรือช่องทางติดต่อสำรอง"
              />
            </label>
          </div>
        </div>
        <div className="card form split-sticky">
          <LocationPicker
            value={position}
            onChange={setPosition}
            locationText={locationText}
            onLocationTextChange={setLocationText}
            radiusKm={kind === 'lost' ? radius : undefined}
          />
          {error ? <p className="error-text">{error}</p> : null}
          <button className={`btn btn-block ${kind === 'lost' ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
            {busy ? 'กำลังบันทึก...' : kind === 'lost' ? 'เพิ่มประกาศสัตว์หาย' : 'เพิ่มประกาศพบสัตว์'}
          </button>
        </div>
      </form>
    </div>
  );
}
