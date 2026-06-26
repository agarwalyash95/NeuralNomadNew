export interface Notification {
  id: string;

  notification_type: string;

  title: string;

  message: string;

  is_read: boolean;

  action_url?: string;

  created_at: string;
}
