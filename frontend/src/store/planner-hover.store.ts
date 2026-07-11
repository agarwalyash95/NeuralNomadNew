import { create } from 'zustand';
import type { ItineraryItem } from '@/features/planner/workspace/plan-canvas/types';

/**
 * Hovered timeline item, isolated from PlannerWorkspace's own render tree.
 * Nodes write via `setHoveredItem` (a stable action reference — never
 * recreated, so it never breaks memoization on the node components).
 * Only consumers that call the `useHoverStore(selector)` hook (PlannerMap,
 * AIInsightsPanel) re-render on a hover change — the timeline itself, and
 * PlannerWorkspace, never do, since neither subscribes to the value.
 */
interface PlannerHoverStore {
  hoveredItem: ItineraryItem | null;
  setHoveredItem: (item: ItineraryItem | null) => void;
}

export const usePlannerHoverStore = create<PlannerHoverStore>((set) => ({
  hoveredItem: null,
  setHoveredItem: (hoveredItem) => set({ hoveredItem }),
}));
