import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {LogOut} from 'lucide-react';

import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {Modal} from './ui';

export function LogoutButton({iconOnly}: {iconOnly?: boolean}) {
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      setOpen(false);
    }
    toast.ok('ออกจากระบบแล้ว');
    navigate('/', {replace: true});
  };

  return (
    <>
      {iconOnly ? (
        <button className="icon-btn" onClick={() => setOpen(true)} title="ออกจากระบบ" aria-label="ออกจากระบบ">
          <LogOut size={17} />
        </button>
      ) : (
        <button className="btn btn-soft" onClick={() => setOpen(true)} style={{color: '#e14b4b'}}>
          <LogOut size={17} /> ออกจากระบบ
        </button>
      )}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="ออกจากระบบ?">
        <p className="muted" style={{lineHeight: 1.6}}>
          คุณจะไม่ได้รับแจ้งเตือนเรื่องน้องและแชทบนอุปกรณ์นี้ จนกว่าจะเข้าสู่ระบบอีกครั้ง
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
            ยกเลิก
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'กำลังออก...' : 'ออกจากระบบ'}
          </button>
        </div>
      </Modal>
    </>
  );
}
