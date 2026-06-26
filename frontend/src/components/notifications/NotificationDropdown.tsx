import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plane, Tag, ShieldAlert, Hotel, Info, CheckCircle2 } from 'lucide-react';
import { notificationService } from '@/services/notification.service';
import { Notification } from '@/types/notification';

export default function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await notificationService.getNotifications();
        const data = Array.isArray(res) ? res : (res as any)?.results || [];
        setNotifications(data.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await notificationService.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (err) {
        console.error(err);
      }
    }
    
    onClose();
    if (notif.action_url) {
      router.push(notif.action_url);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'trip_reminder': return <Plane size={16} className="text-blue-500" />;
      case 'price_drop': return <Tag size={16} className="text-emerald-500" />;
      case 'visa_alert': return <ShieldAlert size={16} className="text-amber-500" />;
      case 'booking_update': return <Hotel size={16} className="text-indigo-500" />;
      case 'offer': return <Tag size={16} className="text-pink-500" />;
      default: return <Info size={16} className="text-slate-500" />;
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-100 z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-semibold text-slate-900">Notifications</h3>
      </div>
      
      <div className="max-h-[350px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center">
            <CheckCircle2 size={32} className="text-slate-300 mb-2" />
            You&apos;re all caught up!
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map(notif => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex gap-3 p-4 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
              >
                <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  {getIcon(notif.notification_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className={`text-sm ${!notif.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {notif.title}
                    </p>
                    {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">
                    {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="border-t border-slate-100 p-2 bg-slate-50/50">
        <Link 
          href="/notifications"
          onClick={onClose}
          className="block w-full text-center py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
