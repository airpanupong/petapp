import {ReactNode, Suspense, useEffect, useLayoutEffect} from 'react';
import {Navigate, Route, Routes, useLocation} from 'react-router-dom';

import {useAuthStore} from './store/authStore';
import {AppShell} from './components/AppShell';
import {CatLoader} from './components/CatLoader';
import {LoginPromptModal, LoginRequiredPage} from './components/LoginGate';
import {ConfirmHost, ToastHost} from './components/ui';
import {lazyPage} from './lib/lazyPage';
import {syncPushSubscription} from './lib/push';
import {useSyncKeyboardInset} from './lib/visualViewport';

const AuthPage = lazyPage(() => import('./pages/AuthPage'));
const HomePage = lazyPage(() => import('./pages/HomePage'));
const NearbyPage = lazyPage(() => import('./pages/NearbyPage'));
const ReportHubPage = lazyPage(() => import('./pages/ReportHubPage'));
const ReportLostPage = lazyPage(() => import('./pages/ReportLostPage'));
const ReportFoundPage = lazyPage(() => import('./pages/ReportFoundPage'));
const PetsPage = lazyPage(() => import('./pages/PetsPage'));
const PetFormPage = lazyPage(() => import('./pages/PetFormPage'));
const PetDetailPage = lazyPage(() => import('./pages/PetDetailPage'));
const LostDetailPage = lazyPage(() => import('./pages/LostDetailPage'));
const FoundDetailPage = lazyPage(() => import('./pages/FoundDetailPage'));
const ChatListPage = lazyPage(() => import('./pages/ChatListPage'));
const ChatThreadPage = lazyPage(() => import('./pages/ChatThreadPage'));
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'));
const FollowingPage = lazyPage(() => import('./pages/FollowingPage'));
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'));
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'));
const AdminPage = lazyPage(() => import('./pages/AdminPage'));
const AdminIntakePage = lazyPage(() => import('./pages/AdminIntakePage'));
const PublicPetPage = lazyPage(() => import('./pages/PublicPetPage'));
const NotFoundPage = lazyPage(() => import('./pages/NotFoundPage'));
const InstallPage = lazyPage(() => import('./pages/InstallPage'));
const ForgotPasswordPage = lazyPage(() => import('./pages/ForgotPasswordPage'));

function RequireAuth({children}: {children: ReactNode}) {
  const status = useAuthStore(s => s.status);
  if (status !== 'authenticated') return <LoginRequiredPage />;
  return <>{children}</>;
}

function GuestOnly({children}: {children: ReactNode}) {
  const status = useAuthStore(s => s.status);
  const location = useLocation();
  const from = (location.state as {from?: string} | null)?.from ?? '/';
  if (status === 'authenticated') return <Navigate to={from} replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const {pathname} = useLocation();
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);
  useLayoutEffect(() => {
    window.scrollTo({top: 0, left: 0, behavior: 'instant'});
  }, [pathname]);
  return null;
}

const pageFallback = <CatLoader label="กำลังพาน้องไป" />;

function Page({children, auth}: {children: ReactNode; auth?: boolean}) {
  const page = <Suspense fallback={pageFallback}>{children}</Suspense>;
  return auth ? <RequireAuth>{page}</RequireAuth> : page;
}

export function App() {
  const status = useAuthStore(s => s.status);
  const bootstrap = useAuthStore(s => s.bootstrap);
  useSyncKeyboardInset();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === 'authenticated') void syncPushSubscription().catch(() => undefined);
  }, [status]);

  if (status === 'loading') {
    return <CatLoader fullscreen size="lg" label="กำลังเตรียมบ้านให้น้อง" />;
  }

  return (
    <>
      <ScrollToTop />
      <ToastHost />
      <ConfirmHost />
      <LoginPromptModal />
      <Suspense fallback={<CatLoader fullscreen size="lg" label="กำลังพาน้องไป" />}>
        <Routes>
          <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
          <Route path="/p/:token" element={<PublicPetPage />} />

          <Route element={<AppShell />}>
            <Route index element={<Page><HomePage /></Page>} />
            <Route path="nearby" element={<Page><NearbyPage /></Page>} />
            <Route path="lost/:id" element={<Page><LostDetailPage /></Page>} />
            <Route path="found/:id" element={<Page><FoundDetailPage /></Page>} />
            <Route path="report" element={<Page><ReportHubPage /></Page>} />
            <Route path="report/lost" element={<Page auth><ReportLostPage /></Page>} />
            <Route path="report/found" element={<Page><ReportFoundPage /></Page>} />
            <Route path="lost/:id/edit" element={<Page auth><ReportLostPage /></Page>} />
            <Route path="found/:id/edit" element={<Page auth><ReportFoundPage /></Page>} />
            <Route path="pets" element={<Page auth><PetsPage /></Page>} />
            <Route path="pets/new" element={<Page auth><PetFormPage /></Page>} />
            <Route path="pets/:id" element={<Page auth><PetDetailPage /></Page>} />
            <Route path="pets/:id/edit" element={<Page auth><PetFormPage /></Page>} />
            <Route path="chat" element={<Page auth><ChatListPage /></Page>} />
            <Route path="chat/:id" element={<Page auth><ChatThreadPage /></Page>} />
            <Route path="notifications" element={<Page auth><NotificationsPage /></Page>} />
            <Route path="following" element={<Page auth><FollowingPage /></Page>} />
            <Route path="profile" element={<Page auth><ProfilePage /></Page>} />
            <Route path="install" element={<Page><InstallPage /></Page>} />
            <Route path="privacy" element={<Page><PrivacyPage /></Page>} />
            <Route path="admin" element={<Page auth><AdminPage /></Page>} />
            <Route path="admin/intake" element={<Page auth><AdminIntakePage /></Page>} />
            <Route path="*" element={<Page><NotFoundPage /></Page>} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
