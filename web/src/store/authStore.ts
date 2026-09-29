import {create} from 'zustand';

import * as authApi from '../api/auth.api';
import {setSessionExpiredHandler} from '../api/client';
import {clearSession, loadSession, saveSession} from '../lib/session';
import {detachPushSubscription} from '../lib/push';
import {AuthPayload, User} from '../types/api';

export type AuthState = {
  status: 'loading' | 'guest' | 'authenticated';
  user: User | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signIn: (data: AuthPayload) => Promise<void>;
  setUser: (user: User) => void;
};

export const useAuthStore = create<AuthState>(set => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    setSessionExpiredHandler(() => set({status: 'guest', user: null}));
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

  signIn: async data => {
    await saveSession({accessToken: data.access_token, refreshToken: data.refresh_token});
    set({status: 'authenticated', user: data.user});
  },

  logout: async () => {
    const session = await loadSession();
    await detachPushSubscription().catch(() => undefined);
    try {
      if (session?.refreshToken) await authApi.logout(session.refreshToken);
    } catch {
      // token may already be revoked
    } finally {
      await clearSession();
      set({status: 'guest', user: null});
    }
  },

  setUser: user => set({user}),
}));
