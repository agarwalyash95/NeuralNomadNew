import { apiClient } from '@/services/api';

export interface HomepageDestination {
  id: string;
  name: string;
  country: string;
  continent: string;
  image_url: string;
  price_inr: number;
  duration_days: number;
  mood_tags: string[];
  view_count: number;
  popularity_score: number;
}

export interface MoodCategory {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  order: number;
}

export interface SeasonalInsight {
  id: string;
  country_code: string;
  continent: string;
  month: number;
  tip_text: string;
}

export interface AIFeatureTile {
  id: string;
  title: string;
  description: string;
  emoji: string;
  cta_label: string;
  cta_url: string;
  order: number;
}

export const homepageService = {
  async getDestinations(params?: { mood?: string; continent?: string }): Promise<HomepageDestination[]> {
    const query = new URLSearchParams();
    if (params?.mood && params.mood !== 'all') query.set('mood', params.mood);
    if (params?.continent) query.set('continent', params.continent);
    const qs = query.toString();
    const data: any = await apiClient.get(`/homepage/destinations/${qs ? `?${qs}` : ''}`);
    // handle paginated or plain array
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  async getMoods(): Promise<MoodCategory[]> {
    const data: any = await apiClient.get('/homepage/moods/');
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  async getInsight(countryCode: string, month: number): Promise<SeasonalInsight | null> {
    try {
      const data: any = await apiClient.get(
        `/homepage/insights/?country_code=${countryCode}&month=${month}`
      );
      const list = Array.isArray(data) ? data : (data?.results ?? []);
      return list[0] ?? null;
    } catch {
      return null;
    }
  },

  async getFeatures(): Promise<AIFeatureTile[]> {
    const data: any = await apiClient.get('/homepage/features/');
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  async recordView(destinationId: string): Promise<void> {
    try {
      await apiClient.post(`/homepage/destinations/${destinationId}/view/`, {});
    } catch {
      // silently fail — not critical
    }
  },
};
