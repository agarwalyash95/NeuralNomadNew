'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import PlannerSidebar from './PlannerSidebar';
import ChatPanel from './ChatPanel';
import WorkspacePanel from './WorkspacePanel';
import PlannerHomepage from './PlannerHomepage';
import { PanelLeftClose, PanelLeft, MessageSquare, MessageSquareOff } from 'lucide-react';

export default function PlannerShell() {
  const {
    isSidebarOpen,
    isChatOpen,
    toggleSidebar,
    toggleChat,
    activeWorkspaceId,
    showHomepage,
  } = usePlannerStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* ─── Sidebar ─────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0 border-r border-slate-200/60 dark:border-slate-800/60 overflow-hidden"
          >
            <PlannerSidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Area ───────────────────────────── */}
      <div className="flex flex-1 min-w-0 relative">

        {/* Toggle buttons — floating */}
        <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
            title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>

          {activeWorkspaceId && (
            <button
              onClick={toggleChat}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
              title={isChatOpen ? 'Close chat' : 'Open chat'}
            >
              {isChatOpen ? <MessageSquareOff size={15} /> : <MessageSquare size={15} />}
            </button>
          )}
        </div>

        {/* ─── Show Homepage or Workspace ─────── */}
        {showHomepage || !activeWorkspaceId ? (
          <div className="flex-1">
            <PlannerHomepage />
          </div>
        ) : (
          <>
            {/* ─── Chat Panel ──────────────── */}
            <AnimatePresence mode="wait">
              {isChatOpen && (
                <motion.div
                  key="chat"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 420, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="flex-shrink-0 border-r border-slate-200/40 dark:border-slate-800/40 overflow-hidden"
                >
                  <ChatPanel workspaceId={activeWorkspaceId} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Workspace Panel ──────────── */}
            <motion.div
              className="flex-1 min-w-0"
              layout
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <WorkspacePanel workspaceId={activeWorkspaceId} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
