import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '@trello-clone/shared';
import i18n from '../i18n.js';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

function applyLanguage(user: User) {
  if (user.language && user.language !== i18n.language) {
    i18n.changeLanguage(user.language);
  }
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: true,
      setAuth: (user, accessToken) => {
        applyLanguage(user);
        set({ user, accessToken, isLoading: false });
      },
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => {
        applyLanguage(user);
        set({ user });
      },
      logout: () => set({ user: null, accessToken: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'AuthStore' },
  ),
);
