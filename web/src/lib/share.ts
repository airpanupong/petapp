import {toast} from '../store/toastStore';

export async function sharePage(title: string, url = window.location.href) {
  if (navigator.share) {
    try {
      await navigator.share({title, url});
      return;
    } catch {
      // user cancelled the share sheet
    }
  }
  await navigator.clipboard.writeText(url);
  toast.ok('คัดลอกลิงก์แล้ว แชร์ต่อได้เลย');
}
