import {useLocation, useNavigate} from 'react-router-dom';

import {useLoginPrompt} from '../store/loginPromptStore';
import {PetMascot} from './PetMascot';
import {Modal} from './ui';

function useAuthNav() {
  const navigate = useNavigate();
  const location = useLocation();
  return (to: '/login' | '/register') => navigate(to, {state: {from: location.pathname + location.search}});
}

function GateBody({message, onNavigate}: {message: string; onNavigate?: () => void}) {
  const go = useAuthNav();
  const nav = (to: '/login' | '/register') => {
    onNavigate?.();
    go(to);
  };
  return (
    <div className="login-gate">
      <div className="login-gate-pets">
        <PetMascot type="dog" size={76} />
        <PetMascot type="cat" size={76} />
      </div>
      <p>{message}</p>
      <div className="auth-guide login-gate-guide">
        <b className="login-gate-lead">อีกนิดเดียว ก็เริ่มแจ้งเรื่องน้องได้แล้ว</b>
        <p>
          สร้างบัญชีโดยกรอกแค่ <b>3 ช่อง</b>: ชื่อที่แสดง อีเมล และรหัสผ่าน
        </p>
        <p className="muted small">เพื่อให้คุณติดตามประกาศและพูดคุยกับคนที่เข้ามาช่วยได้</p>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => nav('/login')}>
          เข้าสู่ระบบ
        </button>
        <button className="btn btn-soft" onClick={() => nav('/register')}>
          สมัครสมาชิก
        </button>
      </div>
    </div>
  );
}

/** Shown in place of pages that need an account. */
export function LoginRequiredPage() {
  return (
    <div className="page">
      <div className="card">
        <h2 style={{textAlign: 'center', marginBottom: 4}}>ขอรู้จักกันก่อนนะ</h2>
        <GateBody message="หน้านี้ต้องเข้าสู่ระบบก่อน เพื่อให้เราดูแลข้อมูลของคุณและน้อง ๆ ได้ปลอดภัย" />
      </div>
    </div>
  );
}

/** Global prompt opened by useRequireLogin() when a guest tries an action. */
export function LoginPromptModal() {
  const reason = useLoginPrompt(s => s.reason);
  const hide = useLoginPrompt(s => s.hide);
  return (
    <Modal open={!!reason} onClose={hide} title="เข้าสู่ระบบก่อนนะ">
      <GateBody message={reason ?? ''} onNavigate={hide} />
    </Modal>
  );
}
