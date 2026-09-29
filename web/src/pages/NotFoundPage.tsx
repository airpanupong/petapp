import {Link} from 'react-router-dom';

import {CatLoader} from '../components/CatLoader';

export default function NotFoundPage() {
  return (
    <div className="page" style={{alignItems: 'center', textAlign: 'center', paddingTop: 40}}>
      <CatLoader size="lg" label="" />
      <h1 style={{fontSize: 30}}>หลงทางซะแล้ว</h1>
      <p className="muted">น้องแมวเดินหาหน้านี้ทั่วแล้ว แต่ไม่เจอเลย</p>
      <Link to="/" className="btn btn-primary">กลับหน้าแรก</Link>
    </div>
  );
}
