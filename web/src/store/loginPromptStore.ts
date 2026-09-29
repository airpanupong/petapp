import {create} from 'zustand';

import {useAuthStore} from './authStore';

type LoginPromptState = {
  reason: string | null;
  show: (reason?: string) => void;
  hide: () => void;
};

export const useLoginPrompt = create<LoginPromptState>(set => ({
  reason: null,
  show: reason => set({reason: reason ?? 'เข้าสู่ระบบเพื่อช่วยน้อง ๆ ต่อได้เลย'}),
  hide: () => set({reason: null}),
}));

/** Runs `action` when signed in; otherwise asks the guest to log in first. */
export function useRequireLogin() {
  const authed = useAuthStore(s => s.status === 'authenticated');
  const show = useLoginPrompt(s => s.show);
  return (action: () => void, reason?: string) => {
    if (authed) action();
    else show(reason);
  };
}
