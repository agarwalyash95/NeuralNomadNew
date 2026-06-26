import { create } from 'zustand';

import { TravelSearchResult } from '@/types/search';

interface BookingSelectionStore {
  selected: TravelSearchResult | null;

  setSelected: (result: TravelSearchResult) => void;

  clear: () => void;
}

export const useBookingSelectionStore = create<BookingSelectionStore>((set) => ({
  selected: null,

  setSelected: (selected) =>
    set({
      selected,
    }),

  clear: () =>
    set({
      selected: null,
    }),
}));
