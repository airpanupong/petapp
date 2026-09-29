import {NavLink, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Bell, Home, LogIn, MapPinned, MessageCircle, PawPrint, Plus, RefreshCw, Shield, User} from 'lucide-react';

import {useAuthStore} from '../store/authStore';
import {getUnreadNotificationCount} from '../api/features.api';
import {getUnreadChatCount} from '../api/chat.api';
import {isStaff} from '../lib/roles';
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
  const notificationUnread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 60_000,
    enabled: authed,
  });
  const chatUnread = useQuery({
    queryKey: ['chat-unread'],
    queryFn: getUnreadChatCount,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    enabled: authed,
  });
  const unread = authed ? notificationUnread.data ?? 0 : 0;
  const unreadChats = authed ? chatUnread.data ?? 0 : 0;
  const goAuth = (to: '/login' | '/register') => navigate(to, {state: {from: location.pathname + location.search}});

  return (
    <div className="shell">
      {/* Desktop sidebar */}
      <aside className="sidebar glass">
        <Brand />
        <nav className="side-nav">
          {TABS.filter(t => !t.center).map(t => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({isActive}) => `side-link ${isActive ? 'active' : ''}`}>
              <t.icon size={20} />
              {t.label}
            </NavLink>
          ))}
          <NavLink to="/chat" className={({isActive}) => `side-link ${isActive ? 'active' : ''}`}>
            <MessageCircle size={20} />
            แชท
            {unreadChats ? <span className="count">{unreadChats > 99 ? '99+' : unreadChats}</span> : null}
          </NavLink>
          <NavLink to="/notifications" className={({isActive}) => `side-link ${isActive ? 'active' : ''}`}>
            <Bell size={20} />
            แจ้งเตือน
            {unread ? <span className="count">{unread}</span> : null}
          </NavLink>
          {isStaff(user?.role) ? (
            <NavLink to="/admin" className={({isActive}) => `side-link ${isActive ? 'active' : ''}`}>
              <Shield size={20} />
              ผู้ดูแลระบบ
            </NavLink>
          ) : null}
        </nav>
        <button className="btn btn-primary side-cta" onClick={() => navigate('/report')}>
          <Plus size={18} /> แจ้งสัตว์หาย / พบสัตว์
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
      <nav className="tabbar glass-strong" aria-label="เมนูหลัก">
        {TABS.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({isActive}) => `tab ${t.center ? 'tab-center' : ''} ${isActive ? 'active' : ''}`}>
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
