'use client';

import { Bell } from 'lucide-react';

import { useNotifications } from '@/hooks/use-notifications';

export default function NotificationBell() {
  const { count } = useNotifications();

  return (
    <button className="relative rounded-xl p-3 hover:bg-slate-100">
      <Bell size={18} />

      {count > 0 && (
        <span
          className="
            absolute
            -right-1
            -top-1
            flex
            h-5
            w-5
            items-center
            justify-center
            rounded-full
            bg-red-500
            text-[10px]
            text-white
          "
        >
          {count}
        </span>
      )}
    </button>
  );
}
