import { create } from 'zustand';

/**
 * UI-only state for the planner shell.
 * Navigation (which trip, which mode) lives in the URL — see /planner/[workspaceId].
 */
interface PlannerNavStore {
  isSidebarOpen: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const usePlannerNavStore = create<PlannerNavStore>((set) => ({
  isSidebarOpen: true,

  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}));
