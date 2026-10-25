import {FormEvent, useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Save, Siren} from 'lucide-react';

import {createPet, listPets} from '../api/pets.api';
import {createLostPost, getLostPost, updateLostPost} from '../api/community.api';
import {uploadImage, resolveMediaUrl} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {fromLocalInput, toLocalInput} from '../lib/format';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {useAuthStore} from '../store/authStore';
import {LostPost} from '../types/api';
import {LatLng} from '../components/MapView';
import {LocationPicker} from '../components/LocationPicker';
import {MultiImagePicker} from '../components/MultiImagePicker';
import {downscaleImage} from '../lib/image';
import {CatLoader} from '../components/CatLoader';
import {AssembleScope, useAssembleHold} from '../lib/assembleHold';
import {AnimalOption, PetMascot} from '../components/PetMascot';
import {PetAttributeField} from '../components/PetAttributeField';
import {EmptyState, Optional, PageTitle} from '../components/ui';

const RADII = [1, 3, 5, 10, 20];

type NewPet = {
  name: string;
  animal_type: 'dog' | 'cat' | 'other';
  breed: string;
  color: string;
  gender: string;
  distinctive_marks: string;
};

const NEW_PET: NewPet = {name: '', animal_type: 'dog', breed: '', color: '', gender: '', distinctive_marks: ''};

export default function ReportLostPage() {
  const {id} = useParams();
  if (id) return <EditLostPost id={id} />;
  return <LostPostForm />;
}

function EditLostPost({id}: {id: string}) {
  const me = useAuthStore(s => s.user);
  const post = useQuery({queryKey: ['lost-post', id], queryFn: () => getLostPost(id)});
  const opening = useAssembleHold(post.isLoading);
  if (opening.show) return <AssembleScope id={opening.id}><CatLoader label="กำลังเปิดประกาศ" /></AssembleScope>;
  if (!post.data) return <EmptyState animal="cat" title="ไม่พบประกาศนี้" />;
  if (post.data.owner_id !== me?.id) return <EmptyState animal="cat" title="แก้ไขได้เฉพาะเจ้าของประกาศ" />;
  if (post.data.status !== 'active') return <EmptyState animal="cat" title="ประกาศนี้ปิดแล้ว แก้ไขไม่ได้" />;
  return <LostPostForm key={post.data.id} editing={post.data} />;
}

function LostPostForm({editing}: {editing?: LostPost}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const pets = useQuery({queryKey: ['pets'], queryFn: listPets, enabled: !editing});

  const [petId, setPetId] = useState(editing?.pet_id ?? params.get('pet') ?? '');
  const [lostAt, setLostAt] = useState(toLocalInput(editing ? new Date(editing.lost_at) : undefined));
  const [position, setPosition] = useState<LatLng | null>(
    editing ? {latitude: editing.latitude, longitude: editing.longitude} : null,
  );
  const [locationText, setLocationText] = useState(editing?.location_text ?? '');
  const [radius, setRadius] = useState(editing?.search_radius_km ?? 3);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [reward, setReward] = useState(editing?.reward_enabled ?? false);
  const [rewardText, setRewardText] = useState(editing?.reward_text ?? '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<string[]>(editing?.image_urls ?? (editing?.image_url ? [editing.image_url] : []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPet, setNewPet] = useState<NewPet>(NEW_PET);
  // Keeps a retry after a failed post from registering the same pet twice.
  const createdPetId = useRef<string | null>(null);

  const available = pets.data?.filter(p => p.status !== 'lost') ?? [];
  const needsPet = !editing && pets.isSuccess && !available.length;
  const setPetField = <K extends keyof NewPet>(key: K, value: NewPet[K]) => setNewPet(f => ({...f, [key]: value}));
  const setNewBreed = useCallback((v: string) => setPetField('breed', v), []);
  const setNewColor = useCallback((v: string) => setPetField('color', v), []);
  const chooseAnimal = (animal: NewPet['animal_type']) =>
    setNewPet(f => (f.animal_type === animal ? f : {...f, animal_type: animal, breed: '', color: ''}));
  useEffect(() => {
    if (!editing && !petId && available[0]) setPetId(available[0].id);
  }, [available, petId, editing]);

  const radii = RADII.includes(radius) ? RADII : [...RADII, radius].sort((a, b) => a - b);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (needsPet && !newPet.name.trim()) {
      setError('กรุณาใส่ชื่อน้อง');
      return;
    }
    if (!needsPet && !petId) {
      setError('กรุณาเลือกน้องที่หาย');
      return;
    }
    if (!position) {
      setError('กรุณาปักหมุดตำแหน่งที่น้องหาย');
      return;
    }
    if (editing) {
      const ok = await confirmAction({
        title: 'บันทึกการแก้ไข?',
        message: `ข้อมูลประกาศตามหา ${editing.pet?.name ?? ''} จะถูกอัปเดตทันที`,
        confirmLabel: 'บันทึก',
        tone: 'primary',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploaded = await Promise.all(photos.map(async f => uploadImage(await downscaleImage(f))));
      let lostPetId = petId;
      if (needsPet) {
        createdPetId.current ??= (
          await createPet({
            name: newPet.name.trim(),
            animal_type: newPet.animal_type,
            breed: newPet.breed.trim() || undefined,
            color: newPet.color.trim() || undefined,
            gender: newPet.gender || undefined,
            distinctive_marks: newPet.distinctive_marks.trim() || undefined,
            profile_image_url: uploaded[0],
          })
        ).id;
        lostPetId = createdPetId.current;
      }
      const fields = {
        lost_at: fromLocalInput(lostAt),
        latitude: position.latitude,
        longitude: position.longitude,
        search_radius_km: radius,
        reward_enabled: reward,
        image_urls: [...keptPhotos, ...uploaded],
      };
      const post = editing
        ? await updateLostPost(editing.id, {
            ...fields,
            location_text: locationText || null,
            description: description || null,
            reward_text: reward ? rewardText || null : null,
          })
        : await createLostPost({
            ...fields,
            pet_id: lostPetId,
            location_text: locationText || undefined,
            description: description || undefined,
            reward_text: reward ? rewardText : undefined,
          });
      void qc.invalidateQueries({queryKey: ['feed']});
      void qc.invalidateQueries({queryKey: ['lost-post', post.id]});
      void qc.invalidateQueries({queryKey: ['my-posts']});
      void qc.invalidateQueries({queryKey: ['pets']});
      toast.ok(editing ? 'บันทึกการแก้ไขแล้ว' : 'ประกาศแล้ว ขอให้เจอน้องเร็ว ๆ นะ');
      navigate(`/lost/${post.id}`, {replace: true});
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loadingPets = useAssembleHold(!editing && pets.isLoading);
  if (loadingPets.show) return <AssembleScope id={loadingPets.id}><CatLoader label="กำลังโหลดรายชื่อน้อง" /></AssembleScope>;

  return (
    <div className="page">
      <PageTitle
        title={editing ? `แก้ไขประกาศตามหา ${editing.pet?.name ?? ''}` : 'แจ้งน้องหาย'}
        subtitle={editing ? 'แก้ตำแหน่ง รายละเอียด หรือรูปได้ตลอดจนกว่าจะเจอน้อง' : 'ใจเย็น ๆ นะ เราจะช่วยกระจายข่าวให้คนแถวนั้น'}
      />
      <form className="split" onSubmit={submit}>
        <div className="card form">
          {needsPet ? (
            <>
              <div className="new-pet-intro">
                <PetMascot type={newPet.animal_type} size={44} />
                <div>
                  <b>บอกข้อมูลน้องหน่อย</b>
                  <p className="muted small">
                    {pets.data?.length ? 'น้องทุกตัวของคุณมีประกาศตามหาอยู่แล้ว ' : 'ยังไม่มีน้องในบัญชี '}
                    กรอกข้อมูลน้องตรงนี้ได้เลย เราจะบันทึกไว้ใน "น้องของฉัน" ให้ด้วย
                  </p>
                </div>
              </div>
              <div className="form-row">
                <label className="field">
                  <span>ชื่อน้อง</span>
                  <input className="input" value={newPet.name} onChange={e => setPetField('name', e.target.value)} maxLength={120} required />
                </label>
                <div className="field">
                  <span>ชนิด</span>
                  <div className="chips">
                    {(['dog', 'cat', 'other'] as const).map(a => (
                      <button type="button" key={a} className={`chip ${newPet.animal_type === a ? 'active' : ''}`} onClick={() => chooseAnimal(a)}>
                        <AnimalOption type={a} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <PetAttributeField
                  key={`${newPet.animal_type}-breed`}
                  animal={newPet.animal_type}
                  attribute="breed"
                  label="สายพันธุ์"
                  optional
                  value={newPet.breed}
                  onChange={setNewBreed}
                  freePlaceholder="เช่น กระต่ายฮอลแลนด์ลอป"
                />
                <PetAttributeField
                  key={`${newPet.animal_type}-color`}
                  animal={newPet.animal_type}
                  attribute="color"
                  label="สี"
                  optional
                  value={newPet.color}
                  onChange={setNewColor}
                />
              </div>
              <div className="form-row">
                <label className="field">
                  <span>เพศ <Optional /></span>
                  <select className="select" value={newPet.gender} onChange={e => setPetField('gender', e.target.value)}>
                    <option value="">ไม่ระบุ</option>
                    <option value="male">ผู้</option>
                    <option value="female">เมีย</option>
                  </select>
                </label>
                <label className="field">
                  <span>ตำหนิ / จุดสังเกต <Optional /></span>
                  <input
                    className="input"
                    value={newPet.distinctive_marks}
                    onChange={e => setPetField('distinctive_marks', e.target.value)}
                    placeholder="เช่น หูซ้ายพับ หางกุด"
                  />
                </label>
              </div>
              <hr className="form-divider" />
            </>
          ) : editing ? null : (
            <div className="field">
              <span>น้องตัวไหนหาย?</span>
              <div className="chips">
                {available.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    className={`chip ${petId === p.id ? 'active' : ''}`}
                    onClick={() => setPetId(p.id)}
                    style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                    {p.profile_image_url ? (
                      <img src={resolveMediaUrl(p.profile_image_url)} alt="" style={{width: 22, height: 22, borderRadius: '50%', objectFit: 'cover'}} />
                    ) : (
                      <PetMascot type={p.animal_type} size={22} />
                    )}
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-row">
            <label className="field">
              <span>หายเมื่อ</span>
              <input className="input" type="datetime-local" value={lostAt} onChange={e => setLostAt(e.target.value)} required />
            </label>
            <label className="field">
              <span>รัศมีแจ้งเตือน</span>
              <select className="select" value={radius} onChange={e => setRadius(Number(e.target.value))}>
                {radii.map(r => (
                  <option key={r} value={r}>{r} กม.</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>รายละเอียด <Optional /></span>
            <textarea
              className="textarea"
              placeholder="ที่อยู่หรือสถานที่ที่น้องหาย หรือคุณสมบัติที่น้องมี เช่น ปลอกคอสีแดง ขี้กลัวคนแปลกหน้า ชอบขนม..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={reward} onChange={e => setReward(e.target.checked)} /> มีรางวัลสำหรับผู้พบ
          </label>
          {reward ? (
            <input className="input" placeholder="เช่น 3,000 บาท" value={rewardText} onChange={e => setRewardText(e.target.value)} />
          ) : null}
          <MultiImagePicker
            value={photos}
            onChange={setPhotos}
            existing={keptPhotos}
            onExistingChange={setKeptPhotos}
            label="รูปล่าสุดของน้อง"
            coverLabel="รูปหน้าปก"
            large
          />
          <p className="muted small" style={{marginTop: -6}}>
            {needsPet ? 'รูปแรกจะใช้เป็นรูปโปรไฟล์ของน้องด้วย' : 'ถ้าไม่ใส่รูป จะใช้รูปโปรไฟล์ของน้องแทน'}
          </p>
        </div>

        <div className="card form split-sticky">
          <LocationPicker
            value={position}
            onChange={setPosition}
            locationText={locationText}
            onLocationTextChange={setLocationText}
            radiusKm={radius}
          />
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
            <button className="btn btn-danger btn-block" disabled={busy}>
              {busy ? 'กำลังประกาศ...' : <><Siren size={18} /> ประกาศตามหาน้อง</>}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
