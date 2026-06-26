'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/ui-custom/app-shell';
import GlassCard from '@/components/ui-custom/glass-card';
import { Plane, Tag, ShieldAlert, Hotel, Info, CheckCircle2, CheckSquare } from 'lucide-react';
import { notificationService } from '@/services/notification.service';
import { Notification } from '@/types/notification';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const router = useRouter();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = filter === 'unread' 
        ? await notificationService.getUnreadNotifications()
        : await notificationService.getNotifications();
      
      const data = Array.isArray(res) ? res : (res as any)?.results || [];
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await notificationService.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (err) {
        console.error(err);
      }
    }
    
    if (notif.action_url) {
      router.push(notif.action_url);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
      alert('Failed to mark all as read.');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'trip_reminder': return <Plane size={24} className="text-blue-500" />;
      case 'price_drop': return <Tag size={24} className="text-emerald-500" />;
      case 'visa_alert': return <ShieldAlert size={24} className="text-amber-500" />;
      case 'booking_update': return <Hotel size={24} className="text-indigo-500" />;
      case 'offer': return <Tag size={24} className="text-pink-500" />;
      default: return <Info size={24} className="text-slate-500" />;
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Notifications</h1>
            <p className="text-slate-500 mt-1">Stay updated on your upcoming trips and alerts.</p>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Unread
              </button>
            </div>
            
            <button 
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all"
            >
              <CheckSquare size={16} />
              Mark all as read
            </button>
          </div>
        </div>

        <GlassCard className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">You&apos;re all caught up!</h3>
              <p className="text-slate-500 mt-1">Check back later for more updates.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex gap-4 p-6 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/20' : ''}`}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shadow-sm">
                    {getIcon(notif.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                      <h4 className={`text-base ${!notif.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                        {notif.title}
                      </h4>
                      <p className="text-xs font-medium text-slate-400 whitespace-nowrap mt-1 sm:mt-0">
                        {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className={`mt-1 text-sm ${!notif.is_read ? 'text-slate-700' : 'text-slate-500'}`}>
                      {notif.message}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}
