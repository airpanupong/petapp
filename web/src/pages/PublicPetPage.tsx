import {useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery} from '@tanstack/react-query';
import {Ambulance, BadgeCheck, MessageCircle, MapPin, Phone, Siren} from 'lucide-react';

import {getPublicPetByQr} from '../api/pets.api';
import {contactPetOwner} from '../api/chat.api';
import {reportRegisteredPetFound} from '../api/features.api';
import {resolveMediaUrl} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {getCurrentPosition} from '../lib/geo';
import {animalLabel} from '../lib/format';
import {CatLoader} from '../components/CatLoader';
import {MediaImage} from '../components/MediaImage';
import {BrandMark, EmptyState, StatusBadge} from '../components/ui';

export default function PublicPetPage() {
  const {token = ''} = useParams();
  const navigate = useNavigate();
  const status = useAuthStore(s => s.status);
  const pet = useQuery({queryKey: ['public-pet', token], queryFn: () => getPublicPetByQr(token), retry: false});
  const [reported, setReported] = useState(false);

  const requireLogin = () => {
    navigate('/login', {state: {from: `/p/${token}`}});
  };

  const contact = useMutation({
    mutationFn: () => contactPetOwner(token),
    onSuccess: c => navigate(`/chat/${c.id}`),
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const found = useMutation({
    mutationFn: async () => {
      const pos = await getCurrentPosition();
      return reportRegisteredPetFound(token, pos);
    },
    onSuccess: () => {
      setReported(true);
      toast.ok('แจ้งเจ้าของแล้ว ขอบคุณมากนะ');
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const content = () => {
    if (pet.isLoading) return <CatLoader size="lg" label="กำลังเปิดบัตรประจำตัวน้อง" />;
    if (!pet.data) return <EmptyState animal="cat" title="ไม่พบ Pet Haii นี้" description="QR อาจไม่ถูกต้องหรือเจ้าของปิดหน้าสาธารณะไว้" />;
    const p = pet.data;
    const img = resolveMediaUrl(p.profile_image_url);
    const em = p.emergency;

    return (
      <div className="card" style={{padding: 0, overflow: 'hidden', width: 'min(560px, 100%)'}}>
        <div className="detail-media" style={{borderRadius: 0, boxShadow: 'none', aspectRatio: '4 / 3'}}>
          <MediaImage src={img} alt={p.name} type={p.animal_type} zoomable />
        </div>
        <div style={{padding: 22, display: 'flex', flexDirection: 'column', gap: 14}}>
          <div className="section-title">
            <div>
              <h1 style={{fontSize: 30, display: 'flex', alignItems: 'center', gap: 8}}>
                {p.name}
                {p.ownership_verified ? <BadgeCheck size={22} color="var(--mint-strong)" /> : null}
              </h1>
              <p className="muted small">{[animalLabel(p.animal_type), p.breed, p.color].filter(Boolean).join(' · ')}</p>
            </div>
            <StatusBadge status={p.status} />
          </div>
          {p.status === 'lost' ? (
            <div className="error-text" style={{fontSize: 14, display: 'flex', gap: 6, alignItems: 'flex-start'}}><Siren size={17} style={{flex: '0 0 auto', marginTop: 2}} /> น้องกำลังหลงทาง! ถ้าคุณอยู่กับน้อง กรุณาแจ้งเจ้าของด้านล่าง</div>
          ) : null}
          <div className="kv">
            <div><span>Pet Haii</span><b>{p.pet_code}</b></div>
            <div><span>เพศ</span><b>{p.gender === 'male' ? 'ผู้' : p.gender === 'female' ? 'เมีย' : '-'}</b></div>
          </div>
          {p.description ? <p>{p.description}</p> : null}
          {p.distinctive_marks ? <p className="muted small">จุดสังเกต: {p.distinctive_marks}</p> : null}

          {em || p.emergency_note ? (
            <div className="card" style={{background: 'var(--butter-soft)', boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 6}}>
              <b style={{fontWeight: 500, display: 'inline-flex', gap: 6, alignItems: 'center'}}><Ambulance size={16} /> ข้อมูลฉุกเฉิน</b>
              {em?.public_allergies ? <p className="small">แพ้: {em.public_allergies}</p> : null}
              {em?.public_medications ? <p className="small">ยา: {em.public_medications}</p> : null}
              {em?.public_conditions ? <p className="small">โรคประจำตัว: {em.public_conditions}</p> : null}
              {em?.emergency_note || p.emergency_note ? <p className="small">{em?.emergency_note || p.emergency_note}</p> : null}
              {em?.emergency_contact_phone ? (
                <a className="btn btn-soft btn-sm" href={`tel:${em.emergency_contact_phone}`} style={{alignSelf: 'flex-start'}}>
                  <Phone size={14} /> {em.emergency_contact_name ? `${em.emergency_contact_name} · ` : ''}
                  {em.emergency_contact_phone}
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="form">
            <button
              className="btn btn-primary"
              disabled={found.isPending || reported}
              onClick={() => (status === 'authenticated' ? found.mutate() : requireLogin())}>
              <MapPin size={18} /> {reported ? 'แจ้งเจ้าของแล้ว' : 'ฉันพบน้อง — ส่งตำแหน่งให้เจ้าของ'}
            </button>
            <button
              className="btn btn-mint"
              disabled={contact.isPending}
              onClick={() => (status === 'authenticated' ? contact.mutate() : requireLogin())}>
              <MessageCircle size={18} /> แชทกับเจ้าของ
            </button>
            {status !== 'authenticated' ? <p className="muted small" style={{textAlign: 'center'}}>ต้องเข้าสู่ระบบก่อนติดต่อเจ้าของ</p> : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="auth" style={{alignContent: 'start', gap: 18}}>
      <Link to="/" className="brand">
        <BrandMark />
        Pet haii
      </Link>
      {content()}
    </div>
  );
}
