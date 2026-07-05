import { create } from 'zustand';

interface ActivityStore {
  activityDetailsById: Record<number, any>;
  setActivityDetail: (id: number, detail: any) => void;
  getActivityDetail: (id: number) => any | undefined;
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activityDetailsById: {},
  setActivityDetail: (id, detail) =>
    set((state) => ({
      activityDetailsById: {
        ...state.activityDetailsById,
        [id]: detail,
      },
    })),
  getActivityDetail: (id) => {
    return get().activityDetailsById[id];
  },
}));
