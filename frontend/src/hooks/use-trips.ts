'use client';

import { useEffect, useState } from 'react';
import { tripService } from '@/services/trip.service';

export function useTrips() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadTrips() {
    try {
      const data = await tripService.getTrips();
      setTrips(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrips();
  }, []);

  return {
    trips,
    loading,
    reload: loadTrips,
  };
}
