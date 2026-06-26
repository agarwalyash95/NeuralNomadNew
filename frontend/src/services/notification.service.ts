import { apiClient } from './api';

export const notificationService = {
  async getNotifications() {
    return apiClient.get('/notifications/notifications/');
  },

  async getUnreadNotifications() {
    return apiClient.get('/notifications/notifications/unread/');
  },

  async unreadCount() {
    return apiClient.get('/notifications/notifications/unread_count/');
  },

  async markAllAsRead() {
    return apiClient.post('/notifications/notifications/mark_all_as_read/');
  },

  async markAsRead(id: string | number) {
    return apiClient.post(`/notifications/notifications/${id}/mark_as_read/`);
  },
};
