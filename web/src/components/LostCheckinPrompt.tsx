import {Link} from 'react-router-dom';
import {PartyPopper, Search} from 'lucide-react';

import {LostPost} from '../types/api';
import {formatDateTime} from '../lib/format';
import {usePostAction} from '../lib/postActions';
import {PetMascot} from './PetMascot';

export function needsCheckin(post: LostPost) {
  return post.status === 'active' && Boolean(post.checkin_asked_at);
}

export function LostCheckinPrompt({post, linkToPost}: {post: LostPost; linkToPost?: boolean}) {
  const name = post.pet?.name ?? 'น้อง';
  const {run, pending} = usePostAction('lost', post.id, name);
  const title = <b>เจอ {name} แล้วหรือยัง?</b>;

  return (
    <div className="checkin-card">
      <PetMascot type={post.pet?.animal_type} size={56} className="checkin-mascot" />
      <div className="checkin-text">
        {linkToPost ? <Link to={`/lost/${post.id}`}>{title}</Link> : title}
        <p>
          ประกาศตามหาครบ 1 สัปดาห์แล้ว
          {post.checkin_deadline_at ? ` ถ้าไม่ตอบภายใน ${formatDateTime(post.checkin_deadline_at)} ระบบจะยกเลิกประกาศให้อัตโนมัติ` : ''}
        </p>
      </div>
      <div className="checkin-actions">
        <button type="button" className="btn btn-mint btn-sm" disabled={pending} onClick={() => void run('resolve')}>
          <PartyPopper size={15} /> เจอแล้ว
        </button>
        <button type="button" className="btn btn-soft btn-sm" disabled={pending} onClick={() => void run('still-searching')}>
          <Search size={15} /> ยังไม่เจอ ตามหาต่อ
        </button>
      </div>
    </div>
  );
}
