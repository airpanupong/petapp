import {create} from 'zustand';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
};

type ConfirmState = {
  request: (ConfirmOptions & {resolve: (ok: boolean) => void}) | null;
  settle: (ok: boolean) => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  settle: ok => {
    get().request?.resolve(ok);
    set({request: null});
  },
}));

/** Ask the user to confirm a destructive or irreversible action. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  useConfirmStore.getState().request?.resolve(false);
  return new Promise(resolve => useConfirmStore.setState({request: {...options, resolve}}));
}
