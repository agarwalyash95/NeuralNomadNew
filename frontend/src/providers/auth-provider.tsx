'use client';

import { useEffect } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth.store';
import { getStoredAccessToken } from '@/lib/auth-token';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { loadProfile } = useAuth();

  const setLoading = useAuthStore((state) => state.setIsLoading);

  useEffect(() => {
    async function init() {
      // SEC-01 R12: was localStorage.getItem('accessToken') only, which the
      // real login flow (auth-modal.tsx -> useAuthStore.setTokens) never
      // writes to — see lib/auth-token.ts for the full explanation.
      const token = getStoredAccessToken();

      if (!token) return;

      setLoading(true);

      try {
        await loadProfile();
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  return <>{children}</>;
}
