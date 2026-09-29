import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {Bell, BellOff, BellRing, MapPin, MapPinOff, Smartphone, X} from 'lucide-react';

import {getApiErrorMessage} from '../api/client';
import {sendTestWebPush} from '../api/push.api';
import {GeoStatus, locationPermission, useUserPosition} from '../lib/geo';
import {disablePush, enablePush, getPushState, PushState} from '../lib/push';
import {isAndroid, isInAppBrowser, isIOS, isMobile, isStandalone} from '../lib/platform';
import {useAuthStore} from '../store/authStore';
import {useRequireLogin} from '../store/loginPromptStore';
import {toast} from '../store/toastStore';

function locationSettingsHint() {
  if (isInAppBrowser) return 'แอปนี้บล็อกตำแหน่งไว้ ลองแตะ ••• แล้วเลือก "เปิดในเบราว์เซอร์" (Safari / Chrome)';
  if (isIOS) return 'ไปที่ ตั้งค่า › ความเป็นส่วนตัวและความปลอดภัย › บริการหาตำแหน่ง › เว็บไซต์ Safari › เลือก "ขณะใช้แอป" แล้วกลับมาแตะลองอีกครั้ง';
  if (isAndroid) return 'แตะไอคอนข้างแถบที่อยู่ › สิทธิ์ › ตำแหน่ง › อนุญาต แล้วแตะลองอีกครั้ง';
  return 'คลิกไอคอนแม่กุญแจข้างแถบที่อยู่ › ตำแหน่ง › อนุญาต แล้วคลิกลองอีกครั้ง';
}

function notificationSettingsHint() {
  if (isIOS) return 'ไปที่ ตั้งค่า › การแจ้งเตือน › Pet haii › เปิด "อนุญาตการแจ้งเตือน"';
  if (isAndroid) return 'แตะไอคอนข้างแถบที่อยู่ › สิทธิ์ › การแจ้งเตือน › อนุญาต';
  return 'คลิกไอคอนแม่กุญแจข้างแถบที่อยู่ › การแจ้งเตือน › อนุญาต';
}

export function LocationNotice({status, onRetry}: {status: GeoStatus; onRetry: () => void}) {
  if (status !== 'denied' && status !== 'unavailable' && status !== 'unsupported') return null;
  const text =
    status === 'denied'
      ? locationSettingsHint()
      : status === 'unavailable'
        ? 'ตรวจสอบว่าเปิด GPS / บริการหาตำแหน่งของเครื่องไว้ แล้วลองอีกครั้ง'
        : 'เบราว์เซอร์นี้ไม่รองรับการหาตำแหน่ง';
  return (
    <div className="card permission-notice">
      <div className="quick-icon tone-butter">
        <MapPinOff size={20} />
      </div>
      <div className="grow">
        <b>{status === 'denied' ? 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง' : 'หาตำแหน่งปัจจุบันไม่ได้'}</b>
        <p>ตอนนี้แผนที่แสดงกรุงเทพฯ แทน · {text}</p>
      </div>
      {status !== 'unsupported' ? (
        <button className="btn btn-soft btn-sm" onClick={onRetry}>
          ลองอีกครั้ง
        </button>
      ) : null}
    </div>
  );
}

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    void getPushState().then(setState);
  }, []);
  return [state, setState] as const;
}

export function NotificationSetting({hideWhenOn = false}: {hideWhenOn?: boolean}) {
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<PushState>, ok?: string) => {
    setBusy(true);
    try {
      const next = await action();
      setState(next);
      if (next === 'on' && ok) toast.ok(ok);
      if (next === 'denied') toast.error('การแจ้งเตือนถูกปิดไว้ในการตั้งค่าเครื่อง');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      await sendTestWebPush();
      toast.ok('ส่งแจ้งเตือนทดสอบแล้ว');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!state || (hideWhenOn && state === 'on')) return null;

  return (
    <div className="card permission-card">
      <div className="permission-head">
        <div className={`quick-icon ${state === 'on' ? 'tone-mint' : 'tone-pink'}`}>
          {state === 'on' ? <BellRing size={20} /> : state === 'denied' ? <BellOff size={20} /> : <Bell size={20} />}
        </div>
        <div className="grow">
          <b>แจ้งเตือนบนเครื่องนี้</b>
          <p className="muted small">
            {state === 'on'
              ? 'เปิดอยู่ · จะเด้งเตือนเมื่อมีน้องหายใกล้คุณ เบาะแสใหม่ หรือข้อความแชท'
              : state === 'off'
                ? 'เปิดไว้เพื่อรู้ทันทีเมื่อมีน้องหายใกล้บ้าน แม้ไม่ได้เปิดเว็บอยู่'
                : state === 'denied'
                  ? `ถูกปิดไว้ · ${notificationSettingsHint()}`
                  : state === 'needs-install'
                    ? 'บน iPhone / iPad ต้องเพิ่ม Pet haii ไปยังหน้าจอโฮมก่อน แล้วเปิดจากไอคอนนั้น'
                    : 'เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน ลองเปิดด้วย Chrome หรือ Safari'}
          </p>
        </div>
      </div>
      {state === 'off' ? (
        <button className="btn btn-primary btn-block" disabled={busy} onClick={() => void run(enablePush, 'เปิดการแจ้งเตือนแล้ว')}>
          <Bell size={17} /> เปิดการแจ้งเตือน
        </button>
      ) : state === 'on' ? (
        <div className="btn-row">
          <button className="btn btn-soft btn-sm" disabled={busy} onClick={() => void test()}>
            ส่งทดสอบ
          </button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(disablePush)}>
            ปิดบนเครื่องนี้
          </button>
        </div>
      ) : state === 'needs-install' ? (
        <Link to="/install" className="btn btn-primary btn-block">
          <Smartphone size={17} /> ดูวิธีเพิ่มไปยังหน้าจอโฮม
        </Link>
      ) : null}
    </div>
  );
}

const SETUP_DISMISS_KEY = 'petapp.setup-dismissed';

/** First-visit checklist: install to Home Screen, allow location, allow notifications. */
export function AppSetupCard() {
  const authed = useAuthStore(s => s.status === 'authenticated');
  const requireLogin = useRequireLogin();
  const [push, setPush] = usePushState();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [askLocation, setAskLocation] = useState(false);
  const [dismissed, setDismissed] = useState(() => Number(localStorage.getItem(SETUP_DISMISS_KEY) || 0) > Date.now() - 7 * 86_400_000);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void locationPermission().then(s => setLocationGranted(s === 'granted'));
  }, []);

  const needsInstall = isMobile && !isStandalone();
  const needsLocation = locationGranted === false;
  const needsPush = push === 'off' || push === 'needs-install';
  if (dismissed || push === null || locationGranted === null || !(needsInstall || needsLocation || needsPush)) return null;

  const dismiss = () => {
    localStorage.setItem(SETUP_DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const turnOnPush = () =>
    requireLogin(async () => {
      setBusy(true);
      try {
        const next = await enablePush();
        setPush(next);
        if (next === 'on') toast.ok('เปิดการแจ้งเตือนแล้ว');
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setBusy(false);
      }
    }, 'เข้าสู่ระบบก่อน เพื่อรับแจ้งเตือนเมื่อมีน้องหายใกล้บ้าน');

  return (
    <div className="card setup-card">
      <div className="section-title">
        <div>
          <h3>ตั้งค่าให้พร้อมช่วยน้อง</h3>
          <p className="muted small">ใช้เวลาไม่ถึงนาที · รู้ทันทีเมื่อมีน้องหายแถวบ้าน</p>
        </div>
        <button className="icon-btn" onClick={dismiss} aria-label="ซ่อน">
          <X size={16} />
        </button>
      </div>
      <div className="setup-steps">
        {needsInstall ? (
          <Link to="/install" className="setup-step">
            <span className="quick-icon tone-lavender"><Smartphone size={18} /></span>
            <span className="grow">
              <b>เพิ่ม Pet haii ไปยังหน้าจอโฮม</b>
              <small>เปิดได้เหมือนแอป {isIOS ? 'และจำเป็นสำหรับการแจ้งเตือนบน iPhone' : 'ไม่ต้องโหลดจาก Store'}</small>
            </span>
            <span className="btn btn-soft btn-sm">ดูวิธี</span>
          </Link>
        ) : null}
        {needsLocation ? (
          <div className="setup-step">
            <span className="quick-icon tone-butter"><MapPin size={18} /></span>
            <span className="grow">
              <b>อนุญาตตำแหน่ง</b>
              <small>แสดงจุดที่คุณอยู่และประกาศใกล้ ๆ</small>
            </span>
            {askLocation ? (
              <LocationAsk onGranted={() => setLocationGranted(true)} />
            ) : (
              <button className="btn btn-soft btn-sm" onClick={() => setAskLocation(true)}>
                อนุญาต
              </button>
            )}
          </div>
        ) : null}
        {needsPush ? (
          <div className="setup-step">
            <span className="quick-icon tone-pink"><Bell size={18} /></span>
            <span className="grow">
              <b>เปิดการแจ้งเตือน</b>
              <small>{push === 'needs-install' ? 'เพิ่มไปยังหน้าจอโฮมก่อน แล้วเปิดจากไอคอน' : 'เด้งเตือนแม้ไม่ได้เปิดเว็บอยู่'}</small>
            </span>
            {push === 'off' ? (
              <button className="btn btn-soft btn-sm" disabled={busy} onClick={turnOnPush}>
                {authed ? 'เปิด' : 'เข้าสู่ระบบ'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LocationAsk({onGranted}: {onGranted: () => void}) {
  const {status, request} = useUserPosition();
  useEffect(() => {
    if (status === 'granted') onGranted();
  }, [status, onGranted]);
  if (status === 'denied') {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => toast.error(locationSettingsHint())}>
        ถูกปิดไว้
      </button>
    );
  }
  return (
    <button className="btn btn-soft btn-sm" onClick={request} disabled={status === 'locating'}>
      {status === 'locating' ? 'กำลังหา...' : 'ลองอีกครั้ง'}
    </button>
  );
}
