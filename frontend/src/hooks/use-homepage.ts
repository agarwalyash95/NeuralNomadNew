'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  homepageService,
  HomepageDestination,
  MoodCategory,
  SeasonalInsight,
  AIFeatureTile,
} from '@/services/homepage.service';

function getContinent(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          // Save country code for insights
          const cc: string = data?.address?.country_code?.toUpperCase() ?? '';
          if (cc) localStorage.setItem('nn_country_code', cc);

          // Map to continent (rough heuristic)
          const continent = countryToContinent(cc);
          localStorage.setItem('nn_continent', continent);
          resolve(continent);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}

function countryToContinent(cc: string): string {
  const asia = ['IN', 'CN', 'JP', 'KR', 'SG', 'TH', 'ID', 'MY', 'PH', 'VN', 'AE', 'SA', 'QA', 'BD', 'PK', 'LK', 'NP', 'MV'];
  const europe = ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'PT', 'SE', 'NO', 'CH', 'AT', 'BE', 'PL', 'RU'];
  const northAmerica = ['US', 'CA', 'MX'];
  const southAmerica = ['BR', 'AR', 'CL', 'CO', 'PE'];
  const africa = ['ZA', 'NG', 'EG', 'KE', 'ET', 'GH'];
  const oceania = ['AU', 'NZ', 'FJ'];

  if (asia.includes(cc)) return 'Asia';
  if (europe.includes(cc)) return 'Europe';
  if (northAmerica.includes(cc)) return 'North America';
  if (southAmerica.includes(cc)) return 'South America';
  if (africa.includes(cc)) return 'Africa';
  if (oceania.includes(cc)) return 'Oceania';
  return 'Asia'; // default
}

export function useHomepage() {
  const [moods, setMoods] = useState<MoodCategory[]>([]);
  const [destinations, setDestinations] = useState<HomepageDestination[]>([]);
  const [insight, setInsight] = useState<SeasonalInsight | null>(null);
  const [features, setFeatures] = useState<AIFeatureTile[]>([]);
  const [activeMood, setActiveMood] = useState('all');
  const [loading, setLoading] = useState(true);
  const [continent, setContinent] = useState<string | null>(null);

  // Load static data on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      const [moodsData, featuresData] = await Promise.all([
        homepageService.getMoods(),
        homepageService.getFeatures(),
      ]);
      setMoods(moodsData);
      setFeatures(featuresData);

      // Geolocation + insights
      const cached_continent = localStorage.getItem('nn_continent');
      const cached_cc = localStorage.getItem('nn_country_code');

      const resolvedContinent = cached_continent ?? (await getContinent()) ?? 'Asia';
      const resolvedCC = cached_cc ?? 'IN';
      setContinent(resolvedContinent);

      const month = new Date().getMonth() + 1;
      const [dests, insightData] = await Promise.all([
        homepageService.getDestinations({ continent: resolvedContinent }),
        homepageService.getInsight(resolvedCC, month),
      ]);
      setDestinations(dests);
      setInsight(insightData);
      setLoading(false);
    }
    init();
  }, []);

  const filterByMood = useCallback(
    async (mood: string) => {
      setActiveMood(mood);
      setLoading(true);
      const dests = await homepageService.getDestinations({
        mood: mood === 'all' ? undefined : mood,
        continent: continent ?? undefined,
      });
      setDestinations(dests);
      setLoading(false);
    },
    [continent]
  );

  const recordView = useCallback((id: string) => {
    homepageService.recordView(id);
  }, []);

  return {
    moods,
    destinations,
    insight,
    features,
    activeMood,
    loading,
    filterByMood,
    recordView,
  };
}
