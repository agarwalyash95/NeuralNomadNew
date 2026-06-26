'use client';

import { useState } from 'react';

import { BookingSearchParams } from '@/types/booking';

import { TravelSearchResult } from '@/types/search';

import { searchService } from '@/services/search.service';

export function useTravelSearch() {
  const [results, setResults] = useState<TravelSearchResult[]>([]);

  const [loading, setLoading] = useState(false);

  async function search(params: BookingSearchParams) {
    try {
      setLoading(true);

      setResults([]);

      const data = await searchService.search(params);

      setResults(data);
    } finally {
      setLoading(false);
    }
  }

  return {
    results,
    loading,
    search,
  };
}
