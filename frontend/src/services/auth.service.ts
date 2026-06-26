import { apiClient } from './api';
import { User, AuthToken, LoginCredentials, RegisterCredentials } from '@/types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthToken }> {
    const response = await apiClient.post<{ user: User; tokens: AuthToken }>(
      '/accounts/auth/login/',
      credentials
    );

    apiClient.setTokens(response.tokens.access, response.tokens.refresh);

    return response;
  },

  async register(credentials: RegisterCredentials): Promise<{ user: User; tokens: AuthToken }> {
    const response = await apiClient.post<{ user: User; tokens: AuthToken }>(
      '/accounts/auth/register/',
      credentials
    );

    apiClient.setTokens(response.tokens.access, response.tokens.refresh);

    return response;
  },

  async googleLogin(token: string): Promise<{ user: User; tokens: AuthToken }> {
    const response = await apiClient.post<{ user: User; tokens: AuthToken }>(
      '/accounts/auth/google/',
      { token }
    );

    apiClient.setTokens(response.tokens.access, response.tokens.refresh);

    return response;
  },

  async logout(refresh: string) {
    try {
      await apiClient.post('/accounts/auth/logout/', {
        refresh: refresh,
      });
    } catch (error) {
      console.warn('Server rejected logout (token may be expired). Forcing local logout.');
    } finally {
      apiClient.clearTokens();
    }
  },

  async getProfile(): Promise<User> {
    return apiClient.get('/accounts/users/profile/');
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.patch('/accounts/users/update_profile/', data);
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return apiClient.post('/accounts/users/change_password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },
};
