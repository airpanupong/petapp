import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Bell, CalendarCheck, Eye, HeartHandshake, MessageCircle, PartyPopper, Search, Siren, Trash2, X} from 'lucide-react';

import {
  deleteAllNotifications,
  deleteNotification,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../api/features.api';
import {getApiErrorMessage} from '../api/client';
import {AppNotification, NotificationPreference} from '../types/api';
import {timeAgo} from '../lib/format';
import {cursorOf} from '../lib/pagination';
import {usePostAction} from '../lib/postActions';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {CatLoader} from '../components/CatLoader';
import {InfiniteSentinel} from '../components/InfiniteSentinel';
import {AnimalOption} from '../components/PetMascot';
import {EmptyState, PageTitle} from '../components/ui';
import {NotificationSetting} from '../components/PermissionHints';

function iconFor(type: string) {
  if (type === 'lost_checkin') return CalendarCheck;
  if (type === 'lost_resolved') return PartyPopper;
  if (type.includes('lost')) return Siren;
  if (type.includes('found')) return HeartHandshake;
  if (type.includes('sighting')) return Eye;
  if (type.includes('chat') || type.includes('message')) return MessageCircle;
  return Bell;
}

function linkFor(n: AppNotification) {
  if (!n.reference_id) return null;
  switch (n.reference_type) {
    case 'lost_post':
      return `/lost/${n.reference_id}`;
    case 'found_post':
      return `/found/${n.reference_id}`;
    case 'pet':
      return `/pets/${n.reference_id}`;
    case 'conversation':
      return `/chat/${n.reference_id}`;
    default:
      return null;
  }
}

const PAGE_SIZE = 30;
const LIST_KEY = ['notifications', 'list'];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: LIST_KEY,
    queryFn: ({pageParam}) => listNotifications({before: pageParam, limit: PAGE_SIZE}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.length === PAGE_SIZE ? cursorOf(last[last.length - 1]) : undefined),
  });
  const rows = list.data?.pages.flat() ?? [];
  const {fetchNextPage} = list;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void qc.invalidateQueries({queryKey: ['notifications']}),
  });

  const remove = useMutation({
    mutationFn: deleteNotification,
    onMutate: id =>
      qc.setQueryData<InfiniteData<AppNotification[]>>(LIST_KEY, data => data && {...data, pages: data.pages.map(p => p.filter(n => n.id !== id))}),
    onError: e => toast.error(getApiErrorMessage(e)),
    onSettled: () => void qc.invalidateQueries({queryKey: ['notifications']}),
  });

  const removeAll = useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      qc.setQueryData<InfiniteData<AppNotification[], string | undefined>>(LIST_KEY, {pages: [[]], pageParams: [undefined]});
      toast.ok('ลบแจ้งเตือนทั้งหมดแล้ว');
    },
    onError: e => toast.error(getApiErrorMessage(e)),
    onSettled: () => void qc.invalidateQueries({queryKey: ['notifications']}),
  });

  const clearAll = async () => {
    const ok = await confirmAction({
      title: 'ลบแจ้งเตือนทั้งหมด?',
      message: 'แจ้งเตือนที่ลบแล้วจะกู้คืนไม่ได้',
      confirmLabel: 'ลบทั้งหมด',
      tone: 'danger',
    });
    if (ok) removeAll.mutate();
  };

  const hasItems = rows.length > 0;

  const open = async (n: AppNotification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => undefined);
      void qc.invalidateQueries({queryKey: ['notifications']});
    }
    const to = linkFor(n);
    if (to) navigate(to);
  };

  return (
    <div className="page">
      <PageTitle
        title="แจ้งเตือน"
        subtitle="Lost Alert, เบาะแสใหม่ และข้อความ"
        action={
          hasItems ? (
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <button className="btn btn-soft btn-sm" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
                อ่านทั้งหมด
              </button>
              <button className="icon-btn" onClick={() => void clearAll()} disabled={removeAll.isPending} aria-label="ลบทั้งหมด" title="ลบทั้งหมด">
                <Trash2 size={17} />
              </button>
            </div>
          ) : null
        }
      />
      <div className="split">
        <div>
          {list.isLoading ? (
            <CatLoader label="กำลังเช็คข่าวใหม่" />
          ) : rows.length ? (
            <div className="list">
              {rows.map(n => {
                const Icon = iconFor(n.type);
                const askCheckin = n.type === 'lost_checkin' && !n.is_read && n.reference_id;
                return (
                <div key={n.id} className="notif-card">
                  <div className="notif-main">
                    <button className="list-item" onClick={() => void open(n)} style={n.is_read ? {opacity: 0.7} : undefined}>
                      <div className={`quick-icon ${n.is_read ? 'tone-sky' : 'tone-pink'}`}><Icon size={20} /></div>
                      <div className="grow">
                        <b>{n.title}</b>
                        <p style={{whiteSpace: 'normal'}}>{n.body}</p>
                        <span className="muted notif-time">{timeAgo(n.created_at)}</span>
                      </div>
                    </button>
                    <button type="button" className="notif-delete" onClick={() => remove.mutate(n.id)} aria-label="ลบแจ้งเตือน" title="ลบ">
                      <X size={16} />
                    </button>
                  </div>
                  {askCheckin ? <CheckinActions postId={n.reference_id!} name={checkinPetName(n.title)} /> : null}
                </div>
                );
              })}
              <InfiniteSentinel hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoadMore={loadMore} />
            </div>
          ) : (
            <EmptyState animal="cat" title="ยังไม่มีแจ้งเตือน" description="เราจะบอกทันทีเมื่อมีน้องหายใกล้คุณ" />
          )}
        </div>
        <div className="split-sticky" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <NotificationSetting hideWhenOn />
          <Preferences />
        </div>
      </div>
    </div>
  );
}

function checkinPetName(title: string) {
  return title.match(/^เจอ (.+) แล้วหรือยัง\?$/)?.[1] ?? 'น้อง';
}

function CheckinActions({postId, name}: {postId: string; name: string}) {
  const {run, pending} = usePostAction('lost', postId, name);
  return (
    <div className="notif-actions">
      <button type="button" className="btn btn-mint btn-sm" disabled={pending} onClick={() => void run('resolve')}>
        <PartyPopper size={15} /> เจอแล้ว
      </button>
      <button type="button" className="btn btn-soft btn-sm" disabled={pending} onClick={() => void run('still-searching')}>
        <Search size={15} /> ยังไม่เจอ ตามหาต่อ
      </button>
    </div>
  );
}

function Preferences() {
  const qc = useQueryClient();
  const prefs = useQuery({queryKey: ['notification-prefs'], queryFn: getNotificationPreferences});
  const [form, setForm] = useState<Pick<NotificationPreference, 'lost_alerts' | 'radius_km' | 'animal_type' | 'chat_notifications' | 'marketing_notifications'> | null>(null);

  useEffect(() => {
    if (prefs.data) setForm(prefs.data);
  }, [prefs.data]);

  const save = useMutation({
    mutationFn: () => updateNotificationPreferences(form!),
    onSuccess: () => {
      toast.ok('บันทึกการตั้งค่าแล้ว');
      void qc.invalidateQueries({queryKey: ['notification-prefs']});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  if (!form) return <CatLoader size="sm" label="" />;

  return (
    <div className="card form">
      <h3>ตั้งค่า Lost Alert</h3>
      <label className="check">
        <input type="checkbox" checked={form.lost_alerts} onChange={e => setForm({...form, lost_alerts: e.target.checked})} />
        แจ้งเตือนเมื่อมีน้องหาย หรือมีคนพบน้องใกล้ฉัน
      </label>
      <label className="field">
        <span>รัศมี: {form.radius_km} กม.</span>
        <input type="range" min={1} max={20} value={form.radius_km} onChange={e => setForm({...form, radius_km: Number(e.target.value)})} style={{accentColor: 'var(--primary-strong)'}} />
      </label>
      <div className="chips">
        {(['all', 'dog', 'cat', 'other'] as const).map(a => (
          <button key={a} className={`chip ${form.animal_type === a ? 'active' : ''}`} onClick={() => setForm({...form, animal_type: a})}>
            {a === 'all' ? 'ทุกชนิด' : <AnimalOption type={a} />}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={form.chat_notifications} onChange={e => setForm({...form, chat_notifications: e.target.checked})} />
        แจ้งเตือนข้อความแชท
      </label>
      <label className="check">
        <input type="checkbox" checked={form.marketing_notifications} onChange={e => setForm({...form, marketing_notifications: e.target.checked})} />
        ข่าวสาร & โปรโมชัน
      </label>
      <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>บันทึก</button>
    </div>
  );
}
