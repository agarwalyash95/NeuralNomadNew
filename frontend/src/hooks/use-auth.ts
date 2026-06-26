'use client';

import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';

export function useAuth() {
  const { user, isAuthenticated, setUser, setIsAuthenticated, reset } = useAuthStore();

  async function loadProfile() {
    try {
      const profile = await authService.getProfile();

      setUser(profile);
      setIsAuthenticated(true);

      return profile;
    } catch {
      reset();
      return null;
    }
  }

  async function logout() {
    try {
      const refresh = localStorage.getItem('refreshToken');

      if (refresh) {
        await authService.logout(refresh);
      }
    } catch (error) {
      console.error(error);
    } finally {
      reset();

      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  return {
    user,
    isAuthenticated,
    loadProfile,
    logout,
  };
}
