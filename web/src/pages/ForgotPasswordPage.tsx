import {FormEvent, useEffect, useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {ArrowLeft, KeyRound, MailCheck, MailWarning, ShieldCheck} from 'lucide-react';
import axios from 'axios';

import {forgotPassword, resetPassword, verifyResetCode} from '../api/auth.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {BrandMark, ContactUs, PasswordInput} from '../components/ui';

type Step = 'email' | 'code' | 'password';

const STEP_ICON = {email: KeyRound, code: MailCheck, password: ShieldCheck};

function isEmailNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export default function ForgotPasswordPage() {
  const location = useLocation();
  const initialEmail = (location.state as {email?: string} | null)?.email ?? '';
  const signIn = useAuthStore(s => s.signIn);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setNotFound(false);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setNotFound(isEmailNotFound(e));
      setError(getApiErrorMessage(e));
      const body = axios.isAxiosError(e) ? e.response?.data?.error : undefined;
      if (typeof body?.details?.retry_after === 'number') setResendIn(body.details.retry_after);
      if (typeof body?.code === 'string' && body.code.startsWith('RESET_CODE')) {
        setCode('');
        setStep('code');
      }
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const result = await forgotPassword(email.trim());
      setCode('');
      setResendIn(result.resend_in);
      setStep('code');
      toast.ok('ส่งรหัสยืนยันไปที่อีเมลแล้ว');
    });

  const checkCode = (value = code) =>
    run(async () => {
      await verifyResetCode(email.trim(), value);
      setStep('password');
    });

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !busy) void checkCode(digits);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'email') void sendCode();
    else if (step === 'code') void checkCode();
    else if (password !== confirm) setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    else
      void run(async () => {
        const data = await resetPassword(email.trim(), code, password);
        toast.ok('ตั้งรหัสผ่านใหม่แล้ว เข้าสู่ระบบให้เรียบร้อย');
        await signIn(data);
      });
  };

  const Icon = STEP_ICON[step];

  return (
    <div className="auth">
      <div className="auth-card auth-card-narrow glass-strong">
        <form className="auth-form" onSubmit={submit}>
          <div className="brand" style={{alignSelf: 'center'}}>
            <BrandMark />
            Pet haii
          </div>

          <div className="reset-head">
            <span className="quick-icon tone-pink">
              <Icon size={22} />
            </span>
            <div>
              <h1 style={{fontSize: 24}}>
                {step === 'email' ? 'ลืมรหัสผ่าน' : step === 'code' ? 'กรอกรหัสยืนยัน' : 'ตั้งรหัสผ่านใหม่'}
              </h1>
              <p className="muted small">
                {step === 'email'
                  ? 'กรอกอีเมลที่ใช้สมัคร เราจะส่งรหัสยืนยัน 6 หลักไปให้'
                  : step === 'code'
                    ? <>ส่งรหัส 6 หลักไปที่ <b>{email.trim()}</b> แล้ว (ใช้ได้ 10 นาที)</>
                    : 'ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร'}
              </p>
            </div>
          </div>

          <ol className="reset-steps" aria-hidden>
            {(['email', 'code', 'password'] as Step[]).map((s, i) => (
              <li key={s} className={s === step ? 'active' : (['email', 'code', 'password'].indexOf(step) > i ? 'done' : '')} />
            ))}
          </ol>

          {step === 'email' ? (
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
                autoFocus
              />
            </label>
          ) : step === 'code' ? (
            <label className="field">
              <span>รหัสยืนยัน</span>
              <input
                className="input otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                value={code}
                onChange={e => onCodeChange(e.target.value)}
                required
                minLength={6}
                maxLength={6}
                autoFocus
              />
              <span className="spam-hint" role="note">
                <MailWarning size={18} />
                <span>
                  ไม่เห็นอีเมล? ลองดูในโฟลเดอร์ <b>จดหมายขยะ / Junk / Spam</b> จาก <b>support@pethaii.com</b>
                  {' '}แล้วกด "ไม่ใช่ขยะ" เพื่อให้ครั้งต่อไปเข้ากล่องจดหมายปกติ
                </span>
              </span>
            </label>
          ) : (
            <>
              <label className="field">
                <span>รหัสผ่านใหม่</span>
                <PasswordInput value={password} onChange={setPassword} placeholder="กรอกรหัสผ่านใหม่" autoComplete="new-password" minLength={8} />
                <small className="field-hint">อย่างน้อย 8 ตัวอักษร</small>
              </label>
              <label className="field">
                <span>ยืนยันรหัสผ่านใหม่</span>
                <PasswordInput value={confirm} onChange={setConfirm} placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" autoComplete="new-password" minLength={8} />
              </label>
            </>
          )}

          {error ? (
            <p className="error-text">
              {error}
              {notFound ? (
                <>
                  {' '}
                  <Link to="/register" style={{fontWeight: 600, textDecoration: 'underline'}}>
                    สมัครบัญชีใหม่
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <button className="btn btn-primary btn-block" disabled={busy || (step === 'code' && code.length < 6)}>
            {busy ? 'รอสักครู่...' : step === 'email' ? 'ส่งรหัสยืนยัน' : step === 'code' ? 'ยืนยันรหัส' : 'บันทึกรหัสผ่านใหม่'}
          </button>

          {step === 'code' ? (
            <div className="reset-links">
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
                {resendIn > 0 ? `ส่งรหัสใหม่ได้ใน ${resendIn} วินาที` : 'ส่งรหัสใหม่'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('email'); setError(null); }}>
                เปลี่ยนอีเมล
              </button>
            </div>
          ) : null}

          <Link to="/login" state={location.state} className="btn btn-ghost btn-sm" style={{alignSelf: 'center'}}>
            <ArrowLeft size={15} /> กลับไปหน้าเข้าสู่ระบบ
          </Link>
          <ContactUs className="auth-contact" />
        </form>
      </div>
    </div>
  );
}
