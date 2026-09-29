import {FormEvent, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Bell, BellOff, Clock, Gift, MapPin, MessageCircle, Share2, Eye, Siren, PartyPopper, Pencil, XCircle} from 'lucide-react';

import {createSighting, getLostPost, listSightings, resolveLostPost, cancelLostPost} from '../api/community.api';
import {followLostCase, getFollowStatus, unfollowLostCase} from '../api/features.api';
import {contactLostOwner} from '../api/chat.api';
import {resolveMediaUrl, uploadImage} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {useRequireLogin} from '../store/loginPromptStore';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {animalLabel, formatDateTime, fromLocalInput, statusLabel, statusTone, timeAgo, toLocalInput} from '../lib/format';
import {MapView, MapMarker, LatLng} from '../components/MapView';
import {PetMascot} from '../components/PetMascot';
import {PostGallery} from '../components/MediaImage';
import {LocationPicker} from '../components/LocationPicker';
import {MultiImagePicker, PhotoStrip} from '../components/MultiImagePicker';
import {downscaleImage} from '../lib/image';
import {CatLoader} from '../components/CatLoader';
import {ReportButton} from '../components/ReportButton';
import {LostCheckinPrompt, needsCheckin} from '../components/LostCheckinPrompt';
import {EmptyState, Modal, StatusBadge} from '../components/ui';
import {sharePage} from '../lib/share';
import {useUserPosition} from '../lib/geo';

export default function LostDetailPage() {
  const {id = ''} = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore(s => s.user);
  const authed = useAuthStore(s => s.status === 'authenticated');
  const requireLogin = useRequireLogin();
  const post = useQuery({queryKey: ['lost-post', id], queryFn: () => getLostPost(id)});
  const {position: myPosition} = useUserPosition({prompt: false});
  const sightings = useQuery({queryKey: ['sightings', id], queryFn: () => listSightings(id)});
  const follow = useQuery({queryKey: ['follow', id], queryFn: () => getFollowStatus(id), enabled: authed});
  const [sightOpen, setSightOpen] = useState(false);

  const toggleFollow = useMutation({
    mutationFn: async () => (follow.data ? unfollowLostCase(id) : followLostCase(id)),
    onSuccess: () => void qc.invalidateQueries({queryKey: ['follow', id]}),
  });

  const closeCase = useMutation({
    mutationFn: (kind: 'resolve' | 'cancel') => (kind === 'resolve' ? resolveLostPost(id) : cancelLostPost(id)),
    onSuccess: (_d, kind) => {
      toast.ok(kind === 'resolve' ? 'ยินดีด้วย เจอน้องแล้ว 🎉' : 'ยกเลิกประกาศแล้ว');
      void qc.invalidateQueries({queryKey: ['lost-post', id]});
      void qc.invalidateQueries({queryKey: ['feed']});
      void qc.invalidateQueries({queryKey: ['pets']});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const contact = useMutation({
    mutationFn: () => contactLostOwner(id),
    onSuccess: c => navigate(`/chat/${c.id}`),
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  if (post.isLoading) return <CatLoader label="กำลังเปิดประกาศ" />;
  if (!post.data) return <EmptyState animal="cat" title="ไม่พบประกาศนี้" />;
  const p = post.data;
  const isOwner = me?.id === p.owner_id;
  const active = p.status === 'active';
  const photos = (p.image_urls?.length ? p.image_urls : [p.image_url || p.pet?.profile_image_url]).map(u => resolveMediaUrl(u)).filter((u): u is string => !!u);

  const sightingCount = sightings.data?.length ?? 0;
  const markers: MapMarker[] = [
    {id: 'lost', position: p, kind: 'lost', animal: p.pet?.animal_type, popup: p.location_text ? `จุดที่หาย · ${p.location_text}` : 'จุดที่หาย'},
    ...(authed ? sightings.data ?? [] : []).map(s => ({
      id: s.id,
      position: s,
      kind: 'sighting' as const,
      icon: 'eye' as const,
      popup: `พบเห็น ${formatDateTime(s.seen_at)} ${s.location_text ?? ''}`,
    })),
  ];

  return (
    <div className="page">
      <div className="split">
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {!active ? (
            <div className={`closed-notice ${statusTone(p.status)}`}>
              {p.status === 'resolved' ? <PartyPopper size={22} /> : <XCircle size={22} />}
              <div>
                {p.status === 'resolved' ? `เจอ${p.pet?.name ? ` ${p.pet.name}` : 'น้อง'}แล้ว` : p.status === 'cancelled' ? 'ประกาศนี้ถูกยกเลิกแล้ว' : `ประกาศนี้${statusLabel(p.status)}`}
                <p>{p.status === 'resolved' ? 'ขอบคุณทุกคนที่ช่วยตามหาน้อง' : 'ไม่แสดงบนหน้าแรกและไม่รับเบาะแสใหม่แล้ว'}</p>
              </div>
            </div>
          ) : null}
          {isOwner && needsCheckin(p) ? <LostCheckinPrompt post={p} /> : null}
          <PostGallery urls={photos} alt={p.pet?.name ?? p.title} type={p.pet?.animal_type} />
          <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <div className="section-title">
              <div>
                <span className="badge badge-lost"><Siren size={13} /> ตามหาน้อง</span>
                <h1 style={{fontSize: 28, marginTop: 8}}>{p.pet?.name ?? p.title}</h1>
                <p className="muted small">
                  {[animalLabel(p.pet?.animal_type), p.pet?.breed, p.pet?.color].filter(Boolean).join(' · ')}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="post-meta" style={{fontSize: 14}}>
              <span><MapPin size={15} /> {p.location_text || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}</span>
              <span><Clock size={15} /> {formatDateTime(p.lost_at)} ({timeAgo(p.lost_at)})</span>
            </div>
            {p.reward_enabled ? (
              <div className="badge tone-butter" style={{padding: '8px 12px', fontSize: 14}}>
                <Gift size={15} /> รางวัล: {p.reward_text || 'มี'}
              </div>
            ) : null}
            {p.description ? <p style={{lineHeight: 1.6}}>{p.description}</p> : null}
            <div style={{display: 'flex', justifyContent: 'flex-end'}}>
              {!isOwner ? <ReportButton targetType="lost_post" targetId={p.id} /> : null}
            </div>
          </div>

          <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <h3>จุดที่หาย & เบาะแส ({sightingCount})</h3>
            <MapView center={p} zoom={14} markers={markers} radiusKm={p.search_radius_km} userPosition={myPosition} className="map-sm" />
            {!authed ? (
              <div className="locked-note">
                <PetMascot type="cat" size={40} />
                <span className="grow">
                  <b>{sightingCount ? `มีเบาะแส ${sightingCount} รายการ` : 'ยังไม่มีเบาะแส'}</b>
                  <br />
                  เข้าสู่ระบบเพื่อดูจุดที่มีคนเห็นน้อง และช่วยแจ้งเบาะแส
                </span>
                <button className="btn btn-soft btn-sm" onClick={() => requireLogin(() => undefined, 'เข้าสู่ระบบเพื่อดูเบาะแสทั้งหมดของน้อง')}>
                  ดูเบาะแส
                </button>
              </div>
            ) : sightings.data?.length ? (
              <div className="list">
                {sightings.data.map(s => (
                  <div key={s.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)'}}>
                    <div className="quick-icon tone-butter"><Eye size={20} /></div>
                    <div className="grow">
                      <b>{s.location_text || 'มีคนเห็น'}</b>
                      <p style={{whiteSpace: 'normal'}}>
                        {formatDateTime(s.seen_at)}
                        {s.direction ? ` · ไปทาง${s.direction}` : ''}
                        {s.description ? ` · ${s.description}` : ''}
                      </p>
                      <PhotoStrip
                        urls={(s.image_urls?.length ? s.image_urls : s.image_url ? [s.image_url] : []).map(u => resolveMediaUrl(u)!)}
                        alt="รูปเบาะแส"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">ยังไม่มีเบาะแส</p>
            )}
          </div>
        </div>

        <div className="card form split-sticky">
          {isOwner ? (
            <>
              <h3>จัดการประกาศของคุณ</h3>
              {active ? (
                <>
                  <button
                    className="btn btn-mint"
                    disabled={closeCase.isPending}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: `เจอ ${p.pet?.name ?? 'น้อง'} แล้ว?`,
                        message: 'ประกาศจะขึ้นสถานะ "เจอแล้ว" และแจ้งผู้ที่ติดตามเคสนี้',
                        confirmLabel: 'ใช่ เจอแล้ว',
                      });
                      if (ok) closeCase.mutate('resolve');
                    }}>
                    <PartyPopper size={18} /> เจอน้องแล้ว
                  </button>
                  <button className="btn btn-soft" disabled={closeCase.isPending} onClick={() => navigate(`/lost/${p.id}/edit`)}>
                    <Pencil size={18} /> แก้ไขประกาศ
                  </button>
                  <button
                    className="btn btn-soft"
                    style={{color: '#e14b4b'}}
                    disabled={closeCase.isPending}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'ยกเลิกประกาศนี้?',
                        message: `ประกาศตามหา ${p.pet?.name ?? ''} จะไม่แสดงบนหน้าแรกและแผนที่อีก และจะไม่มีการแจ้งเตือนคนแถวนั้นแล้ว`,
                        confirmLabel: 'ยกเลิกประกาศ',
                        cancelLabel: 'ไม่ยกเลิก',
                        tone: 'danger',
                      });
                      if (ok) closeCase.mutate('cancel');
                    }}>
                    ยกเลิกประกาศ
                  </button>
                </>
              ) : (
                <p className="muted">{p.status === 'cancelled' ? 'คุณยกเลิกประกาศนี้แล้ว' : 'ประกาศนี้ปิดแล้ว'}</p>
              )}
            </>
          ) : (
            <>
              <h3>ช่วยน้องได้ยังไง?</h3>
              <button
                className="btn btn-primary"
                onClick={() => requireLogin(() => setSightOpen(true), 'เข้าสู่ระบบเพื่อแจ้งเบาะแสให้เจ้าของน้อง')}
                disabled={!active}>
                <Eye size={18} /> ฉันเห็นน้อง (แจ้งเบาะแส)
              </button>
              <button
                className="btn btn-mint"
                onClick={() => requireLogin(() => contact.mutate(), 'เข้าสู่ระบบเพื่อแชทกับเจ้าของน้อง')}
                disabled={contact.isPending}>
                <MessageCircle size={18} /> แชทกับเจ้าของ
              </button>
              <button
                className="btn btn-soft"
                onClick={() => requireLogin(() => toggleFollow.mutate(), 'เข้าสู่ระบบเพื่อรับแจ้งเตือนเมื่อเคสนี้มีความคืบหน้า')}
                disabled={toggleFollow.isPending}>
                {follow.data ? <BellOff size={18} /> : <Bell size={18} />}
                {follow.data ? 'เลิกติดตาม' : 'ติดตามเคสนี้'}
              </button>
            </>
          )}
          <button className="btn btn-soft" onClick={() => void sharePage(`ช่วยตามหา ${p.pet?.name ?? ''}`)}>
            <Share2 size={18} /> แชร์ประกาศ
          </button>
        </div>
      </div>

      <SightingModal open={sightOpen} onClose={() => setSightOpen(false)} postId={p.id} />
    </div>
  );
}

function SightingModal({open, onClose, postId}: {open: boolean; onClose: () => void; postId: string}) {
  const qc = useQueryClient();
  const [seenAt, setSeenAt] = useState(toLocalInput());
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locationText, setLocationText] = useState('');
  const [direction, setDirection] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  const submit = useMutation({
    mutationFn: async () => {
      const image_urls = await Promise.all(photos.map(async f => uploadImage(await downscaleImage(f))));
      return createSighting(postId, {
        seen_at: fromLocalInput(seenAt),
        latitude: position!.latitude,
        longitude: position!.longitude,
        location_text: locationText || undefined,
        direction: direction || undefined,
        description: description || undefined,
        image_urls,
      });
    },
    onSuccess: () => {
      toast.ok('ส่งเบาะแสให้เจ้าของแล้ว ขอบคุณมาก');
      void qc.invalidateQueries({queryKey: ['sightings', postId]});
      setPhotos([]);
      onClose();
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="แจ้งเบาะแส">
      <form
        className="form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (position) submit.mutate();
        }}>
        <label className="field">
          <span>เห็นเมื่อ</span>
          <input className="input" type="datetime-local" value={seenAt} onChange={e => setSeenAt(e.target.value)} required />
        </label>
        <LocationPicker value={position} onChange={setPosition} locationText={locationText} onLocationTextChange={setLocationText} />
        <input className="input" placeholder="น้องเดินไปทางไหน?" value={direction} onChange={e => setDirection(e.target.value)} />
        <textarea className="textarea" placeholder="รายละเอียดเพิ่มเติม" value={description} onChange={e => setDescription(e.target.value)} />
        <MultiImagePicker value={photos} onChange={setPhotos} label="แนบรูปที่เห็นน้อง" />
        <button className="btn btn-primary" disabled={!position || submit.isPending}>
          {submit.isPending ? (photos.length ? 'กำลังอัปโหลดรูป...' : 'กำลังส่ง...') : 'ส่งเบาะแส'}
        </button>
      </form>
    </Modal>
  );
}
