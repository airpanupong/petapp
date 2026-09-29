import {useDeferredValue, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Ban, Eye, EyeOff, Flag, HeartHandshake, Search, ShieldCheck, Siren, UserCheck, Users} from 'lucide-react';

import {
  adminCloseFound,
  adminCloseLost,
  adminSetPostHidden,
  adminSetUserBlocked,
  adminSetUserRole,
  getAdminMetrics,
  listAdminFoundPosts,
  listAdminLostPosts,
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
import {animalLabel, timeAgo} from '../lib/format';
import {isStaff, isSuperAdmin, roleLabel} from '../lib/roles';
import {CatLoader} from '../components/CatLoader';
import {Avatar, PageTitle, SectionTitle, StatusBadge} from '../components/ui';

const VISIBLE_POST_STATUSES = ['active', 'hidden'];

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
  const lost = useQuery({queryKey: ['admin-lost'], queryFn: listAdminLostPosts, enabled: isAdmin});
  const found = useQuery({queryKey: ['admin-found'], queryFn: listAdminFoundPosts, enabled: isAdmin});
  const users = useQuery({
    queryKey: ['admin-users', deferredQuery],
    queryFn: () => listAdminUsers(deferredQuery || undefined),
    enabled: isAdmin,
  });

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
  const closeLost = useMutation({mutationFn: adminCloseLost, onSuccess: refresh, onError});
  const closeFound = useMutation({mutationFn: adminCloseFound, onSuccess: refresh, onError});
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
  const setHidden = useMutation({
    mutationFn: ({kind, id, hidden}: {kind: 'lost' | 'found'; id: string; hidden: boolean}) => adminSetPostHidden(kind, id, hidden),
    onSuccess: (_, v) => {
      toast.ok(v.hidden ? 'ซ่อนประกาศแล้ว' : 'แสดงประกาศอีกครั้งแล้ว');
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
  ];
  const pendingOwnership = ownership.data?.filter(o => o.status === 'pending') ?? [];
  const lostRows = lost.data?.filter(p => VISIBLE_POST_STATUSES.includes(p.status)) ?? [];
  const foundRows = found.data?.filter(p => VISIBLE_POST_STATUSES.includes(p.status)) ?? [];

  const postActions = (kind: 'lost' | 'found', id: string, status: string) => (
    <div className="btn-row admin-actions">
      {isSuper ? (
        status === 'hidden' ? (
          <button className="btn btn-sm btn-mint" onClick={() => setHidden.mutate({kind, id, hidden: false})}>
            <Eye size={14} /> แสดง
          </button>
        ) : (
          <button
            className="btn btn-sm btn-soft"
            onClick={() =>
              void ask({title: 'ซ่อนประกาศนี้?', message: 'ประกาศจะไม่แสดงต่อผู้ใช้ทั่วไป จนกว่าจะกดแสดงอีกครั้ง', confirmLabel: 'ซ่อน', tone: 'danger'}, () =>
                setHidden.mutate({kind, id, hidden: true}),
              )
            }>
            <EyeOff size={14} /> ซ่อน
          </button>
        )
      ) : null}
      {status === 'active' ? (
        <button
          className="btn btn-sm btn-soft"
          onClick={() =>
            void ask({title: 'ปิดประกาศนี้?', message: 'ประกาศจะไม่แสดงบนหน้าแรกและแผนที่อีก', confirmLabel: 'ปิดประกาศ', tone: 'danger'}, () =>
              (kind === 'lost' ? closeLost : closeFound).mutate(id),
            )
          }>
          ปิด
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="page">
      <PageTitle
        title="ผู้ดูแลระบบ"
        subtitle={isSuper ? 'Super Admin · บล็อกผู้ใช้ ซ่อนประกาศ และจัดการสิทธิ์' : 'ภาพรวมและงานที่รอดำเนินการ'}
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
        <SectionTitle title="จัดการผู้ใช้" />
        <label className="admin-search">
          <Search size={16} />
          <input
            className="input"
            placeholder="ค้นหาชื่อหรืออีเมล"
            value={userQuery}
            onChange={e => setUserQuery(e.target.value)}
          />
        </label>
        {!isSuper ? <p className="muted small">เฉพาะ Super Admin เท่านั้นที่บล็อกผู้ใช้และเปลี่ยนสิทธิ์ได้</p> : null}
        <div className="list admin-users">
          {users.data?.map(u => {
            const blocked = u.status === 'blocked' || u.status === 'suspended';
            const editable = isSuper && u.id !== user?.id && u.role !== 'super_admin';
            return (
              <div key={u.id} className={`list-item admin-user ${blocked ? 'is-blocked' : ''}`}>
                <Avatar name={u.display_name} url={u.avatar_url} />
                <div className="grow">
                  <b>{u.display_name}</b>
                  <p>{u.email}</p>
                </div>
                <div className="admin-user-badges">
                  {isStaff(u.role) ? <span className="badge tone-lavender">{roleLabel(u.role)}</span> : null}
                  {blocked ? <StatusBadge status={u.status} /> : null}
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
          {users.data && !users.data.length ? <p className="muted small">ไม่พบผู้ใช้</p> : null}
        </div>
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

      <div className="grid grid-2">
        <div className="card form">
          <SectionTitle title={`ประกาศหาย (${lostRows.length})`} />
          <div className="list">
            {lostRows.map(p => (
              <div key={p.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)', flexWrap: 'wrap'}}>
                <div className="grow">
                  <b>{p.pet?.name ?? p.title}</b>
                  <p>{p.location_text} · {timeAgo(p.created_at)}</p>
                </div>
                <StatusBadge status={p.status} />
                {postActions('lost', p.id, p.status)}
              </div>
            ))}
          </div>
        </div>
        <div className="card form">
          <SectionTitle title={`ประกาศพบ (${foundRows.length})`} />
          <div className="list">
            {foundRows.map(p => (
              <div key={p.id} className="list-item" style={{boxShadow: 'none', background: 'var(--surface-soft)', flexWrap: 'wrap'}}>
                <div className="grow">
                  <b>พบ{animalLabel(p.animal_type)} {p.color ?? ''}</b>
                  <p>{p.location_text} · {timeAgo(p.created_at)}</p>
                </div>
                <StatusBadge status={p.status} />
                {postActions('found', p.id, p.status)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
