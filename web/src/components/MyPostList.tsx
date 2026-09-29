import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ChevronRight, Clock, HeartHandshake, MapPin, PartyPopper, Pencil, Siren, XCircle} from 'lucide-react';

import {resolveMediaUrl} from '../api/uploads.api';
import {FoundPost, LostPost} from '../types/api';
import {animalLabel, colorPhrase, formatDateTime, statusLabel, statusTone, timeAgo} from '../lib/format';
import {usePostAction} from '../lib/postActions';
import {MediaImage} from './MediaImage';
import {EmptyState} from './ui';

type Row =
  | {kind: 'lost'; post: LostPost}
  | {kind: 'found'; post: FoundPost};

type Filter = 'active' | 'closed' | 'all';

export function MyPostList({lost, found}: {lost: LostPost[]; found: FoundPost[]}) {
  const rows: Row[] = [
    ...lost.map(post => ({kind: 'lost' as const, post})),
    ...found.map(post => ({kind: 'found' as const, post})),
  ].sort((a, b) => b.post.created_at.localeCompare(a.post.created_at));
  const activeCount = rows.filter(r => r.post.status === 'active').length;
  const [filter, setFilter] = useState<Filter>(activeCount ? 'active' : 'all');
  const shown = rows.filter(r =>
    filter === 'all' ? true : filter === 'active' ? r.post.status === 'active' : r.post.status !== 'active',
  );
  const tabs: {id: Filter; label: string; count: number}[] = [
    {id: 'active', label: 'กำลังประกาศ', count: activeCount},
    {id: 'closed', label: 'ปิดแล้ว', count: rows.length - activeCount},
    {id: 'all', label: 'ทั้งหมด', count: rows.length},
  ];

  return (
    <div className="my-posts">
      <div className="chips">
        {tabs.map(t => (
          <button key={t.id} type="button" className={`chip ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="my-post-list">
          {shown.map(r => (
            <MyPostRow key={`${r.kind}-${r.post.id}`} row={r} />
          ))}
        </div>
      ) : (
        <EmptyState animal="cat" title={filter === 'active' ? 'ไม่มีประกาศที่เปิดอยู่' : 'ยังไม่มีประกาศที่ปิดแล้ว'} />
      )}
    </div>
  );
}

function MyPostRow({row}: {row: Row}) {
  const isLost = row.kind === 'lost';
  const post = row.post;
  const active = post.status === 'active';
  const href = `/${row.kind}/${post.id}`;
  const img = resolveMediaUrl(isLost ? row.post.image_url || row.post.pet?.profile_image_url : row.post.image_url);
  const animal = isLost ? row.post.pet?.animal_type : row.post.animal_type;
  const title = isLost
    ? row.post.pet?.name ?? row.post.title
    : `พบ${animalLabel(row.post.animal_type)}${row.post.color ? ` ${colorPhrase(row.post.color)}` : ''}`;
  const when = isLost ? row.post.lost_at : row.post.found_at;
  const closedLabel = post.status === 'resolved' && !isLost ? 'เจอเจ้าของแล้ว' : statusLabel(post.status);
  const {run, pending} = usePostAction(row.kind, post.id, title);

  return (
    <div className={`my-post ${active ? '' : 'inactive'}`}>
      <Link to={href} className="my-post-main">
        <div className="my-post-thumb">
          <MediaImage src={img} alt={title} type={animal} lazy />
        </div>
        <div className="my-post-info">
          <div className="my-post-tags">
            {isLost ? (
              <span className="badge badge-lost"><Siren size={12} /> ตามหา</span>
            ) : (
              <span className="badge badge-found"><HeartHandshake size={12} /> มีคนพบ</span>
            )}
            <span className={`badge ${statusTone(post.status)}`}>{active ? 'กำลังประกาศ' : closedLabel}</span>
          </div>
          <b className="my-post-title">{title}</b>
          <span className="my-post-meta">
            <MapPin size={12} /> {post.location_text || 'ไม่ระบุตำแหน่ง'}
          </span>
          <span className="my-post-meta" title={formatDateTime(when)}>
            <Clock size={12} /> {timeAgo(when)}
          </span>
        </div>
        <ChevronRight size={18} className="my-post-chevron" />
      </Link>
      {active ? (
        <div className="my-post-actions">
          <button type="button" className="btn btn-mint btn-sm" disabled={pending} onClick={() => void run('resolve')}>
            <PartyPopper size={15} /> {isLost ? 'เจอแล้ว' : 'เจอเจ้าของแล้ว'}
          </button>
          <Link className="btn btn-soft btn-sm" to={`${href}/edit`}>
            <Pencil size={15} /> แก้ไข
          </Link>
          <button type="button" className="btn btn-soft btn-sm my-post-cancel" disabled={pending} onClick={() => void run('cancel')}>
            <XCircle size={15} /> ยกเลิกประกาศ
          </button>
        </div>
      ) : null}
    </div>
  );
}
