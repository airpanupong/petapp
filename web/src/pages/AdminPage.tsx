import {useDeferredValue, useEffect, useState} from 'react';
import {Link, Navigate} from 'react-router-dom';
import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Ban, ChevronLeft, ChevronRight, Flag, HeartHandshake, ImageOff, Search, ShieldCheck, Siren, UserCheck, Users} from 'lucide-react';

import {
  listImageFlags,
  reviewImageFlag,
  adminSetUserBlocked,
  adminSetUserRole,
  getAdminMetrics,
  listAdminOwnership,
  listAdminReports,
  listAdminUsers,
  resolveAdminReport,
  reviewOwnership,
} from '../api/moderation.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {ConfirmOptions, confirmAction} from '../store/confirmStore';
import {timeAgo} from '../lib/format';
import {isStaff, isSuperAdmin, roleLabel} from '../lib/roles';
import {CatLoader} from '../components/CatLoader';
import {AdminPostHistory} from '../components/AdminPostHistory';
import {Avatar, PageTitle, SectionTitle, StatusBadge} from '../components/ui';

const IMAGE_REASON: Record<string, string> = {
  sexual: 'เนื้อหาไม่เหมาะสม',
  no_animal: 'ไม่พบสัตว์ในรูป',
  gore: 'ภาพบาดเจ็บ/รุนแรง',
  ai_error: 'ตรวจไม่สำเร็จ',
};
const USERS_PER_PAGE = 20;

export default function AdminPage() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const isAdmin = isStaff(user?.role);
  const isSuper = isSuperAdmin(user?.role);
  const [userQuery, setUserQuery] = useState('');
  const deferredQuery = useDeferredValue(userQuery.trim());

  const metrics = useQuery({queryKey: ['admin-metrics'], queryFn: getAdminMetrics, enabled: isAdmin});
  const reports = useQuery({queryKey: ['admin-reports'], queryFn: () => listAdminReports('open'), enabled: isAdmin});
  const ownership = useQuery({queryKey: ['admin-ownership'], queryFn: listAdminOwnership, enabled: isAdmin});
  const imageFlags = useQuery({queryKey: ['admin-image-flags'], queryFn: listImageFlags, enabled: isAdmin});
  const [userPage, setUserPage] = useState(1);
  const users = useQuery({
    queryKey: ['admin-users', deferredQuery, userPage],
    queryFn: () => listAdminUsers({q: deferredQuery, page: userPage, pageSize: USERS_PER_PAGE}),
    placeholderData: keepPreviousData,
    enabled: isAdmin,
  });
  const userPages = Math.max(1, Math.ceil((users.data?.total ?? 0) / USERS_PER_PAGE));
  useEffect(() => {
    if (userPage > userPages) setUserPage(userPages);
  }, [userPage, userPages]);

  const refresh = () => void qc.invalidateQueries({predicate: q => String(q.queryKey[0]).startsWith('admin-')});
  const onError = (e: unknown) => toast.error(getApiErrorMessage(e));

  const resolveReport = useMutation({
    mutationFn: ({id, status}: {id: string; status: 'resolved' | 'dismissed' | 'action_taken'}) => resolveAdminReport(id, {status}),
    onSuccess: refresh,
    onError,
  });
  const review = useMutation({
    mutationFn: ({id, status}: {id: string; status: 'verified' | 'rejected'}) => reviewOwnership(id, {status}),
    onSuccess: refresh,
    onError,
  });
  const reviewImage = useMutation({
    mutationFn: ({id, action}: {id: string; action: 'approve' | 'remove'}) => reviewImageFlag(id, action),
    onSuccess: (_, v) => {
      toast.ok(v.action === 'remove' ? 'ลบรูปแล้ว' : 'อนุมัติรูปแล้ว');
      refresh();
    },
    onError,
  });
  const setBlocked = useMutation({
    mutationFn: ({id, blocked}: {id: string; blocked: boolean}) => adminSetUserBlocked(id, blocked),
    onSuccess: (_, v) => {
      toast.ok(v.blocked ? 'บล็อกผู้ใช้แล้ว ประกาศของผู้ใช้ถูกซ่อน' : 'ปลดบล็อกผู้ใช้แล้ว');
      refresh();
    },
    onError,
  });
  const setRole = useMutation({
    mutationFn: ({id, role}: {id: string; role: 'user' | 'admin'}) => adminSetUserRole(id, role),
    onSuccess: () => {
      toast.ok('เปลี่ยนสิทธิ์แล้ว');
      refresh();
    },
    onError,
  });
  if (!isAdmin) return <Navigate to="/" replace />;

  const ask = async (options: ConfirmOptions, run: () => void) => {
    if (await confirmAction(options)) run();
  };

  const toggleBlock = (id: string, name: string, blocked: boolean) =>
    void ask(
      blocked
        ? {title: `บล็อก ${name}?`, message: 'ผู้ใช้จะเข้าสู่ระบบไม่ได้ และประกาศที่เปิดอยู่จะถูกซ่อน', confirmLabel: 'บล็อก', tone: 'danger'}
        : {title: `ปลดบล็อก ${name}?`, message: 'ประกาศที่ถูกซ่อนจะกลับมาแสดง', confirmLabel: 'ปลดบล็อก'},
      () => setBlocked.mutate({id, blocked}),
    );

  const m = metrics.data;
  const stats = [
    {label: 'ผู้ใช้', value: m?.users, tone: 'tone-lavender', icon: Users},
    {label: 'ประกาศหาย', value: m?.lost_active, tone: 'tone-pink', icon: Siren},
    {label: 'ประกาศพบ', value: m?.found_active, tone: 'tone-mint', icon: HeartHandshake},
    {label: 'รายงานรอตรวจ', value: m?.reports_open, tone: 'tone-butter', icon: Flag},
    {label: 'รอยืนยันเจ้าของ', value: m?.ownership_pending, tone: 'tone-sky', icon: ShieldCheck},
    {label: 'รูปรอตรวจ', value: m?.images_flagged, tone: 'tone-pink', icon: ImageOff},
  ];
  const pendingOwnership = ownership.data?.filter(o => o.status === 'pending') ?? [];

  return (
    <div className="page">
      <PageTitle
        title="ผู้ดูแลระบบ"
        subtitle={isSuper ? 'Super Admin · บล็อกผู้ใช้ ซ่อนประกาศ และจัดการสิทธิ์' : 'ภาพรวมและงานที่รอดำเนินการ'}
        action={<Link to="/admin/intake" className="btn btn-primary">เพิ่มประกาศ</Link>}
      />
      {metrics.isLoading ? (
        <CatLoader label="กำลังรวบรวมสถิติ" />
      ) : (
        <div className="grid grid-3" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))'}}>
          {stats.map(s => (
            <div key={s.label} className="card stat">
              <div className={`quick-icon ${s.tone}`}><s.icon size={20} /></div>
              <b>{s.value ?? '-'}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card form">
        <SectionTitle title="จัดการผู้ใช้" action={users.data ? <span className="muted small">ทั้งหมด {users.data.total} คน</span> : undefined} />
        <label className="admin-search">
          <Search size={16} />
          <input
            className="input"
            placeholder="ค้นหาชื่อหรืออีเมล"
            value={userQuery}
            onChange={e => {
              setUserQuery(e.target.value);
              setUserPage(1);
            }}
          />
        </label>
        {!isSuper ? <p className="muted small">เฉพาะ Super Admin เท่านั้นที่บล็อกผู้ใช้และเปลี่ยนสิทธิ์ได้</p> : null}
        <div className={`list admin-users ${users.isPlaceholderData ? 'is-loading' : ''}`}>
          {users.data?.items.map(u => {
            const blocked = u.status === 'blocked' || u.status === 'suspended';
            const editable = isSuper && u.id !== user?.id && u.role !== 'super_admin';
            return (
              <div key={u.id} className={`admin-user ${blocked ? 'is-blocked' : ''}`}>
                <Avatar name={u.display_name} url={u.avatar_url} />
                <div className="admin-user-info">
                  <div className="admin-user-name">
                    <b>{u.display_name}</b>
                    {isStaff(u.role) ? <span className="badge tone-lavender">{roleLabel(u.role)}</span> : null}
                    {blocked ? <StatusBadge status={u.status} /> : null}
                  </div>
                  <p>{u.email}</p>
                  <span>สมัคร {timeAgo(u.created_at)}</span>
                </div>
                {editable ? (
                  <div className="btn-row admin-actions">
                    <select
                      className="select"
                      value={u.role}
                      aria-label="สิทธิ์"
                      onChange={e => {
                        const role = e.target.value as 'user' | 'admin';
                        void ask(
                          {title: `เปลี่ยนสิทธิ์ ${u.display_name}?`, message: role === 'admin' ? 'ผู้ใช้นี้จะเข้าหน้าผู้ดูแลระบบได้' : 'ผู้ใช้นี้จะไม่มีสิทธิ์ผู้ดูแลระบบอีก', confirmLabel: 'เปลี่ยนสิทธิ์'},
                          () => setRole.mutate({id: u.id, role}),
                        );
                      }}>
                      <option value="user">ผู้ใช้</option>
                      <option value="admin">Admin</option>
                    </select>
                    {blocked ? (
                      <button className="btn btn-sm btn-mint" onClick={() => toggleBlock(u.id, u.display_name, false)}>
                        <UserCheck size={14} /> ปลดบล็อก
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-danger" onClick={() => toggleBlock(u.id, u.display_name, true)}>
                        <Ban size={14} /> บล็อก
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {users.data && !users.data.items.length ? <p className="muted small">ไม่พบผู้ใช้</p> : null}
        </div>
        {userPages > 1 ? (
          <div className="pager">
            <button className="btn btn-sm btn-soft" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>
              <ChevronLeft size={16} /> ก่อนหน้า
            </button>
            <span className="small muted">
              หน้า {userPage} / {userPages}
            </span>
            <button className="btn btn-sm btn-soft" disabled={userPage >= userPages} onClick={() => setUserPage(p => p + 1)}>
              ถัดไป <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-2">
        <div className="card form">
          <SectionTitle title="รายงานที่รอตรวจ" />
          {reports.data?.length ? (
            <div className="list">
              {reports.data.map(r => (
                <div key={r.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)', flexWrap: 'wrap'}}>
                  <div className="grow">
                    <b>{r.reason} · {r.target_type}</b>
                    <p style={{whiteSpace: 'normal'}}>{r.details || '-'} · {timeAgo(r.created_at)}</p>
                  </div>
                  <div className="btn-row" style={{flex: '0 0 auto'}}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() =>
                        void ask({title: 'ดำเนินการกับรายงานนี้?', message: 'ระบบจะบันทึกว่ารายงานนี้ได้รับการจัดการแล้ว', confirmLabel: 'ดำเนินการ', tone: 'danger'}, () =>
                          resolveReport.mutate({id: r.id, status: 'action_taken'}),
                        )
                      }>
                      ดำเนินการ
                    </button>
                    <button
                      className="btn btn-sm btn-soft"
                      onClick={() =>
                        void ask({title: 'ยกเลิกรายงานนี้?', message: 'รายงานจะถูกปิดโดยไม่ดำเนินการใด ๆ', confirmLabel: 'ยกเลิกรายงาน'}, () =>
                          resolveReport.mutate({id: r.id, status: 'dismissed'}),
                        )
                      }>
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">ไม่มีรายงานค้าง</p>
          )}
        </div>

        <div className="card form">
          <SectionTitle title="ยืนยันความเป็นเจ้าของ" />
          {pendingOwnership.length ? (
            <div className="list">
              {pendingOwnership.map(o => (
                <div key={o.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)', flexWrap: 'wrap'}}>
                  <div className="grow">
                    <b>{o.method}</b>
                    <p style={{whiteSpace: 'normal'}}>{o.evidence_note || '-'} · {timeAgo(o.submitted_at)}</p>
                  </div>
                  <div className="btn-row" style={{flex: '0 0 auto'}}>
                    <button className="btn btn-sm btn-mint" onClick={() => review.mutate({id: o.id, status: 'verified'})}>ผ่าน</button>
                    <button
                      className="btn btn-sm btn-soft"
                      onClick={() =>
                        void ask({title: 'ไม่อนุมัติคำขอนี้?', message: 'ผู้ขอจะได้รับแจ้งว่าไม่ผ่านการยืนยัน', confirmLabel: 'ไม่ผ่าน', tone: 'danger'}, () =>
                          review.mutate({id: o.id, status: 'rejected'}),
                        )
                      }>
                      ไม่ผ่าน
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">ไม่มีคำขอค้าง</p>
          )}
        </div>
      </div>

      <div className="card form">
        <SectionTitle title="รูปที่ AI ตรวจพบ" />
        <p className="muted small">รูปที่ถูกปฏิเสธไม่ได้ถูกเก็บไว้ ส่วนรูปที่ “รอตรวจ” แสดงอยู่บนเว็บแล้ว กดลบได้ถ้าไม่เหมาะสม</p>
        {imageFlags.data?.length ? (
          <div className="list">
            {imageFlags.data.map(f => (
              <div key={f.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)', flexWrap: 'wrap'}}>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer">
                    <img src={f.url} alt="" style={{width: 64, height: 64, objectFit: 'cover', borderRadius: 12, filter: 'blur(6px)'}} />
                  </a>
                ) : (
                  <div className="quick-icon tone-pink"><ImageOff size={20} /></div>
                )}
                <div className="grow">
                  <b>{IMAGE_REASON[f.reason ?? ''] ?? f.reason ?? '-'} · {f.verdict === 'rejected' ? 'ปฏิเสธแล้ว' : 'รอตรวจ'}</b>
                  <p>{f.is_guest ? 'ผู้ไม่เข้าสู่ระบบ' : 'สมาชิก'} · {timeAgo(f.created_at)}</p>
                </div>
                {f.verdict === 'flagged' ? (
                  <div className="btn-row admin-actions">
                    <button className="btn btn-sm btn-mint" disabled={reviewImage.isPending} onClick={() => reviewImage.mutate({id: f.id, action: 'approve'})}>
                      ใช้ได้
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={reviewImage.isPending}
                      onClick={() =>
                        void ask({title: 'ลบรูปนี้?', message: 'รูปจะหายจากทุกประกาศหรือแชทที่ใช้รูปนี้', confirmLabel: 'ลบรูป', tone: 'danger'}, () =>
                          reviewImage.mutate({id: f.id, action: 'remove'}),
                        )
                      }>
                      ลบรูป
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">ยังไม่มีรูปที่ถูกตรวจพบ</p>
        )}
      </div>

      <AdminPostHistory isSuper={isSuper} />
    </div>
  );
}
