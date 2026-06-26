'use client';

import { useEffect } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth.store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { loadProfile } = useAuth();

  const setLoading = useAuthStore((state) => state.setIsLoading);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('accessToken');

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
