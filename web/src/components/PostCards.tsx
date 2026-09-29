import {useNavigate} from 'react-router-dom';
import {Clock, MapPin, Gift, Siren, HeartHandshake, IdCard, Pencil, UserRound, XCircle} from 'lucide-react';

import {FoundPost, LostPost, Pet} from '../types/api';
import {resolveMediaUrl} from '../api/uploads.api';
import {animalLabel, colorLabel, colorPhrase, distanceLabel, statusLabel, statusTone, timeAgo} from '../lib/format';
import {PostKind, usePostAction} from '../lib/postActions';
import {StatusBadge} from './ui';
import {MediaImage} from './MediaImage';

function ClosedRibbon({status, found}: {status: string; found?: boolean}) {
  if (status === 'active') return null;
  const label = status === 'resolved' && found ? 'เจอเจ้าของแล้ว' : statusLabel(status);
  return <span className={`closed-ribbon ${statusTone(status)}`}>{label}</span>;
}

function MineBar({kind, postId, name}: {kind: PostKind; postId: string; name: string}) {
  const navigate = useNavigate();
  const {run, pending} = usePostAction(kind, postId, name);
  return (
    <div className="post-owner-bar" onClick={e => e.stopPropagation()}>
      <span className="badge badge-mine">
        <UserRound size={12} /> <span>ประกาศของฉัน</span>
      </span>
      <div className="post-owner-actions">
        <button type="button" className="btn btn-soft btn-sm" disabled={pending} onClick={() => navigate(`/${kind}/${postId}/edit`)}>
          <Pencil size={14} /> แก้ไข
        </button>
        <button type="button" className="btn btn-soft btn-sm post-owner-cancel" disabled={pending} onClick={() => void run('cancel')}>
          <XCircle size={14} /> ยกเลิก
        </button>
      </div>
    </div>
  );
}

export function LostCard({post, mine}: {post: LostPost; mine?: boolean}) {
  const navigate = useNavigate();
  const img = resolveMediaUrl(post.image_url || post.pet?.profile_image_url);
  const dist = distanceLabel(post.distance_km);
  return (
    <article className={`card post-card ${post.status !== 'active' ? 'inactive' : ''}`} onClick={() => navigate(`/lost/${post.id}`)}>
      <div className="post-media">
        <MediaImage src={img} alt={post.pet?.name ?? post.title} type={post.pet?.animal_type} lazy />
        <span className="badge badge-lost"><Siren size={13} /> ตามหา</span>
        <ClosedRibbon status={post.status} />
        {dist ? <span className="distance glass-strong">{dist}</span> : null}
      </div>
      <div className="post-body">
        <h3>{post.pet?.name ?? post.title}</h3>
        <p className="muted small">
          {[animalLabel(post.pet?.animal_type), post.pet?.breed, colorLabel(post.pet?.color)].filter(Boolean).join(' · ')}
        </p>
        <div className="post-meta">
          <span>
            <MapPin size={13} /> {post.location_text || 'ไม่ระบุตำแหน่ง'}
          </span>
          <span>
            <Clock size={13} /> {timeAgo(post.lost_at)}
          </span>
          {post.reward_enabled ? (
            <span style={{color: 'var(--butter-strong)'}}>
              <Gift size={13} /> มีรางวัล
            </span>
          ) : null}
        </div>
        {mine && post.status === 'active' ? <MineBar kind="lost" postId={post.id} name={post.pet?.name ?? post.title} /> : null}
      </div>
    </article>
  );
}

export function FoundCard({post, mine}: {post: FoundPost; mine?: boolean}) {
  const navigate = useNavigate();
  const img = resolveMediaUrl(post.image_url);
  const dist = distanceLabel(post.distance_km);
  return (
    <article className={`card post-card ${post.status !== 'active' ? 'inactive' : ''}`} onClick={() => navigate(`/found/${post.id}`)}>
      <div className="post-media" style={{background: 'linear-gradient(135deg, var(--mint-soft), var(--sky-soft))'}}>
        <MediaImage src={img} alt={`พบ${animalLabel(post.animal_type)}`} type={post.animal_type} lazy />
        <span className="badge badge-found"><HeartHandshake size={13} /> มีคนพบ</span>
        <ClosedRibbon status={post.status} found />
        {dist ? <span className="distance glass-strong">{dist}</span> : null}
      </div>
      <div className="post-body">
        <h3>
          พบ{animalLabel(post.animal_type)}
          {post.color ? ` ${colorPhrase(post.color)}` : ''}
        </h3>
        <p className="muted small">{post.breed_guess || post.description || 'ยังไม่ทราบสายพันธุ์'}</p>
        <div className="post-meta">
          <span>
            <MapPin size={13} /> {post.location_text || 'ไม่ระบุตำแหน่ง'}
          </span>
          <span>
            <Clock size={13} /> {timeAgo(post.found_at)}
          </span>
        </div>
        {mine && post.status === 'active' ? <MineBar kind="found" postId={post.id} name={`พบ${animalLabel(post.animal_type)}`} /> : null}
      </div>
    </article>
  );
}

export function PetCard({pet}: {pet: Pet}) {
  const navigate = useNavigate();
  const img = resolveMediaUrl(pet.profile_image_url);
  return (
    <article className="card post-card" onClick={() => navigate(`/pets/${pet.id}`)}>
      <div className="post-media" style={{background: 'linear-gradient(135deg, var(--butter-soft), var(--primary-soft))'}}>
        <MediaImage src={img} alt={pet.name} type={pet.animal_type} lazy />
        <StatusBadge status={pet.status} />
      </div>
      <div className="post-body">
        <h3>{pet.name}</h3>
        <p className="muted small">
          {[animalLabel(pet.animal_type), pet.breed, colorLabel(pet.color)].filter(Boolean).join(' · ')}
        </p>
        <div className="post-meta">
          <span><IdCard size={13} /> {pet.pet_code}</span>
        </div>
      </div>
    </article>
  );
}
