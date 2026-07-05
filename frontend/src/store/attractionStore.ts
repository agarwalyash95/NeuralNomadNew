import { create } from 'zustand';

interface AttractionStore {
  attractionDetailsById: Record<number, any>;
  setAttractionDetail: (id: number, detail: any) => void;
  getAttractionDetail: (id: number) => any | undefined;
}

export const useAttractionStore = create<AttractionStore>((set, get) => ({
  attractionDetailsById: {},
  setAttractionDetail: (id, detail) =>
    set((state) => ({
      attractionDetailsById: {
        ...state.attractionDetailsById,
        [id]: detail,
      },
    })),
  getAttractionDetail: (id) => {
    return get().attractionDetailsById[id];
  },
}));
