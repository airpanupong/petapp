import {ReactNode, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2, AlertCircle, Eye, EyeOff, Mail, MessageCircle, X} from 'lucide-react';

import {useToast} from '../store/toastStore';
import {useConfirmStore} from '../store/confirmStore';
import {APP_VERSION} from '../lib/version';
import {resolveMediaUrl} from '../api/uploads.api';
import {SUPPORT_EMAIL, SUPPORT_LINE_ID, SUPPORT_LINE_KEYWORDS, SUPPORT_LINE_URL, lineKeywordUrl} from '../lib/config';
import {initials, statusLabel, statusTone} from '../lib/format';
import {CatWalk} from './CatLoader';

export function BrandMark() {
  return (
    <div className="brand-logo">
      <img src="/logo-mark.png" alt="Pet haii" />
    </div>
  );
}

function LineMark({size = 22}: {size?: number}) {
  return (
    <span className="line-mark" style={{width: size, height: size}} aria-hidden="true">
      <MessageCircle size={Math.round(size * 0.62)} fill="#fff" strokeWidth={0} />
    </span>
  );
}

export function ContactUs({compact, className = ''}: {compact?: boolean; className?: string}) {
  if (compact) {
    return (
      <div className={`contact-mini ${className}`}>
        <span className="contact-mini-title">ติดต่อเรา</span>
        <div className="contact-mini-actions">
          <a className="contact-mini-line" href={SUPPORT_LINE_URL} target="_blank" rel="noreferrer">
            <LineMark size={20} />
            {SUPPORT_LINE_ID}
          </a>
          <a className="contact-mini-mail" href={`mailto:${SUPPORT_EMAIL}`} title={SUPPORT_EMAIL} aria-label={`อีเมล ${SUPPORT_EMAIL}`}>
            <Mail size={16} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`contact-us ${className}`}>
      <div className="contact-us-head">
        <b>ติดต่อเรา</b>
        <span>ทีมงานตอบกลับทาง LINE ไวที่สุด</span>
      </div>

      <a className="contact-us-line" href={SUPPORT_LINE_URL} target="_blank" rel="noreferrer">
        <LineMark size={30} />
        <span className="contact-us-line-text">
          <small>แอดไลน์</small>
          <b>{SUPPORT_LINE_ID}</b>
        </span>
        <span className="contact-us-line-cta">เพิ่มเพื่อน</span>
      </a>

      <div className="contact-us-keywords">
        <p>พิมพ์คีย์เวิร์ดในแชท LINE เพื่อรับรายละเอียด (กดเพื่อส่งได้เลย)</p>
        {SUPPORT_LINE_KEYWORDS.map(item => (
          <a key={item.keyword} className="contact-us-keyword" href={lineKeywordUrl(item.keyword)} target="_blank" rel="noreferrer">
            <b>{item.keyword}</b>
            <span>{item.description}</span>
          </a>
        ))}
      </div>

      <a className="contact-us-mail" href={`mailto:${SUPPORT_EMAIL}`}>
        <Mail size={15} />
        {SUPPORT_EMAIL}
      </a>
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder = 'กรอกรหัสผ่าน',
  autoComplete = 'current-password',
  minLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        className="input"
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        minLength={minLength}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        aria-pressed={visible}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function PageTitle({title, subtitle, action}: {title: ReactNode; subtitle?: ReactNode; action?: ReactNode}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({title, action}: {title: ReactNode; action?: ReactNode}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function StatusBadge({status}: {status?: string | null}) {
  return <span className={`badge ${statusTone(status)}`}>{statusLabel(status)}</span>;
}

export function EmptyState({title, description, action}: {
  animal?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card empty">
      <CatWalk />
      <h3>{title}</h3>
      {description ? <p className="muted small">{description}</p> : null}
      {action}
    </div>
  );
}

export function Avatar({name, url, size}: {name?: string | null; url?: string | null; size?: 'lg'}) {
  const src = resolveMediaUrl(url);
  return (
    <div className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`}>
      {src ? <img src={src} alt={name ?? ''} /> : initials(name)}
    </div>
  );
}

export function ConfirmHost() {
  const request = useConfirmStore(s => s.request);
  const settle = useConfirmStore(s => s.settle);
  return (
    <Modal open={!!request} onClose={() => settle(false)} title={request?.title ?? ''}>
      {request?.message ? <p className="muted" style={{lineHeight: 1.6, whiteSpace: 'pre-line'}}>{request.message}</p> : null}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
          {request?.cancelLabel ?? 'ไม่ใช่ตอนนี้'}
        </button>
        <button
          type="button"
          className={`btn ${request?.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => settle(true)}>
          {request?.confirmLabel ?? 'ยืนยัน'}
        </button>
      </div>
    </Modal>
  );
}

export function VersionTag() {
  return <div className="demo-box" style={{textAlign: 'center'}}>Version {APP_VERSION}</div>;
}

export function ToastHost() {
  const toasts = useToast(s => s.toasts);
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast glass-strong ${t.kind === 'error' ? 'error' : ''}`}>
          {t.kind === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} color="var(--mint-strong)" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function Modal({open, onClose, title, children}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass-strong" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="section-title">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
