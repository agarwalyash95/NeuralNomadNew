import { create } from 'zustand';

interface RestaurantStore {
  restaurantDetailsById: Record<number, any>;
  setRestaurantDetail: (id: number, detail: any) => void;
  getRestaurantDetail: (id: number) => any | undefined;
}

export const useRestaurantStore = create<RestaurantStore>((set, get) => ({
  restaurantDetailsById: {},
  setRestaurantDetail: (id, detail) =>
    set((state) => ({
      restaurantDetailsById: {
        ...state.restaurantDetailsById,
        [id]: detail,
      },
    })),
  getRestaurantDetail: (id) => {
    return get().restaurantDetailsById[id];
  },
}));
