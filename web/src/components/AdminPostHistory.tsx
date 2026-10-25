import {useDeferredValue, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Ban, ChevronLeft, ChevronRight, HeartHandshake, Search, Siren} from 'lucide-react';

import {AdminPostStatus, adminBlockGuestSender, adminSetPostStatus, listAdminPosts} from '../api/moderation.api';
import {getApiErrorMessage} from '../api/client';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {animalLabel, colorPhrase, formatDate} from '../lib/format';
import {Avatar, SectionTitle, StatusBadge} from './ui';
import {FoundPost, LostPost} from '../types/api';

type Kind = 'lost' | 'found';

const PAGE_SIZES = [10, 20, 50, 100];
const PER_PAGE_KEY = 'petapp.admin.postsPerPage';
const STATUSES: AdminPostStatus[] = ['active', 'resolved', 'cancelled', 'closed', 'hidden', 'removed'];
const OPEN: AdminPostStatus[] = ['active', 'hidden'];

function statusOption(kind: Kind, status: AdminPostStatus) {
  switch (status) {
    case 'active':
      return kind === 'lost' ? 'กำลังตามหา' : 'เปิดอยู่';
    case 'resolved':
      return kind === 'lost' ? 'เจอแล้ว' : 'ส่งคืนเจ้าของแล้ว';
    case 'cancelled':
      return 'ยกเลิกแล้ว';
    case 'closed':
      return 'ปิดแล้ว';
    case 'hidden':
      return 'ซ่อน';
    case 'removed':
      return 'นำออก';
  }
}

function changeMessage(kind: Kind, from: string, to: AdminPostStatus) {
  const visible = to === 'active' ? 'ประกาศจะกลับมาแสดงบนหน้าแรกและแผนที่' : 'ประกาศจะไม่แสดงบนหน้าแรกและแผนที่';
  if (kind !== 'lost') return visible;
  const wasOpen = OPEN.includes(from as AdminPostStatus);
  const nowOpen = OPEN.includes(to);
  if (!wasOpen && nowOpen) return `${visible} และสถานะน้องจะเปลี่ยนเป็น “หาย”`;
  if (wasOpen && !nowOpen) return `${visible} และสถานะน้องจะกลับเป็น “อยู่บ้าน”`;
  return visible;
}

export function AdminPostHistory({isSuper}: {isSuper: boolean}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('lost');
  const [status, setStatus] = useState<AdminPostStatus | ''>('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => {
    const saved = Number(localStorage.getItem(PER_PAGE_KEY));
    return PAGE_SIZES.includes(saved) ? saved : PAGE_SIZES[1];
  });
  const q = useDeferredValue(query.trim());

  const posts = useQuery({
    queryKey: ['admin-posts', kind, status, q, page, perPage],
    queryFn: () => listAdminPosts({kind, status: status || undefined, q, page, pageSize: perPage}),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((posts.data?.total ?? 0) / perPage));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const refresh = () => void qc.invalidateQueries({predicate: x => String(x.queryKey[0]).startsWith('admin-')});
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e));
  const setPostStatus = useMutation({
    mutationFn: (v: {id: string; status: AdminPostStatus}) => adminSetPostStatus(kind, v.id, v.status),
    onSuccess: (_, v) => {
      toast.ok(`เปลี่ยนสถานะเป็น “${statusOption(kind, v.status)}” แล้ว`);
      refresh();
    },
    onError,
  });
  const blockGuest = useMutation({
    mutationFn: adminBlockGuestSender,
    onSuccess: r => {
      toast.ok(`บล็อกผู้แจ้งแล้ว ลบเบาะแส ${r.removed_posts} รายการ`);
      refresh();
    },
    onError,
  });

  const changeStatus = async (id: string, from: string, to: AdminPostStatus) => {
    const ok = await confirmAction({
      title: `เปลี่ยนสถานะเป็น “${statusOption(kind, to)}”?`,
      message: changeMessage(kind, from, to),
      confirmLabel: 'เปลี่ยนสถานะ',
      tone: to === 'active' ? 'primary' : 'danger',
    });
    if (ok) setPostStatus.mutate({id, status: to});
  };

  const pick = (next: Kind) => {
    setKind(next);
    setPage(1);
  };

  const row = (p: LostPost | FoundPost) => {
    const lost = kind === 'lost';
    const lp = p as LostPost;
    const fp = p as FoundPost;
    const title = lost ? lp.pet?.name ?? lp.title : `พบ${animalLabel(fp.animal_type)} ${colorPhrase(fp.color)}`.trim();
    const locked = !isSuper && p.status === 'hidden';
    return (
      <div key={p.id} className="admin-user">
        <Avatar name={title} url={p.image_url ?? (lost ? lp.pet?.profile_image_url : null)} />
        <div className="admin-user-info">
          <div className="admin-user-name">
            <Link to={`/${kind}/${p.id}`}>
              <b>{title}</b>
            </Link>
            <StatusBadge status={p.status} />
            {!lost && fp.is_guest ? <span className="badge tone-butter">ไม่เข้าสู่ระบบ</span> : null}
            {p.created_by_admin ? <span className="badge badge-admin">เพิ่มโดยแอดมิน</span> : null}
          </div>
          <p>{p.location_text || '-'}</p>
          <span>
            โพสต์ {formatDate(p.created_at)}
            {lost && lp.closed_at ? ` · ปิด ${formatDate(lp.closed_at)}` : ''}
            {p.view_count ? ` · ดู ${p.view_count} ครั้ง` : ''}
          </span>
        </div>
        <div className="btn-row admin-actions">
          <select
            className="select"
            aria-label="สถานะประกาศ"
            value={p.status}
            disabled={locked || setPostStatus.isPending}
            onChange={e => void changeStatus(p.id, p.status, e.target.value as AdminPostStatus)}>
            {STATUSES.filter(s => isSuper || s !== 'hidden' || p.status === 'hidden').map(s => (
              <option key={s} value={s}>
                {statusOption(kind, s)}
              </option>
            ))}
          </select>
          {!lost && fp.is_guest && OPEN.includes(p.status as AdminPostStatus) ? (
            <button
              className="btn btn-sm btn-danger"
              disabled={blockGuest.isPending}
              onClick={async () => {
                const ok = await confirmAction({
                  title: 'บล็อกผู้แจ้งรายนี้?',
                  message: 'เครือข่ายนี้จะแจ้งแบบไม่เข้าสู่ระบบไม่ได้อีก และเบาะแสทั้งหมดจากผู้แจ้งนี้จะถูกลบ',
                  confirmLabel: 'บล็อกและลบ',
                  tone: 'danger',
                });
                if (ok) blockGuest.mutate(p.id);
              }}>
              <Ban size={14} /> บล็อกผู้แจ้ง
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="card form">
      <SectionTitle title="ประวัติประกาศ" action={posts.data ? <span className="muted small">ทั้งหมด {posts.data.total} รายการ</span> : undefined} />
      <div className="segmented">
        <button className={kind === 'lost' ? 'active' : ''} onClick={() => pick('lost')}>
          <Siren size={14} /> ประกาศหาย
        </button>
        <button className={kind === 'found' ? 'active' : ''} onClick={() => pick('found')}>
          <HeartHandshake size={14} /> ประกาศพบ
        </button>
      </div>
      <div className="admin-post-filters">
        <label className="admin-search">
          <Search size={16} />
          <input
            className="input"
            placeholder={kind === 'lost' ? 'ค้นหาชื่อน้องหรือสถานที่' : 'ค้นหาสถานที่ สี หรือรายละเอียด'}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className="select"
          aria-label="กรองสถานะ"
          value={status}
          onChange={e => {
            setStatus(e.target.value as AdminPostStatus | '');
            setPage(1);
          }}>
          <option value="">ทุกสถานะ</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {statusOption(kind, s)}
            </option>
          ))}
        </select>
      </div>
      {!isSuper ? <p className="muted small">เฉพาะ Super Admin เท่านั้นที่ซ่อนหรือเลิกซ่อนประกาศได้</p> : null}
      <div className={`list admin-users ${posts.isPlaceholderData ? 'is-loading' : ''}`}>
        {posts.data?.items.map(row)}
        {posts.data && !posts.data.items.length ? <p className="muted small">ไม่พบประกาศ</p> : null}
      </div>
      {posts.data?.total ? (
        <div className="admin-pager">
          <label className="small muted admin-page-size">
            แสดง
            <select
              className="select"
              aria-label="จำนวนต่อหน้า"
              value={perPage}
              onChange={e => {
                const size = Number(e.target.value);
                setPerPage(size);
                setPage(1);
                localStorage.setItem(PER_PAGE_KEY, String(size));
              }}>
              {PAGE_SIZES.map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            รายการต่อหน้า
          </label>
          {pages > 1 ? (
            <div className="pager">
              <button className="btn btn-sm btn-soft" disabled={page <= 1} onClick={() => setPage(x => x - 1)}>
                <ChevronLeft size={16} /> ก่อนหน้า
              </button>
              <span className="small muted">
                หน้า {page} / {pages}
              </span>
              <button className="btn btn-sm btn-soft" disabled={page >= pages} onClick={() => setPage(x => x + 1)}>
                ถัดไป <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
