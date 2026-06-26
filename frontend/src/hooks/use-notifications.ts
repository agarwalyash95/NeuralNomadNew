'use client';

import { useEffect, useState } from 'react';
import { notificationService } from '@/services/notification.service';

export function useNotifications() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const data = (await notificationService.unreadCount()) as { unread_count: number };
        setCount(data?.unread_count || 0);
      } catch (error) {
        console.error(error);
      }
    }

    load();
  }, []);

  return { count };
}
