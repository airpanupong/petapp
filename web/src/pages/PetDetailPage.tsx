import {FormEvent, useEffect, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {QRCodeCanvas} from 'qrcode.react';
import {Ambulance, ClipboardList, Download, Pencil, Siren, Stethoscope, Syringe, Trash2, Copy, Users} from 'lucide-react';

import {getPet} from '../api/pets.api';
import {
  addGuardian,
  addVaccination,
  getEmergencyInfo,
  getHealth,
  listGuardians,
  listVaccinations,
  removeGuardian,
  removeVaccination,
  updateEmergencyInfo,
  updateHealth,
} from '../api/features.api';
import {resolveMediaUrl} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {animalLabel, formatDate} from '../lib/format';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {CatLoader} from '../components/CatLoader';
import {MediaImage} from '../components/MediaImage';
import {Avatar, EmptyState, StatusBadge} from '../components/ui';

type Tab = 'info' | 'health' | 'emergency' | 'guardians';

export default function PetDetailPage() {
  const {id = ''} = useParams();
  const navigate = useNavigate();
  const pet = useQuery({queryKey: ['pet', id], queryFn: () => getPet(id)});
  const [tab, setTab] = useState<Tab>('info');
  const qrRef = useRef<HTMLDivElement>(null);

  if (pet.isLoading) return <CatLoader label="กำลังเรียกน้องมา" />;
  if (!pet.data) return <EmptyState animal="cat" title="ไม่พบข้อมูลน้อง" />;
  const p = pet.data;
  const publicUrl = `${window.location.origin}/p/${p.qr_token}`;
  const img = resolveMediaUrl(p.profile_image_url);

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `petapp-${p.pet_code}.png`;
    a.click();
  };

  return (
    <div className="page">
      <div className="split">
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div className="detail-media"><MediaImage src={img} alt={p.name} type={p.animal_type} zoomable /></div>
          <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <div className="section-title">
              <div>
                <h1 style={{fontSize: 30}}>{p.name}</h1>
                <p className="muted small">
                  {[animalLabel(p.animal_type), p.breed, p.color].filter(Boolean).join(' · ')}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="chips">
              {(
                [
                  ['info', 'ข้อมูล', ClipboardList],
                  ['health', 'สุขภาพ', Stethoscope],
                  ['emergency', 'ฉุกเฉิน', Ambulance],
                  ['guardians', 'ผู้ดูแลร่วม', Users],
                ] as const
              ).map(([k, label, Icon]) => (
                <button key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                  <span className="animal-option">
                    <Icon size={14} /> {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {tab === 'info' ? (
            <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div className="kv">
                <div><span>Pet Haii</span><b>{p.pet_code}</b></div>
                <div><span>เพศ</span><b>{p.gender === 'male' ? 'ผู้' : p.gender === 'female' ? 'เมีย' : '-'}</b></div>
                <div><span>วันเกิด</span><b>{formatDate(p.birth_date)}</b></div>
                <div><span>น้ำหนัก</span><b>{p.weight != null && Number(p.weight) > 0 ? `${Number(p.weight)} กก.` : '-'}</b></div>
                <div><span>Microchip</span><b>{p.microchip_id || '-'}</b></div>
                <div><span>หน้าสาธารณะ</span><b>{p.is_public ? 'เปิด' : 'ปิด'}</b></div>
              </div>
              {p.description ? <p>{p.description}</p> : null}
              {p.distinctive_marks ? <p className="muted small">จุดสังเกต: {p.distinctive_marks}</p> : null}
            </div>
          ) : null}
          {tab === 'health' ? <HealthPanel petId={p.id} /> : null}
          {tab === 'emergency' ? <EmergencyPanel petId={p.id} /> : null}
          {tab === 'guardians' ? <GuardiansPanel petId={p.id} /> : null}
        </div>

        <div className="split-sticky" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center'}}>
            <h2 style={{fontSize: 18}}>Pet QR</h2>
            <div className="qr-box" ref={qrRef}>
              <QRCodeCanvas value={publicUrl} size={200} fgColor="#4B3A36" level="M" includeMargin />
              <b>{p.pet_code}</b>
            </div>
            <p className="muted small">พิมพ์ติดปลอกคอ ใครพบน้องสแกนแล้วติดต่อคุณได้ทันที</p>
            <div className="btn-row" style={{width: '100%'}}>
              <button className="btn btn-soft btn-sm" onClick={downloadQr}>
                <Download size={15} /> ดาวน์โหลด
              </button>
              <button
                className="btn btn-soft btn-sm"
                onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.ok('คัดลอกลิงก์แล้ว'))}>
                <Copy size={15} /> คัดลอกลิงก์
              </button>
            </div>
            <Link to={`/p/${p.qr_token}`} className="small" style={{color: 'var(--primary-strong)'}}>
              ดูหน้าสาธารณะ →
            </Link>
          </div>
          <div className="card form">
            <Link to={`/pets/${p.id}/edit`} className="btn btn-soft">
              <Pencil size={16} /> แก้ไขข้อมูล
            </Link>
            {p.status !== 'lost' ? (
              <button className="btn btn-danger" onClick={() => navigate(`/report/lost?pet=${p.id}`)}>
                <Siren size={18} /> แจ้งว่าน้องหาย
              </button>
            ) : (
              <span className="badge badge-lost" style={{justifyContent: 'center', padding: 10}}>
                น้องอยู่ระหว่างการตามหา
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthPanel({petId}: {petId: string}) {
  const qc = useQueryClient();
  const health = useQuery({queryKey: ['health', petId], queryFn: () => getHealth(petId)});
  const vaccines = useQuery({queryKey: ['vaccines', petId], queryFn: () => listVaccinations(petId)});
  const [form, setForm] = useState({allergies: '', medications: '', conditions: '', vet_name: '', vet_phone: ''});
  const [vac, setVac] = useState({name: '', given_at: '', next_due_at: ''});

  useEffect(() => {
    const h = health.data;
    if (h) {
      setForm({
        allergies: h.allergies ?? '',
        medications: h.medications ?? '',
        conditions: h.conditions ?? '',
        vet_name: h.vet_name ?? '',
        vet_phone: h.vet_phone ?? '',
      });
    }
  }, [health.data]);

  const save = useMutation({
    mutationFn: () => updateHealth(petId, form),
    onSuccess: () => {
      toast.ok('บันทึกข้อมูลสุขภาพแล้ว');
      void qc.invalidateQueries({queryKey: ['health', petId]});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const add = useMutation({
    mutationFn: () => addVaccination(petId, {name: vac.name, given_at: vac.given_at, next_due_at: vac.next_due_at || undefined}),
    onSuccess: () => {
      setVac({name: '', given_at: '', next_due_at: ''});
      void qc.invalidateQueries({queryKey: ['vaccines', petId]});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (vid: string) => removeVaccination(petId, vid),
    onSuccess: () => void qc.invalidateQueries({queryKey: ['vaccines', petId]}),
  });

  if (health.isLoading) return <CatLoader size="sm" label="" />;

  return (
    <>
      <form
        className="card form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}>
        <h3>ข้อมูลสุขภาพ</h3>
        <div className="form-row">
          <label className="field"><span>แพ้</span><input className="input" value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} /></label>
          <label className="field"><span>ยาที่ทาน</span><input className="input" value={form.medications} onChange={e => setForm({...form, medications: e.target.value})} /></label>
        </div>
        <label className="field"><span>โรคประจำตัว</span><input className="input" value={form.conditions} onChange={e => setForm({...form, conditions: e.target.value})} /></label>
        <div className="form-row">
          <label className="field"><span>สัตวแพทย์ / คลินิก</span><input className="input" value={form.vet_name} onChange={e => setForm({...form, vet_name: e.target.value})} /></label>
          <label className="field"><span>เบอร์คลินิก</span><input className="input" value={form.vet_phone} onChange={e => setForm({...form, vet_phone: e.target.value})} /></label>
        </div>
        <button className="btn btn-primary" disabled={save.isPending}>บันทึก</button>
      </form>

      <div className="card form">
        <h3>วัคซีน</h3>
        {vaccines.data?.length ? (
          <div className="list">
            {vaccines.data.map(v => (
              <div key={v.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)'}}>
                <div className="quick-icon tone-mint"><Syringe size={20} /></div>
                <div className="grow">
                  <b>{v.name}</b>
                  <p>ฉีด {formatDate(v.given_at)}{v.next_due_at ? ` · ครั้งถัดไป ${formatDate(v.next_due_at)}` : ''}</p>
                </div>
                <button
                  className="icon-btn"
                  aria-label="ลบ"
                  onClick={async () => {
                    const ok = await confirmAction({title: 'ลบบันทึกวัคซีนนี้?', message: `${v.name} · ฉีด ${formatDate(v.given_at)}\nลบแล้วกู้คืนไม่ได้`, confirmLabel: 'ลบ', tone: 'danger'});
                    if (ok) remove.mutate(v.id);
                  }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">ยังไม่มีบันทึกวัคซีน</p>
        )}
        <form
          className="form-row"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            add.mutate();
          }}
          style={{alignItems: 'end'}}>
          <label className="field"><span>ชื่อวัคซีน</span><input className="input" required value={vac.name} onChange={e => setVac({...vac, name: e.target.value})} /></label>
          <label className="field"><span>วันที่ฉีด</span><input className="input" type="date" required value={vac.given_at} onChange={e => setVac({...vac, given_at: e.target.value})} /></label>
          <label className="field"><span>ครั้งถัดไป</span><input className="input" type="date" value={vac.next_due_at} onChange={e => setVac({...vac, next_due_at: e.target.value})} /></label>
          <button className="btn btn-mint" disabled={add.isPending}>+ เพิ่มวัคซีน</button>
        </form>
      </div>
    </>
  );
}

function EmergencyPanel({petId}: {petId: string}) {
  const qc = useQueryClient();
  const info = useQuery({queryKey: ['emergency', petId], queryFn: () => getEmergencyInfo(petId)});
  const [form, setForm] = useState({
    public_allergies: '',
    public_medications: '',
    public_conditions: '',
    emergency_note: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    show_contact_phone: false,
  });

  useEffect(() => {
    const d = info.data;
    if (d) {
      setForm({
        public_allergies: d.public_allergies ?? '',
        public_medications: d.public_medications ?? '',
        public_conditions: d.public_conditions ?? '',
        emergency_note: d.emergency_note ?? '',
        emergency_contact_name: d.emergency_contact_name ?? '',
        emergency_contact_phone: d.emergency_contact_phone ?? '',
        show_contact_phone: d.show_contact_phone,
      });
    }
  }, [info.data]);

  const save = useMutation({
    mutationFn: () => updateEmergencyInfo(petId, form),
    onSuccess: () => {
      toast.ok('บันทึกข้อมูลฉุกเฉินแล้ว');
      void qc.invalidateQueries({queryKey: ['emergency', petId]});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  if (info.isLoading) return <CatLoader size="sm" label="" />;

  return (
    <form
      className="card form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save.mutate();
      }}>
      <h3>ข้อมูลฉุกเฉิน (แสดงบนหน้า QR)</h3>
      <div className="form-row">
        <label className="field"><span>แพ้</span><input className="input" value={form.public_allergies} onChange={e => setForm({...form, public_allergies: e.target.value})} /></label>
        <label className="field"><span>ยา</span><input className="input" value={form.public_medications} onChange={e => setForm({...form, public_medications: e.target.value})} /></label>
      </div>
      <label className="field"><span>โรคประจำตัว</span><input className="input" value={form.public_conditions} onChange={e => setForm({...form, public_conditions: e.target.value})} /></label>
      <label className="field"><span>ข้อความถึงผู้พบ</span><textarea className="textarea" value={form.emergency_note} onChange={e => setForm({...form, emergency_note: e.target.value})} /></label>
      <div className="form-row">
        <label className="field"><span>ชื่อผู้ติดต่อ</span><input className="input" value={form.emergency_contact_name} onChange={e => setForm({...form, emergency_contact_name: e.target.value})} /></label>
        <label className="field"><span>เบอร์โทร</span><input className="input" value={form.emergency_contact_phone} onChange={e => setForm({...form, emergency_contact_phone: e.target.value})} /></label>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.show_contact_phone} onChange={e => setForm({...form, show_contact_phone: e.target.checked})} />
        แสดงเบอร์โทรบนหน้าสาธารณะ
      </label>
      <button className="btn btn-primary" disabled={save.isPending}>บันทึก</button>
    </form>
  );
}

function GuardiansPanel({petId}: {petId: string}) {
  const qc = useQueryClient();
  const guardians = useQuery({queryKey: ['guardians', petId], queryFn: () => listGuardians(petId)});
  const [email, setEmail] = useState('');

  const add = useMutation({
    mutationFn: () => addGuardian(petId, {email, can_edit: true, can_mark_lost: true, can_receive_notifications: true}),
    onSuccess: () => {
      setEmail('');
      toast.ok('เพิ่มผู้ดูแลร่วมแล้ว');
      void qc.invalidateQueries({queryKey: ['guardians', petId]});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (gid: string) => removeGuardian(petId, gid),
    onSuccess: () => void qc.invalidateQueries({queryKey: ['guardians', petId]}),
  });

  return (
    <div className="card form">
      <h3>ผู้ดูแลร่วม</h3>
      <p className="muted small">ให้คนในครอบครัวช่วยดูแล แก้ไขข้อมูล และรับแจ้งเตือนเมื่อน้องหาย</p>
      {guardians.data?.length ? (
        <div className="list">
          {guardians.data.map(g => (
            <div key={g.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)'}}>
              <Avatar name={g.display_name} />
              <div className="grow">
                <b>{g.display_name ?? g.email}</b>
                <p>{g.email} · {g.role}</p>
              </div>
              <button
                className="icon-btn"
                aria-label="ลบ"
                onClick={async () => {
                  const ok = await confirmAction({
                    title: 'นำผู้ดูแลร่วมออก?',
                    message: `${g.display_name ?? g.email} จะไม่เห็นข้อมูลน้องและไม่ได้รับแจ้งเตือนอีก`,
                    confirmLabel: 'นำออก',
                    tone: 'danger',
                  });
                  if (ok) remove.mutate(g.id);
                }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">ยังไม่มีผู้ดูแลร่วม</p>
      )}
      <form
        style={{display: 'flex', gap: 8}}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          add.mutate();
        }}>
        <input className="input" type="email" required placeholder="อีเมลของผู้ดูแล" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn btn-mint" disabled={add.isPending}>เพิ่ม</button>
      </form>
    </div>
  );
}
