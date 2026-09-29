import {FormEvent, useState} from 'react';
import {Link, useLocation} from 'react-router-dom';

import {useAuthStore} from '../store/authStore';
import {getApiErrorMessage} from '../api/client';
import {PetMascot} from '../components/PetMascot';
import {BrandMark, ContactUs, PasswordInput, VersionTag} from '../components/ui';

// const DEMO = ['demo@example.com', 'finder@example.com', 'admin@example.com'];

export default function AuthPage({mode}: {mode: 'login' | 'register'}) {
  const login = useAuthStore(s => s.login);
  const register = useAuthStore(s => s.register);
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLogin) await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card glass-strong">
        <div className="auth-art">
          <div className="brand">
            <BrandMark />
            Pet haii
          </div>
          <div>
            <h2>
              พาน้องๆ กลับบ้าน
             
            </h2>
            <p className="muted" style={{marginTop: 12}}>
              ลงทะเบียน Pet Haii, แจ้งสัตว์หาย, ช่วยกันตามหาน้องในละแวกบ้าน
            </p>
          </div>
          <div className="pets">
            <PetMascot type="dog" size={92} />
            <PetMascot type="cat" size={92} />
            <PetMascot type="other" size={92} />
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-compact-brand">
            <div className="pets">
              <PetMascot type="dog" size={68} />
              <PetMascot type="cat" size={68} />
              <PetMascot type="other" size={68} />
            </div>
            <b>Pet haii</b>
          </div>
          <div>
            <h1 style={{fontSize: 28}}>{isLogin ? 'ยินดีต้อนรับกลับ' : 'สร้างบัญชีใหม่'}</h1>
            {isLogin ? (
              <p className="muted" style={{marginTop: 6}}>เข้าสู่ระบบเพื่อดูแลน้อง ๆ ของคุณ</p>
            ) : (
              <p className="auth-lead">
                อีกนิดเดียว ก็เริ่มแจ้งเรื่องน้องได้แล้ว
                <span className="auth-lead-pets" aria-hidden>
                  <PetMascot type="dog" size={26} />
                  <PetMascot type="cat" size={26} />
                </span>
              </p>
            )}
          </div>

          {!isLogin ? (
            <div className="auth-guide">
              <p>
                สร้างบัญชีโดยกรอกแค่ <b>3 ช่อง</b>: ชื่อที่แสดง อีเมล และรหัสผ่าน
              </p>
              <p className="muted small">เพื่อให้คุณติดตามประกาศและพูดคุยกับคนที่เข้ามาช่วยได้</p>
            </div>
          ) : null}

          {!isLogin ? (
            <label className="field">
              <span>ชื่อที่แสดง</span>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น แม่น้องมะลิ"
                autoComplete="nickname"
                required
                minLength={2}
              />
              <small className="field-hint">ชื่อนี้จะแสดงให้คนที่คุยด้วยเห็น</small>
            </label>
          ) : null}
          <label className="field">
            <span>อีเมล</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="กรอกอีเมล"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label-row">
              รหัสผ่าน
              {isLogin ? (
                <Link to="/forgot-password" state={{email: email.trim(), from: (location.state as {from?: string} | null)?.from}} className="field-link">
                  ลืมรหัสผ่าน?
                </Link>
              ) : null}
            </span>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={isLogin ? 1 : 8}
            />
            {!isLogin ? <small className="field-hint">อย่างน้อย 8 ตัวอักษร</small> : null}
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'รอสักครู่...' : isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>

          <p className="muted small" style={{textAlign: 'center'}}>
            {isLogin ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีแล้ว? '}
            <Link to={isLogin ? '/register' : '/login'} state={location.state} style={{color: 'var(--primary-strong)', fontWeight: 500}}>
              {isLogin ? 'สมัครเลย' : 'เข้าสู่ระบบ'}
            </Link>
          </p>
          <Link to="/" className="btn btn-ghost btn-sm" style={{alignSelf: 'center'}}>
            ← ดูน้อง ๆ ก่อน ยังไม่เข้าสู่ระบบ
          </Link>
          <ContactUs className="auth-contact" />
          <VersionTag />
          {/* {isLogin ? (
            <div className="demo-box">
              บัญชีทดลอง (รหัส Demo123!)
              <div>
                {DEMO.map(d => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => {
                      setEmail(d);
                      setPassword('Demo123!');
                    }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          ) : null} */}
        </form>
      </div>
    </div>
  );
}
