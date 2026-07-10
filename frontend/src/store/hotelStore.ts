import { create } from 'zustand';

interface HotelStore {
  hotelDetailsById: Record<number, any>;
  setHotelDetail: (id: number, detail: any) => void;
  getHotelDetail: (id: number) => any | undefined;
}

export const useHotelStore = create<HotelStore>((set, get) => ({
  hotelDetailsById: {},
  setHotelDetail: (id, detail) =>
    set((state) => ({
      hotelDetailsById: {
        ...state.hotelDetailsById,
        [id]: detail,
      },
    })),
  getHotelDetail: (id) => {
    return get().hotelDetailsById[id];
  },
}));
