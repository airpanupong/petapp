import {FormEvent, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {Trash2} from 'lucide-react';

import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {Modal} from './ui';

export function DeleteAccountButton() {
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setUnderstood(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await deleteAccount(password);
      queryClient.clear();
      toast.ok('ลบบัญชีและข้อมูลของคุณเรียบร้อยแล้ว');
      navigate('/', {replace: true});
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-ghost delete-account-btn" onClick={() => setOpen(true)}>
        <Trash2 size={16} /> ลบบัญชี
      </button>
      <Modal open={open} onClose={close} title="ลบบัญชีถาวร?">
        <form className="form" onSubmit={e => void submit(e)}>
          <p className="muted" style={{lineHeight: 1.6}}>
            ระบบจะลบบัญชีและข้อมูลทั้งหมดของคุณทันที ได้แก่ โปรไฟล์ สัตว์เลี้ยง ประกาศตามหาและพบน้อง เบาะแส แชท
            การแจ้งเตือน และรูปภาพที่อัปโหลด <b>กู้คืนไม่ได้</b>
          </p>
          <label className="field">
            <span>ยืนยันด้วยรหัสผ่าน</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="check consent-check">
            <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} />
            <span>ฉันเข้าใจว่าข้อมูลทั้งหมดจะถูกลบถาวร</span>
          </label>
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
              ยกเลิก
            </button>
            <button className="btn btn-danger" disabled={busy || !understood || !password}>
              {busy ? 'กำลังลบ...' : 'ลบบัญชี'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
