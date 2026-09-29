import {useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery} from '@tanstack/react-query';
import {Clock, HeartHandshake, MapPin, MessageCircle, PartyPopper, Pencil, Share2, XCircle} from 'lucide-react';

import {getFoundPost} from '../api/community.api';
import {contactFoundReporter} from '../api/chat.api';
import {resolveMediaUrl} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {useRequireLogin} from '../store/loginPromptStore';
import {toast} from '../store/toastStore';
import {animalLabel, colorPhrase, formatDateTime, statusLabel, statusTone, timeAgo} from '../lib/format';
import {MapView} from '../components/MapView';
import {PostGallery} from '../components/MediaImage';
import {CatLoader} from '../components/CatLoader';
import {ReportButton} from '../components/ReportButton';
import {EmptyState, StatusBadge} from '../components/ui';
import {sharePage} from '../lib/share';
import {useUserPosition} from '../lib/geo';
import {usePostAction} from '../lib/postActions';

export default function FoundDetailPage() {
  const {id = ''} = useParams();
  const navigate = useNavigate();
  const me = useAuthStore(s => s.user);
  const requireLogin = useRequireLogin();
  const post = useQuery({queryKey: ['found-post', id], queryFn: () => getFoundPost(id)});
  const {position: myPosition} = useUserPosition({prompt: false});

  const {run, pending} = usePostAction('found', id, 'พบน้อง');

  const contact = useMutation({
    mutationFn: () => contactFoundReporter(id),
    onSuccess: c => navigate(`/chat/${c.id}`),
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  if (post.isLoading) return <CatLoader label="กำลังเปิดประกาศ" />;
  if (!post.data) return <EmptyState animal="cat" title="ไม่พบประกาศนี้" />;
  const p = post.data;
  const isReporter = me?.id === p.reporter_id;
  const photos = (p.image_urls?.length ? p.image_urls : [p.image_url]).map(u => resolveMediaUrl(u)).filter((u): u is string => !!u);

  return (
    <div className="page">
      <div className="split">
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {p.status !== 'active' ? (
            <div className={`closed-notice ${statusTone(p.status)}`}>
              <PartyPopper size={22} />
              <div>
                {p.status === 'resolved' ? 'น้องได้เจอเจ้าของแล้ว' : `ประกาศนี้${statusLabel(p.status)}`}
                <p>ประกาศนี้ปิดแล้ว ไม่แสดงบนหน้าแรก</p>
              </div>
            </div>
          ) : null}
          <PostGallery
            urls={photos}
            alt={`พบ${animalLabel(p.animal_type)}`}
            type={p.animal_type}
            background="linear-gradient(135deg, var(--mint-soft), var(--sky-soft))"
          />
          <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <div className="section-title">
              <div>
                <span className="badge badge-found"><HeartHandshake size={13} /> มีคนพบน้อง</span>
                <h1 style={{fontSize: 28, marginTop: 8}}>
                  พบ{animalLabel(p.animal_type)}
                  {p.color ? ` ${colorPhrase(p.color)}` : ''}
                </h1>
                {p.breed_guess ? <p className="muted small">คาดว่าเป็น {p.breed_guess}</p> : null}
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="post-meta" style={{fontSize: 14}}>
              <span><MapPin size={15} /> {p.location_text || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}</span>
              <span><Clock size={15} /> {formatDateTime(p.found_at)} ({timeAgo(p.found_at)})</span>
            </div>
            {p.description ? <p style={{lineHeight: 1.6}}>{p.description}</p> : null}
            <div style={{display: 'flex', justifyContent: 'flex-end'}}>
              {!isReporter ? <ReportButton targetType="found_post" targetId={p.id} /> : null}
            </div>
          </div>
          <div className="card">
            <MapView
              center={p}
              zoom={15}
              className="map-sm"
              userPosition={myPosition}
              markers={[{id: 'f', position: p, kind: 'found', animal: p.animal_type, popup: p.location_text || 'จุดที่พบน้อง'}]}
            />
          </div>
        </div>

        <div className="card form split-sticky">
          {isReporter ? (
            <>
              <h3>จัดการประกาศของคุณ</h3>
              {p.status === 'active' ? (
                <>
                  <button className="btn btn-mint" disabled={pending} onClick={() => void run('resolve')}>
                    <PartyPopper size={18} /> น้องได้เจอเจ้าของแล้ว
                  </button>
                  <button className="btn btn-soft" disabled={pending} onClick={() => navigate(`/found/${p.id}/edit`)}>
                    <Pencil size={18} /> แก้ไขประกาศ
                  </button>
                  <button className="btn btn-soft" style={{color: '#e14b4b'}} disabled={pending} onClick={() => void run('cancel')}>
                    <XCircle size={18} /> ยกเลิกประกาศ
                  </button>
                </>
              ) : (
                <p className="muted">ประกาศนี้ปิดแล้ว</p>
              )}
            </>
          ) : (
            <>
              <h3>นี่น้องของคุณหรือเปล่า?</h3>
              <p className="muted small">ติดต่อผู้พบเพื่อยืนยันตัวตนและนัดรับน้อง</p>
              <button
                className="btn btn-mint"
                onClick={() => requireLogin(() => contact.mutate(), 'เข้าสู่ระบบเพื่อแชทกับผู้พบน้อง')}
                disabled={contact.isPending}>
                <MessageCircle size={18} /> แชทกับผู้พบ
              </button>
            </>
          )}
          <button className="btn btn-soft" onClick={() => void sharePage('ช่วยหาเจ้าของน้อง')}>
            <Share2 size={18} /> แชร์ประกาศ
          </button>
        </div>
      </div>
    </div>
  );
}
