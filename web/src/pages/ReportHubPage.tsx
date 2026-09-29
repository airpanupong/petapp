import {Link} from 'react-router-dom';
import {ChevronRight, Eye, HeartHandshake, IdCard, Siren} from 'lucide-react';

import {PageTitle} from '../components/ui';

const OPTIONS = [
  {
    to: '/report/lost',
    icon: Siren,
    tone: 'tone-pink',
    title: 'น้องของฉันหาย',
    desc: 'เลือกน้องที่ลงทะเบียนไว้ แล้วปักหมุดจุดที่หาย ระบบจะแจ้งเตือนคนแถวนั้น',
  },
  {
    to: '/report/found',
    icon: HeartHandshake,
    tone: 'tone-mint',
    title: 'ฉันพบน้องหลงทาง',
    desc: 'ถ่ายรูปและปักหมุด เพื่อช่วยให้เจ้าของตามหาเจอ',
  },
  {
    to: '/nearby',
    icon: Eye,
    tone: 'tone-butter',
    title: 'เห็นแต่จับไว้ไม่ได้',
    desc: 'เปิดประกาศที่ตรงกันในหน้าใกล้ฉัน แล้วกด “แจ้งเบาะแส” เพื่อส่งตำแหน่งให้เจ้าของ',
  },
  {
    to: '/pets/new',
    icon: IdCard,
    tone: 'tone-lavender',
    title: 'ลงทะเบียน Pet Haii',
    desc: 'รับ QR Code ติดปลอกคอ ใครพบน้องก็สแกนติดต่อคุณได้ทันที',
  },
];

export default function ReportHubPage() {
  return (
    <div className="page">
      <PageTitle title="ช่วยน้องกลับบ้าน" subtitle="เลือกสิ่งที่ต้องการแจ้ง เราทำให้ขั้นตอนสั้นที่สุด" />
      <div className="grid grid-2">
        {OPTIONS.map(o => (
          <Link key={o.to} to={o.to} className="list-item" style={{padding: 20, alignItems: 'flex-start'}}>
            <div className={`quick-icon ${o.tone}`} style={{width: 56, height: 56}}>
              <o.icon size={26} />
            </div>
            <div className="grow">
              <b style={{fontSize: 17}}>{o.title}</b>
              <p style={{whiteSpace: 'normal', marginTop: 4}}>{o.desc}</p>
            </div>
            <ChevronRight size={20} color="var(--text-soft)" />
          </Link>
        ))}
      </div>
    </div>
  );
}
