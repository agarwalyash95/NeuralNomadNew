'use client';

import { useEffect, useState } from 'react';

import { walletService } from '@/services/wallet.service';
import { tripService } from '@/services/trip.service';
import { visaService } from '@/services/visa.service';
import { notificationService } from '@/services/notification.service';

export function useDashboard() {
  const [wallet, setWallet] = useState<any>(null);
  const [trip, setTrip] = useState<any>(null);
  const [visa, setVisa] = useState<any>(null);
  const [notifications, setNotifications] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [walletData, upcomingTrips, allTrips, visaData, unread] = await Promise.all([
          walletService.getPaymentMethods(),
          tripService.getUpcomingTrips(),
          tripService.getTrips(),
          visaService.getVisaData(),
          notificationService.unreadCount(),
        ]);

        setWallet(Array.isArray(walletData) ? walletData : (walletData as any)?.results || []);
        setTrip(upcomingTrips?.[0] || null);

        setTotalTrips(
          Array.isArray(allTrips)
            ? allTrips.length
            : Array.isArray((allTrips as any)?.results)
              ? (allTrips as any).results.length
              : 0
        );

        setVisa(visaData?.[0] || null);

        setNotifications((unread as { unread_count: number })?.unread_count || 0);
      } catch (error) {
        console.error('Dashboard load failed:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return {
    wallet,
    trip,
    visa,
    notifications,
    totalTrips,
    loading,
  };
}
