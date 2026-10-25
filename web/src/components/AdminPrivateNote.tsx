import {Link2, Phone, Shield} from 'lucide-react';

import {FoundPost, LostPost} from '../types/api';

type PrivateFields = Pick<LostPost | FoundPost, 'private_owner_name' | 'private_phone' | 'private_link' | 'private_note'>;

function href(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  return null;
}

/** Staff-only contact block. Render this only after confirming the viewer is staff. */
export function AdminPrivateNote({post}: {post: PrivateFields}) {
  const link = post.private_link?.trim();
  const url = link ? href(link) : null;
  return (
    <section className="card admin-private">
      <div className="section-title">
        <h3><Shield size={18} /> ข้อมูลสำหรับแอดมิน</h3>
        <span className="badge badge-admin">ไม่แสดงบนเว็บ</span>
      </div>
      <div className="post-meta" style={{fontSize: 15}}>
        <span><b>ชื่อเจ้าของ</b> {post.private_owner_name || '—'}</span>
        <span>
          <Phone size={15} />
          {post.private_phone ? <a href={`tel:${post.private_phone}`}>{post.private_phone}</a> : '—'}
        </span>
        {link ? (
          <span>
            <Link2 size={15} />
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">{link}</a>
            ) : (
              link
            )}
          </span>
        ) : null}
      </div>
      {post.private_note ? <p style={{lineHeight: 1.6, whiteSpace: 'pre-wrap'}}>{post.private_note}</p> : null}
    </section>
  );
}
