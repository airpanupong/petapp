import {create} from 'zustand';

type Toast = {id: number; message: string; kind: 'ok' | 'error'};

type ToastState = {
  toasts: Toast[];
  push: (message: string, kind?: Toast['kind']) => void;
};

let seq = 0;

export const useToast = create<ToastState>(set => ({
  toasts: [],
  push: (message, kind = 'ok') => {
    const id = ++seq;
    set(s => ({toasts: [...s.toasts, {id, message, kind}]}));
    setTimeout(() => set(s => ({toasts: s.toasts.filter(t => t.id !== id)})), 3200);
  },
}));

export const toast = {
  ok: (message: string) => useToast.getState().push(message, 'ok'),
  error: (message: string) => useToast.getState().push(message, 'error'),
};
