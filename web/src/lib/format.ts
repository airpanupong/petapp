export function animalLabel(type?: string | null) {
  if (type === 'dog') return 'สุนัข';
  if (type === 'cat') return 'แมว';
  return 'อื่น ๆ';
}

const COLOR_WORDS: Record<string, string> = {
  black: 'ดำ',
  white: 'ขาว',
  brown: 'น้ำตาล',
  orange: 'ส้ม',
  gray: 'เทา',
  grey: 'เทา',
  cream: 'ครีม',
  yellow: 'เหลือง',
  golden: 'ทอง',
  gold: 'ทอง',
  tan: 'น้ำตาลอ่อน',
  red: 'แดง',
  sesame: 'งา',
  point: 'พอยท์',
  'tri-color': 'สามสี',
  tricolor: 'สามสี',
  calico: 'สามสี',
  tabby: 'ลายสลิด',
};

/** Colors are free text; translate common English values (e.g. "brown-white") and keep anything else as typed. */
export function colorLabel(color?: string | null) {
  const value = color?.trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  if (COLOR_WORDS[lower]) return COLOR_WORDS[lower];
  const parts = lower.split(/[-\s/]+/);
  return parts.every(p => COLOR_WORDS[p]) ? parts.map(p => COLOR_WORDS[p]).join('') : value;
}

/** "สีขาว", "สามสี", "ลายเสือ" already read as colors; bare ones like "ขาว-ดำ" get a "สี" prefix. */
export function colorPhrase(color?: string | null) {
  const label = colorLabel(color);
  if (!label) return '';
  return label.includes('สี') || label.startsWith('ลาย') ? label : `สี${label}`;
}

const STATUS_LABEL: Record<string, string> = {
  normal: 'อยู่บ้าน',
  lost: 'หาย',
  found: 'พบแล้ว',
  active: 'กำลังตามหา',
  resolved: 'เจอแล้ว',
  cancelled: 'ยกเลิกแล้ว',
  closed: 'ปิดแล้ว',
  pending: 'รอตรวจสอบ',
  verified: 'ยืนยันแล้ว',
  rejected: 'ไม่ผ่าน',
  hidden: 'ถูกซ่อน',
  removed: 'ถูกนำออก',
  blocked: 'ถูกบล็อก',
  suspended: 'ถูกระงับ',
};

export function statusLabel(status?: string | null) {
  return (status && STATUS_LABEL[status]) || status || '-';
}

export function statusTone(status?: string | null) {
  switch (status) {
    case 'lost':
    case 'active':
      return 'badge-lost';
    case 'found':
    case 'resolved':
    case 'verified':
      return 'badge-found';
    case 'pending':
      return 'badge-warn';
    case 'normal':
      return 'badge-normal';
    case 'cancelled':
    case 'closed':
    case 'removed':
      return 'badge-muted';
    default:
      return 'badge-lavender';
  }
}

export function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'เมื่อสักครู่';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  return formatDate(iso);
}

export function formatDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', {day: 'numeric', month: 'short', year: 'numeric'});
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('th-TH', {hour: '2-digit', minute: '2-digit'});
}

export function distanceLabel(km?: number | null) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  return new Date(value).toISOString();
}

export function initials(name?: string | null) {
  return (name || '?').trim().charAt(0).toUpperCase();
}
