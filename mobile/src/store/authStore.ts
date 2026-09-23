import {create} from 'zustand';

import * as authApi from '../api/auth.api';
import {clearSession, loadSession, saveSession} from '../services/session';
import {User} from '../types/api';

export type AuthState = {
  status: 'loading' | 'guest' | 'authenticated';
  user: User | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
};

export const useAuthStore = create<AuthState>(set => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    const session = await loadSession();
    if (!session) {
      set({status: 'guest', user: null});
      return;
    }
    try {
      const user = await authApi.me();
      set({status: 'authenticated', user});
    } catch {
      await clearSession();
      set({status: 'guest', user: null});
    }
  },

  login: async (email, password) => {
    const data = await authApi.login({email, password});
    await saveSession({accessToken: data.access_token, refreshToken: data.refresh_token});
    set({status: 'authenticated', user: data.user});
  },

  register: async (displayName, email, password) => {
    const data = await authApi.register({display_name: displayName, email, password});
    await saveSession({accessToken: data.access_token, refreshToken: data.refresh_token});
    set({status: 'authenticated', user: data.user});
  },

  logout: async () => {
    const session = await loadSession();
    try {
      if (session?.refreshToken) {
        await authApi.logout(session.refreshToken);
      }
    } finally {
      await clearSession();
      set({status: 'guest', user: null});
    }
  },

  setUser: user => set({user}),
}));
