import {FormEvent, useCallback, useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Plus} from 'lucide-react';

import {createPet, getPet, PetCreateInput, updatePet} from '../api/pets.api';
import {uploadImage} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {ImagePicker} from '../components/ImagePicker';
import {CatLoader} from '../components/CatLoader';
import {AnimalOption} from '../components/PetMascot';
import {PetAttributeField} from '../components/PetAttributeField';
import {PageTitle} from '../components/ui';

type Form = {
  name: string;
  animal_type: 'dog' | 'cat' | 'other';
  breed: string;
  gender: string;
  color: string;
  birth_date: string;
  weight: string;
  microchip_id: string;
  description: string;
  distinctive_marks: string;
  emergency_note: string;
  is_public: boolean;
};

const EMPTY: Form = {
  name: '',
  animal_type: 'dog',
  breed: '',
  gender: '',
  color: '',
  birth_date: '',
  weight: '',
  microchip_id: '',
  description: '',
  distinctive_marks: '',
  emergency_note: '',
  is_public: true,
};

export default function PetFormPage() {
  const {id} = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pet = useQuery({queryKey: ['pet', id], queryFn: () => getPet(id!), enabled: isEdit});
  const [form, setForm] = useState<Form>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = pet.data;
    if (!p) return;
    setForm({
      name: p.name,
      animal_type: p.animal_type,
      breed: p.breed ?? '',
      gender: p.gender ?? '',
      color: p.color ?? '',
      birth_date: p.birth_date ?? '',
      weight: p.weight != null ? String(Number(p.weight)) : '',
      microchip_id: p.microchip_id ?? '',
      description: p.description ?? '',
      distinctive_marks: p.distinctive_marks ?? '',
      emergency_note: p.emergency_note ?? '',
      is_public: p.is_public,
    });
  }, [pet.data]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({...f, [key]: value}));
  const setBreed = useCallback((v: string) => set('breed', v), []);
  const setColor = useCallback((v: string) => set('color', v), []);
  const chooseAnimal = (animal: Form['animal_type']) =>
    setForm(f => (f.animal_type === animal ? f : {...f, animal_type: animal, breed: '', color: ''}));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const weight = parseWeight(form.weight);
    if (weight === null) {
      setError('น้ำหนักต้องเป็นตัวเลข เช่น 0.5 หรือ 4.2 กก.');
      return;
    }
    if (isEdit && !(await confirmAction({title: `บันทึกการแก้ไข ${form.name.trim() || 'น้อง'}?`, message: 'ข้อมูลใหม่จะแสดงในโปรไฟล์น้องและประกาศที่เกี่ยวข้อง', confirmLabel: 'บันทึก'}))) return;
    setBusy(true);
    setError(null);
    try {
      const payload: PetCreateInput = {
        name: form.name.trim(),
        animal_type: form.animal_type,
        breed: form.breed.trim() || undefined,
        gender: form.gender || undefined,
        color: form.color.trim() || undefined,
        birth_date: form.birth_date || undefined,
        weight,
        microchip_id: form.microchip_id || undefined,
        description: form.description || undefined,
        distinctive_marks: form.distinctive_marks || undefined,
        emergency_note: form.emergency_note || undefined,
        is_public: form.is_public,
      };
      if (photo) payload.profile_image_url = await uploadImage(photo);
      const saved = isEdit ? await updatePet(id!, payload) : await createPet(payload);
      void qc.invalidateQueries({queryKey: ['pets']});
      void qc.invalidateQueries({queryKey: ['pet', saved.id]});
      toast.ok(isEdit ? 'บันทึกแล้ว' : `ยินดีต้อนรับ ${saved.name} เข้าครอบครัว`);
      navigate(`/pets/${saved.id}`, {replace: true});
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isEdit && pet.isLoading) return <CatLoader label="กำลังโหลดข้อมูลน้อง" />;

  return (
    <div className="page">
      <PageTitle title={isEdit ? `แก้ไขข้อมูล ${pet.data?.name ?? ''}` : 'เพิ่มน้องใหม่'} subtitle="ข้อมูลยิ่งครบ ยิ่งช่วยให้น้องกลับบ้านเร็ว" />
      <form className="split" onSubmit={submit}>
        <div className="card form">
          <div className="form-row">
            <label className="field">
              <span>ชื่อน้อง *</span>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </label>
            <div className="field">
              <span>ชนิด</span>
              <div className="chips">
                {(['dog', 'cat', 'other'] as const).map(a => (
                  <button type="button" key={a} className={`chip ${form.animal_type === a ? 'active' : ''}`} onClick={() => chooseAnimal(a)}>
                    <AnimalOption type={a} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-row">
            <PetAttributeField
              key={`${form.animal_type}-breed`}
              animal={form.animal_type}
              attribute="breed"
              label="สายพันธุ์"
              value={form.breed}
              onChange={setBreed}
              freePlaceholder="เช่น กระต่ายฮอลแลนด์ลอป"
            />
            <label className="field">
              <span>เพศ</span>
              <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">ไม่ระบุ</option>
                <option value="male">ผู้</option>
                <option value="female">เมีย</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <PetAttributeField key={`${form.animal_type}-color`} animal={form.animal_type} attribute="color" label="สี" value={form.color} onChange={setColor} />
            <label className="field">
              <span>น้ำหนัก (กก.)</span>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                placeholder="เช่น 0.8 หรือ 4.5"
                value={form.weight}
                onChange={e => {
                  const v = e.target.value.replace(',', '.');
                  if (/^\d{0,3}(\.\d{0,2})?$/.test(v)) set('weight', v);
                }}
              />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              <span>วันเกิด</span>
              <input className="input" type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
            </label>
            <label className="field">
              <span>Microchip ID</span>
              <input className="input" value={form.microchip_id} onChange={e => set('microchip_id', e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>ลักษณะนิสัย / รายละเอียด</span>
            <textarea className="textarea" value={form.description} onChange={e => set('description', e.target.value)} />
          </label>
          <label className="field">
            <span>ตำหนิ / จุดสังเกต</span>
            <input className="input" value={form.distinctive_marks} onChange={e => set('distinctive_marks', e.target.value)} placeholder="เช่น หูซ้ายพับ หางกุด" />
          </label>
          <label className="field">
            <span>หมายเหตุฉุกเฉิน (แสดงบนหน้า QR)</span>
            <input className="input" value={form.emergency_note} onChange={e => set('emergency_note', e.target.value)} placeholder="เช่น แพ้ไก่ ต้องทานยาทุกเช้า" />
          </label>
        </div>
        <div className="card form split-sticky">
          <ImagePicker value={photo} existingUrl={pet.data?.profile_image_url} onChange={setPhoto} label="รูปโปรไฟล์น้อง" height={260} />
          <label className="check">
            <input type="checkbox" checked={form.is_public} onChange={e => set('is_public', e.target.checked)} />
            เปิดหน้า Pet ID สาธารณะ (ให้คนสแกน QR เห็น)
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : <><Plus size={18} /> เพิ่มน้อง</>}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Blank means not given; otherwise a positive number with up to 2 decimals (e.g. 0.1 kg for a kitten). */
function parseWeight(raw: string): number | undefined | null {
  const v = raw.trim().replace(/\.$/, '');
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 500 ? Math.round(n * 100) / 100 : null;
}
