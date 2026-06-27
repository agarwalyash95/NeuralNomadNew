/**
 * Planner Zustand store — UI chrome only.
 *
 * Manages panel visibility, active workspace, active canvases,
 * and chat UI state. Server state lives in React Query.
 */

import { create } from 'zustand';
import type { CanvasType, CanvasLifecycleState } from '@/services/planner.types';

interface ActiveCanvas {
  type: CanvasType;
  state: CanvasLifecycleState;
}

interface PlannerStore {
  // ─── Active Workspace ────────────────────────────
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;

  // ─── Panel Visibility ────────────────────────────
  isSidebarOpen: boolean;
  isChatOpen: boolean;
  toggleSidebar: () => void;
  toggleChat: () => void;
  setSidebarOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;

  // ─── Canvas Management ───────────────────────────
  activeCanvases: ActiveCanvas[];
  openCanvas: (type: CanvasType, state?: CanvasLifecycleState) => void;
  closeCanvas: (type: CanvasType) => void;
  setCanvasState: (type: CanvasType, state: CanvasLifecycleState) => void;
  focusCanvas: (type: CanvasType) => void;

  // ─── Chat State ──────────────────────────────────
  isSending: boolean;
  setIsSending: (v: boolean) => void;

  // ─── Homepage State ──────────────────────────────
  showHomepage: boolean;
  setShowHomepage: (v: boolean) => void;
}

export const usePlannerStore = create<PlannerStore>()((set) => ({
  // Active workspace
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id, showHomepage: !id }),

  // Panels
  isSidebarOpen: true,
  isChatOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setChatOpen: (open) => set({ isChatOpen: open }),

  // Canvas management
  activeCanvases: [],

  openCanvas: (type, state = 'expanded') =>
    set((s) => {
      const exists = s.activeCanvases.find((c) => c.type === type);
      if (exists) {
        return {
          activeCanvases: s.activeCanvases.map((c) =>
            c.type === type ? { ...c, state } : c
          ),
        };
      }
      return { activeCanvases: [...s.activeCanvases, { type, state }] };
    }),

  closeCanvas: (type) =>
    set((s) => ({
      activeCanvases: s.activeCanvases.filter((c) => c.type !== type),
    })),

  setCanvasState: (type, state) =>
    set((s) => ({
      activeCanvases: s.activeCanvases.map((c) =>
        c.type === type ? { ...c, state } : c
      ),
    })),

  focusCanvas: (type) =>
    set((s) => ({
      activeCanvases: s.activeCanvases.map((c) =>
        c.type === type ? { ...c, state: 'focused' as const } : c
      ),
    })),

  // Chat
  isSending: false,
  setIsSending: (v) => set({ isSending: v }),

  // Homepage
  showHomepage: true,
  setShowHomepage: (v) => set({ showHomepage: v }),
}));
