import {useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent} from 'react';
import {NavLink, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Bell, BookmarkCheck, Home, LogIn, MapPinned, MessageCircle, PawPrint, Plus, RefreshCw, Shield, User} from 'lucide-react';

import {useAuthStore} from '../store/authStore';
import {getUnreadNotificationCount} from '../api/features.api';
import {getUnreadChatCount} from '../api/chat.api';
import {isStaff} from '../lib/roles';
import {startChatInbox} from '../lib/chatInbox';
import {Avatar, BrandMark, ContactUs} from './ui';
import {LogoutButton} from './LogoutButton';
import {useUpdateAvailable} from '../lib/version';

const TABS = [
  {to: '/', label: 'หน้าแรก', icon: Home, end: true},
  {to: '/nearby', label: 'ใกล้ฉัน', icon: MapPinned},
  {to: '/report', label: 'แจ้งเรื่อง', icon: Plus, center: true},
  {to: '/pets', label: 'น้องของฉัน', icon: PawPrint},
  {to: '/profile', label: 'โปรไฟล์', icon: User},
];

type Indicator = {x: number; y: number; w: number; h: number; ready: boolean};

const HIDDEN: Indicator = {x: 0, y: 0, w: 0, h: 0, ready: false};

function isPathActive(pathname: string, href: string, end?: boolean) {
  if (end || href === '/') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function boxIndicator(nav: HTMLElement, target: HTMLElement, lift: number): Indicator {
  const previous = target.style.transform;
  target.style.transform = 'none';
  const navBox = nav.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  target.style.transform = previous;
  return {
    x: box.left - navBox.left,
    y: box.top - navBox.top - lift,
    w: box.width,
    h: box.height,
    ready: true,
  };
}

function pointingOval(nav: HTMLElement, tab: HTMLElement, wide: boolean, center: boolean): Indicator {
  const icon = tab.querySelector<HTMLElement>('.tab-icon');
  const label = tab.querySelector<HTMLElement>('.tab-label');
  const previous = icon?.style.transform ?? '';
  if (icon) icon.style.transform = 'none';
  const navBox = nav.getBoundingClientRect();
  if (center && icon) {
    const iconBox = icon.getBoundingClientRect();
    const labelBox = label?.getBoundingClientRect();
    icon.style.transform = previous;
    const top = iconBox.top;
    const bottom = Math.max(iconBox.bottom, labelBox?.bottom ?? iconBox.bottom);
    const left = Math.min(iconBox.left, labelBox?.left ?? iconBox.left);
    const right = Math.max(iconBox.right, labelBox?.right ?? iconBox.right);
    const padX = 10;
    const padTop = 8;
    const padBottom = 8;
    return {
      x: left - navBox.left - padX,
      y: top - navBox.top - padTop,
      w: right - left + padX * 2,
      h: bottom - top + padTop + padBottom,
      ready: true,
    };
  }
  const rects = [icon, label].filter((item): item is HTMLElement => item != null).map(item => item.getBoundingClientRect());
  if (icon) icon.style.transform = previous;
  const left = Math.min(...rects.map(rect => rect.left));
  const right = Math.max(...rects.map(rect => rect.right));
  const padX = wide ? 22 : center ? 16 : 36;
  let w = right - left + padX * 2;
  const cx = (left + right) / 2 - navBox.left;
  const inset = 6;
  const h = Math.max(navBox.height - inset * 2, 0);
  const y = inset;
  if (!wide && !center && w < h * 1.7) w = Math.round(h * 1.7);
  return {x: cx - w / 2, y, w, h, ready: true};
}

function nearestIndex(items: HTMLElement[], x: number, y: number, bounds: DOMRect, pad: number) {
  if (x < bounds.left - pad || x > bounds.right + pad || y < bounds.top - pad || y > bounds.bottom + pad) return null;
  let best = 0;
  let bestDist = Infinity;
  items.forEach((item, index) => {
    const rect = item.getBoundingClientRect();
    const dx = x - (rect.left + rect.width / 2);
    const dy = y - (rect.top + rect.height / 2);
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return items.length ? best : null;
}

function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <div>
        Pet haii
        <small>พาน้องกลับบ้าน</small>
      </div>
    </div>
  );
}

export function AppShell() {
  const user = useAuthStore(s => s.user);
  const authed = useAuthStore(s => s.status === 'authenticated');
  const updateAvailable = useUpdateAvailable();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  useEffect(() => (authed ? startChatInbox(qc) : undefined), [authed, qc]);
  const notificationUnread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: getUnreadNotificationCount,
    staleTime: Infinity,
    enabled: authed,
  });
  const chatUnread = useQuery({
    queryKey: ['chat-unread'],
    queryFn: getUnreadChatCount,
    staleTime: Infinity,
    enabled: authed,
  });
  const unread = authed ? notificationUnread.data ?? 0 : 0;
  const unreadChats = authed ? chatUnread.data ?? 0 : 0;
  const staff = isStaff(user?.role);
  const reportTo = staff ? '/admin/intake' : '/report';
  const goAuth = (to: '/login' | '/register') => navigate(to, {state: {from: location.pathname + location.search}});
  const tabRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const tabDrag = useRef({active: false, moved: false, suppressClick: false, x: 0, y: 0});
  const sideDrag = useRef({active: false, moved: false, suppressClick: false, x: 0, y: 0});
  const [tabIndicator, setTabIndicator] = useState<Indicator>(HIDDEN);
  const [sideIndicator, setSideIndicator] = useState<Indicator>(HIDDEN);
  const [pointTab, setPointTab] = useState<number | null>(null);
  const [pointSide, setPointSide] = useState<number | null>(null);
  const tabs = TABS.map(t => ({
    ...t,
    href: t.center ? reportTo : t.to,
    label: t.center && staff ? 'เพิ่มประกาศ' : t.label,
  }));
  const activeTab = tabs.findIndex(t => isPathActive(location.pathname, t.href, t.end));

  const shownTab = pointTab ?? activeTab;

  const measureTabs = useCallback(() => {
    const nav = tabRef.current;
    const tab = shownTab >= 0 ? nav?.querySelectorAll<HTMLElement>('.tab')[shownTab] : null;
    if (!nav || !tab) {
      setTabIndicator(current => ({...current, ready: false}));
      return;
    }
    const wide = window.matchMedia('(min-width: 768px)').matches;
    const center = tab.classList.contains('tab-center');
    if (pointTab != null) {
      setTabIndicator(pointingOval(nav, tab, wide, center));
      return;
    }
    const target = wide ? tab : tab.querySelector<HTMLElement>('.tab-icon') ?? tab;
    const lift = wide || center ? 0 : 7;
    setTabIndicator(boxIndicator(nav, target, lift));
  }, [shownTab, pointTab]);

  const measureSide = useCallback(() => {
    const nav = sideRef.current;
    const links = nav ? [...nav.querySelectorAll<HTMLElement>('.side-link')] : [];
    const link = pointSide != null ? links[pointSide] : links.find(item => item.classList.contains('active'));
    if (!nav || !link) {
      setSideIndicator(current => ({...current, ready: false}));
      return;
    }
    const growUp = pointSide != null ? 8 : 0;
    setSideIndicator({
      x: 0,
      y: link.offsetTop - growUp,
      w: link.offsetWidth,
      h: link.offsetHeight + growUp + (pointSide != null ? 4 : 0),
      ready: true,
    });
  }, [location.pathname, staff, pointSide]);

  const tabAt = (x: number, y: number) => {
    const nav = tabRef.current;
    if (!nav) return null;
    return nearestIndex([...nav.querySelectorAll<HTMLElement>('.tab')], x, y, nav.getBoundingClientRect(), 36);
  };

  const sideAt = (x: number, y: number) => {
    const nav = sideRef.current;
    if (!nav) return null;
    return nearestIndex([...nav.querySelectorAll<HTMLElement>('.side-link')], x, y, nav.getBoundingClientRect(), 28);
  };

  const onTabPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    tabDrag.current = {active: true, moved: false, suppressClick: false, x: event.clientX, y: event.clientY};
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* The pointer can already be gone on a cancelled touch. */
    }
    setPointTab(tabAt(event.clientX, event.clientY));
  };

  const onTabPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (tabDrag.current.active) {
      if (Math.hypot(event.clientX - tabDrag.current.x, event.clientY - tabDrag.current.y) > 8) tabDrag.current.moved = true;
      setPointTab(current => {
        const next = tabAt(event.clientX, event.clientY);
        return next === current ? current : next;
      });
      return;
    }
    if (event.pointerType !== 'mouse') return;
    setPointTab(current => {
      const next = tabAt(event.clientX, event.clientY);
      return next === current ? current : next;
    });
  };

  const onTabPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!tabDrag.current.active) return;
    const index = tabAt(event.clientX, event.clientY);
    tabDrag.current.active = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* The pointer can already be gone. */
    }
    // Capture retargets the click away from the link, so release itself navigates.
    if (index != null) {
      tabDrag.current.suppressClick = true;
      setPointTab(null);
      navigate(tabs[index].href);
      return;
    }
    setPointTab(null);
  };

  const onTabPointerLeave = () => {
    if (tabDrag.current.active) return;
    setPointTab(null);
  };

  const onTabPointerCancel = () => {
    tabDrag.current.active = false;
    setPointTab(null);
  };

  const onTabClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!tabDrag.current.suppressClick) return;
    tabDrag.current.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onSidePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    sideDrag.current = {active: true, moved: false, suppressClick: false, x: event.clientX, y: event.clientY};
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* The pointer can already be gone on a cancelled touch. */
    }
    setPointSide(sideAt(event.clientX, event.clientY));
  };

  const onSidePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (sideDrag.current.active) {
      if (Math.hypot(event.clientX - sideDrag.current.x, event.clientY - sideDrag.current.y) > 8) sideDrag.current.moved = true;
      setPointSide(current => {
        const next = sideAt(event.clientX, event.clientY);
        return next === current ? current : next;
      });
      return;
    }
    if (event.pointerType !== 'mouse') return;
    setPointSide(current => {
      const next = sideAt(event.clientX, event.clientY);
      return next === current ? current : next;
    });
  };

  const onSidePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!sideDrag.current.active) return;
    const index = sideAt(event.clientX, event.clientY);
    const link = index == null ? null : sideRef.current?.querySelectorAll<HTMLAnchorElement>('.side-link')[index];
    sideDrag.current.active = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* The pointer can already be gone. */
    }
    if (link) {
      sideDrag.current.suppressClick = true;
      setPointSide(null);
      navigate(link.pathname);
      return;
    }
    setPointSide(null);
  };

  const onSidePointerLeave = () => {
    if (sideDrag.current.active) return;
    setPointSide(null);
  };

  const onSidePointerCancel = () => {
    sideDrag.current.active = false;
    setPointSide(null);
  };

  const onSideClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!sideDrag.current.suppressClick) return;
    sideDrag.current.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const sideItems: {to: string; end?: boolean; label: string; icon: typeof Home; count?: number}[] = [
    ...TABS.filter(t => !t.center).map(t => ({to: t.to, end: t.end, label: t.label, icon: t.icon})),
    {to: '/following', label: 'เคสที่ติดตาม', icon: BookmarkCheck},
    {to: '/chat', label: 'แชท', icon: MessageCircle, count: unreadChats},
    {to: '/notifications', label: 'แจ้งเตือน', icon: Bell, count: unread},
    ...(staff ? [{to: '/admin', label: 'ผู้ดูแลระบบ', icon: Shield}] : []),
  ];

  useLayoutEffect(() => {
    measureTabs();
    measureSide();
  }, [measureTabs, measureSide]);

  useEffect(() => {
    const nav = tabRef.current;
    const side = sideRef.current;
    const observer = new ResizeObserver(() => {
      measureTabs();
      measureSide();
    });
    if (nav) observer.observe(nav);
    if (side) observer.observe(side);
    window.addEventListener('resize', measureTabs);
    window.addEventListener('resize', measureSide);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureTabs);
      window.removeEventListener('resize', measureSide);
    };
  }, [measureTabs, measureSide]);

  return (
    <div className="shell">
      {/* Desktop sidebar */}
      <aside className="sidebar glass">
        <Brand />
        <nav
          className={`side-nav ${pointSide != null ? 'is-pointing' : ''}`}
          ref={sideRef}
          onPointerDown={onSidePointerDown}
          onPointerMove={onSidePointerMove}
          onPointerUp={onSidePointerUp}
          onPointerCancel={onSidePointerCancel}
          onPointerLeave={onSidePointerLeave}
          onClickCapture={onSideClickCapture}>
          <span
            className={`side-indicator ${sideIndicator.ready ? 'is-ready' : ''} ${pointSide != null ? 'is-glass' : ''}`}
            style={{transform: `translate3d(0, ${sideIndicator.y}px, 0)`, height: sideIndicator.h || undefined}}
            aria-hidden="true"
          />
          {sideItems.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({isActive}) => {
                const lit = pointSide === null ? isActive : pointSide === index;
                return `side-link${isActive ? ' active' : ''}${lit ? ' is-lit' : ''}`;
              }}>
              <item.icon size={20} />
              {item.label}
              {item.count ? <span className="count">{item.count > 99 ? '99+' : item.count}</span> : null}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-primary side-cta" onClick={() => navigate(reportTo)}>
          <Plus size={18} /> {staff ? 'เพิ่มประกาศของแอดมิน' : 'แจ้งสัตว์หาย / พบสัตว์'}
        </button>
        {authed ? (
          <div className="side-user">
            <Avatar name={user?.display_name} url={user?.avatar_url} />
            <div className="meta">
              <b>{user?.display_name}</b>
              <span>{user?.email}</span>
            </div>
            <LogoutButton iconOnly />
          </div>
        ) : (
          <div className="side-guest">
            <p>เข้าสู่ระบบเพื่อแจ้งน้องหาย แชท และรับแจ้งเตือนใกล้บ้าน</p>
            <button className="btn btn-soft btn-block" onClick={() => goAuth('/login')}>
              <LogIn size={17} /> เข้าสู่ระบบ
            </button>
            <button className="btn btn-ghost btn-block btn-sm" onClick={() => goAuth('/register')}>
              ยังไม่มีบัญชี? สมัครเลย
            </button>
          </div>
        )}
        <ContactUs compact />
      </aside>

      {/* Phone / tablet glass top bar */}
      <header className="topbar glass">
        <Brand />
        <div className="topbar-actions">
          {authed ? (
            <>
              <button className="icon-btn" onClick={() => navigate('/following')} aria-label="เคสที่ติดตาม" title="เคสที่ติดตาม">
                <BookmarkCheck size={19} />
              </button>
              <button className="icon-btn" onClick={() => navigate('/chat')} aria-label={unreadChats ? `แชท ยังไม่อ่าน ${unreadChats}` : 'แชท'}>
                <MessageCircle size={19} />
                {unreadChats ? <span className="count-badge">{unreadChats > 99 ? '99+' : unreadChats}</span> : null}
              </button>
              <button className="icon-btn" onClick={() => navigate('/notifications')} aria-label="แจ้งเตือน">
                <Bell size={19} />
                {unread ? <span className="dot" /> : null}
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => goAuth('/login')}>
              <LogIn size={16} /> เข้าสู่ระบบ
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      {updateAvailable ? (
        <button className="update-banner glass-strong" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /> มีเวอร์ชันใหม่ แตะเพื่ออัปเดต
        </button>
      ) : null}

      {/* Phone / tablet glass tab bar */}
      <nav
        className={`tabbar glass-strong ${pointTab != null ? 'is-pointing' : ''}`}
        ref={tabRef}
        aria-label="เมนูหลัก"
        onPointerDown={onTabPointerDown}
        onPointerMove={onTabPointerMove}
        onPointerUp={onTabPointerUp}
        onPointerCancel={onTabPointerCancel}
        onPointerLeave={onTabPointerLeave}
        onClickCapture={onTabClickCapture}>
        <span
          className={`tab-indicator ${tabIndicator.ready ? 'is-ready' : ''} ${pointTab != null ? 'is-glass' : ''} ${pointTab != null && tabs[pointTab]?.center ? 'is-center' : ''}`}
          style={{
            width: tabIndicator.w || undefined,
            height: tabIndicator.h || undefined,
            transform: `translate3d(${tabIndicator.x}px, ${tabIndicator.y}px, 0)`,
          }}
          aria-hidden="true"
        />
        {tabs.map((t, index) => (
          <NavLink
            key={t.to}
            to={t.href}
            end={t.end}
            className={({isActive}) => {
              const lit = pointTab === null ? isActive : pointTab === index;
              return `tab ${t.center ? 'tab-center' : ''} ${isActive ? 'active' : ''} ${lit ? 'is-lit' : ''}`;
            }}>
            <span className="tab-icon">
              <t.icon size={t.center ? 26 : 21} strokeWidth={t.center ? 2.6 : 2} />
            </span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
