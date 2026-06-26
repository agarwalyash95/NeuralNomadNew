import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { User, AuthToken } from '@/types';

interface AuthStore {
  user: User | null;
  tokens: AuthToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isAuthModalOpen: boolean;

  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthToken | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setAuthModalOpen: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isAuthModalOpen: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setTokens: (tokens) => set({ tokens }),

      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

      setIsLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),

      reset: () => set(initialState),
    }),
    {
      name: 'neuralnomad-auth',
    }
  )
);
