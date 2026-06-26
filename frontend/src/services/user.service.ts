import { apiClient } from './api';
import { User } from '@/types';

export const userService = {
  async updateProfile(formData: FormData): Promise<User> {
    const response = await apiClient.patch<User>('/accounts/users/update_profile/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },
};
