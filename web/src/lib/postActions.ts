import {useMutation, useQueryClient} from '@tanstack/react-query';

import {answerLostCheckin, cancelFoundPost, cancelLostPost, resolveFoundPost, resolveLostPost} from '../api/community.api';
import {getApiErrorMessage} from '../api/client';
import {ConfirmOptions, confirmAction} from '../store/confirmStore';
import {toast} from '../store/toastStore';
import {FoundPost, LostPost} from '../types/api';

export type PostKind = 'lost' | 'found';
export type PostAction = 'resolve' | 'cancel' | 'still-searching';

function confirmFor(kind: PostKind, action: PostAction, name: string): ConfirmOptions | null {
  if (action === 'still-searching') return null;
  if (action === 'cancel') {
    return {
      title: 'ยกเลิกประกาศนี้?',
      message:
        kind === 'lost'
          ? `ประกาศตามหา ${name} จะไม่แสดงบนหน้าแรกและแผนที่อีก และจะไม่มีการแจ้งเตือนคนแถวนั้นแล้ว`
          : 'ประกาศนี้จะไม่แสดงบนหน้าแรกและแผนที่อีก',
      confirmLabel: 'ยกเลิกประกาศ',
      cancelLabel: 'ไม่ยกเลิก',
      tone: 'danger',
    };
  }
  return kind === 'lost'
    ? {title: `เจอ ${name} แล้ว?`, message: 'ประกาศจะขึ้นสถานะ "เจอแล้ว" และแจ้งผู้ที่ติดตามเคสนี้', confirmLabel: 'ใช่ เจอแล้ว'}
    : {title: 'น้องได้เจอเจ้าของแล้ว?', message: 'ประกาศจะถูกปิด และไม่แสดงบนหน้าแรกอีก', confirmLabel: 'ใช่ ปิดประกาศ'};
}

function successText(kind: PostKind, action: PostAction, name: string) {
  if (action === 'still-searching') return `สู้ ๆ นะ เราจะช่วยตามหา ${name} ต่อ และถามอีกครั้งใน 1 สัปดาห์`;
  if (action === 'cancel') return `ยกเลิกประกาศ ${name} แล้ว`;
  return kind === 'lost' ? `ยินดีด้วย เจอ ${name} แล้ว 🎉` : 'ปิดประกาศแล้ว ขอบคุณที่ช่วยน้อง';
}

export function usePostAction(kind: PostKind, postId: string, name: string) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: PostAction): Promise<LostPost | FoundPost> => {
      if (kind === 'found') return action === 'cancel' ? cancelFoundPost(postId) : resolveFoundPost(postId);
      if (action === 'cancel') return cancelLostPost(postId);
      if (action === 'still-searching') return answerLostCheckin(postId, false);
      return resolveLostPost(postId);
    },
    onSuccess: (_d, action) => {
      toast.ok(successText(kind, action, name));
      void qc.invalidateQueries({queryKey: ['my-posts']});
      void qc.invalidateQueries({queryKey: ['feed']});
      void qc.invalidateQueries({queryKey: [kind === 'lost' ? 'lost-post' : 'found-post', postId]});
      void qc.invalidateQueries({queryKey: ['notifications']});
      void qc.invalidateQueries({queryKey: ['pets']});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const run = async (action: PostAction) => {
    const options = confirmFor(kind, action, name);
    if (options && !(await confirmAction(options))) return;
    mutation.mutate(action);
  };

  return {run, pending: mutation.isPending};
}
