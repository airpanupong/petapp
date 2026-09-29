import {useState} from 'react';
import {Flag} from 'lucide-react';

import {createReport} from '../api/moderation.api';
import {getApiErrorMessage} from '../api/client';
import {useRequireLogin} from '../store/loginPromptStore';
import {toast} from '../store/toastStore';
import {Modal} from './ui';

type Target = 'lost_post' | 'found_post' | 'user' | 'message' | 'ad' | 'post';
type Reason = 'spam' | 'fake_post' | 'fraud' | 'inappropriate' | 'animal_abuse' | 'harassment' | 'other';

const REASONS: {value: Reason; label: string}[] = [
  {value: 'fake_post', label: 'ประกาศปลอม'},
  {value: 'spam', label: 'สแปม'},
  {value: 'fraud', label: 'หลอกลวง / เรียกเงิน'},
  {value: 'inappropriate', label: 'ไม่เหมาะสม'},
  {value: 'animal_abuse', label: 'ทารุณสัตว์'},
  {value: 'harassment', label: 'คุกคาม'},
  {value: 'other', label: 'อื่น ๆ'},
];

export function ReportButton({targetType, targetId}: {targetType: Target; targetId: string}) {
  const requireLogin = useRequireLogin();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('fake_post');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await createReport({target_type: targetType, target_id: targetId, reason, details: details || undefined});
      toast.ok('ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน');
      setOpen(false);
      setDetails('');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => requireLogin(() => setOpen(true), 'เข้าสู่ระบบเพื่อรายงานเนื้อหาที่ไม่เหมาะสม')}>
        <Flag size={14} /> รายงาน
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="รายงานเนื้อหา">
        <div className="chips">
          {REASONS.map(r => (
            <button key={r.value} className={`chip ${reason === r.value ? 'active' : ''}`} onClick={() => setReason(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          className="textarea"
          placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
          value={details}
          onChange={e => setDetails(e.target.value)}
        />
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'กำลังส่ง...' : 'ส่งรายงาน'}
        </button>
      </Modal>
    </>
  );
}
