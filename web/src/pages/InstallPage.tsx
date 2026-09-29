import {ReactNode, useState} from 'react';
import {
  CircleCheck,
  Compass,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  Laptop,
  MonitorDown,
  Share,
  Smartphone,
  SquarePlus,
  TriangleAlert,
} from 'lucide-react';

import {useInstallPrompt} from '../lib/install';
import {isAndroid, isInAppBrowser, isIOS, isIOSSafari, isStandalone} from '../lib/platform';
import {toast} from '../store/toastStore';
import {NotificationSetting} from '../components/PermissionHints';
import {BrandMark, PageTitle} from '../components/ui';

type Platform = 'ios' | 'android' | 'desktop';

const PLATFORMS: {value: Platform; label: string; icon: typeof Smartphone}[] = [
  {value: 'ios', label: 'iPhone / iPad', icon: Smartphone},
  {value: 'android', label: 'Android', icon: Smartphone},
  {value: 'desktop', label: 'คอมพิวเตอร์', icon: Laptop},
];

function Key({icon: Icon, children}: {icon: typeof Share; children: ReactNode}) {
  return (
    <span className="install-key">
      <Icon size={14} strokeWidth={2.4} /> {children}
    </span>
  );
}

type Step = {title: ReactNode; detail?: ReactNode; warn?: ReactNode};

const STEPS: Record<Platform, Step[]> = {
  ios: [
    {title: <>เปิด <b>pethaii.com</b> ด้วย <Key icon={Compass}>Safari</Key></>, detail: 'แอปอื่นอย่าง LINE หรือ Facebook จะเพิ่มไปยังหน้าจอโฮมไม่ได้'},
    {
      title: <>แตะปุ่ม <Key icon={Share}>แชร์</Key> ที่แถบด้านล่าง</>,
      detail: <>iOS 26 ขึ้นไป: แตะ <Key icon={Ellipsis}>เมนู</Key> มุมขวาล่างก่อน แล้วเลือก “แชร์”</>,
    },
    {
      title: <>เลื่อนลงแล้วแตะ <Key icon={SquarePlus}>เพิ่มไปยังหน้าจอโฮม</Key></>,
      detail: 'ถ้าไม่เห็น ให้แตะ “ดูเพิ่มเติม” ท้ายรายการ',
      warn: 'ไม่ใช่ “เพิ่มที่คั่นหน้า” หรือ “เพิ่มที่คั่นหน้าไปยัง” เพราะจะบันทึกไว้ใน Safari เท่านั้น',
    },
    {title: <>เปิดสวิตช์ “เปิดเป็นเว็บแอป” (ถ้ามี) แล้วแตะ <b>เพิ่ม</b> มุมขวาบน</>},
    {title: <>เปิด <b>Pet haii</b> จากไอคอนบนหน้าจอโฮม แล้วกดเปิดการแจ้งเตือนด้านล่าง</>, detail: 'iPhone จะส่งแจ้งเตือนได้เฉพาะตอนเปิดจากไอคอนบนหน้าจอโฮม'},
  ],
  android: [
    {title: <>เปิด <b>pethaii.com</b> ด้วย Chrome</>},
    {title: <>แตะ <Key icon={EllipsisVertical}>เมนู</Key> มุมขวาบน</>},
    {title: <>แตะ <Key icon={Download}>ติดตั้งแอป</Key> หรือ “เพิ่มลงในหน้าจอหลัก”</>},
    {title: <>แตะ <b>ติดตั้ง</b> ไอคอน Pet haii จะอยู่บนหน้าจอหลัก</>},
  ],
  desktop: [
    {title: <>Chrome / Edge: คลิก <Key icon={MonitorDown}>ติดตั้ง</Key> ท้ายแถบที่อยู่</>, detail: 'หรือเมนู ⋮ › บันทึกและแชร์ › ติดตั้ง Pet haii'},
    {title: <>Safari บน Mac: เมนู <b>ไฟล์</b> › <b>เพิ่มไปยัง Dock</b></>},
  ],
};

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>(isIOS ? 'ios' : isAndroid ? 'android' : 'desktop');
  const {available, install} = useInstallPrompt();
  const standalone = isStandalone();
  const openElsewhere = isInAppBrowser || (isIOS && !isIOSSafari && platform === 'ios');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://pethaii.com/');
      toast.ok('คัดลอกลิงก์แล้ว วางใน Safari หรือ Chrome ได้เลย');
    } catch {
      toast.error('คัดลอกไม่ได้ พิมพ์ pethaii.com ในเบราว์เซอร์แทนได้เลย');
    }
  };

  const installNow = async () => {
    if (await install()) toast.ok('ติดตั้ง Pet haii แล้ว');
  };

  return (
    <div className="page install-page">
      <PageTitle title="ติดตั้ง Pet haii บนมือถือ" subtitle="เปิดได้จากหน้าจอโฮมเหมือนแอป และรับแจ้งเตือนเมื่อมีน้องหายใกล้บ้าน" />

      <div className="card install-hero">
        <BrandMark />
        <div className="grow">
          <b>Pet haii</b>
          <p className="muted small">ไม่ต้องโหลดจาก App Store · ใช้พื้นที่แทบเป็นศูนย์ · อัปเดตเองอัตโนมัติ</p>
        </div>
        {available && !standalone ? (
          <button className="btn btn-primary" onClick={() => void installNow()}>
            <Download size={17} /> ติดตั้งเลย
          </button>
        ) : null}
      </div>

      {standalone ? (
        <div className="card permission-notice">
          <div className="quick-icon tone-mint"><CircleCheck size={20} /></div>
          <div className="grow">
            <b>ติดตั้งเรียบร้อยแล้ว</b>
            <p>คุณกำลังใช้ Pet haii จากหน้าจอโฮม เปิดการแจ้งเตือนด้านล่างได้เลย</p>
          </div>
        </div>
      ) : openElsewhere ? (
        <div className="card permission-notice">
          <div className="quick-icon tone-butter"><TriangleAlert size={20} /></div>
          <div className="grow">
            <b>เปิดลิงก์นี้ใน {isIOS ? 'Safari' : 'Chrome'} ก่อน</b>
            <p>แอปที่เปิดอยู่ตอนนี้เพิ่มไปยังหน้าจอโฮมไม่ได้ แตะ ••• แล้วเลือก “เปิดในเบราว์เซอร์” หรือคัดลอกลิงก์ไปวาง</p>
          </div>
          <button className="btn btn-soft btn-sm" onClick={() => void copyLink()}>
            <Copy size={15} /> คัดลอกลิงก์
          </button>
        </div>
      ) : null}

      <div className="segmented install-tabs">
        {PLATFORMS.map(p => (
          <button key={p.value} className={platform === p.value ? 'active' : ''} onClick={() => setPlatform(p.value)}>
            <p.icon size={15} /> {p.label}
          </button>
        ))}
      </div>

      <ol className="card install-steps">
        {STEPS[platform].map((step, i) => (
          <li key={i}>
            <span className="install-num">{i + 1}</span>
            <div className="grow">
              <div className="install-title">{step.title}</div>
              {step.detail ? <p className="muted small">{step.detail}</p> : null}
              {step.warn ? (
                <p className="install-warn">
                  <TriangleAlert size={13} /> {step.warn}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <NotificationSetting />
    </div>
  );
}
