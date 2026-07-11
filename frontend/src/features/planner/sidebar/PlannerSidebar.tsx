'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Map, PanelLeftClose, PanelLeftOpen, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlannerWorkspace } from '@/services/planner.types';
import { useWorkspaces, useDeleteWorkspace } from '@/features/planner/hooks/usePlannerQueries';
import { groupWorkspaces, hasGeneratedPlan } from './lib/groupWorkspaces';
import { WorkspaceSection } from './components/WorkspaceSection';

interface PlannerSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function PlannerSidebar({ isOpen, onToggle }: PlannerSidebarProps) {
  const sidebarWidth = 260;
  const router = useRouter();
  const params = useParams<{ workspaceId?: string }>();
  const activeWorkspaceId = params?.workspaceId ?? null;

  const { data: workspaces = [] } = useWorkspaces();
  const deleteWorkspace = useDeleteWorkspace();

  const handleNewPlan = () => {
    router.push('/planner');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteWorkspace.mutateAsync(id);
      // If we deleted the currently active workspace, go back to a fresh chat
      if (activeWorkspaceId === id) {
        router.push('/planner');
      }
    } catch (error) {
      console.error('Failed to delete workspace', error);
    }
  };

  const handleOpenWorkspace = (workspace: PlannerWorkspace) => {
    router.push(`/planner/${workspace.id}`);
  };

  const { recent, saved, booked } = groupWorkspaces(workspaces);

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: isOpen ? sidebarWidth : 68 }}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-line/70',
          'bg-gradient-to-b from-[#fbf9f4]/95 via-paper-0/90 to-[#faf8f3]/95 backdrop-blur-md',
          'shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.4)]'
        )}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex h-full w-[260px] flex-col overflow-hidden p-5"
            >
              {/* Header Container with Title & Collapse Button */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Sparkles size={11} className="text-amber-500 fill-amber-500/10 motion-safe:animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-400">
                      Neural Nomad
                    </p>
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                    Your Journeys
                  </h2>
                </div>

                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line/60 bg-white/60 text-ink-500 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-line-strong hover:bg-white hover:text-slate-900 hover:shadow-md active:scale-95"
                  title="Close sidebar"
                >
                  <PanelLeftClose size={14} strokeWidth={1.5} />
                </button>
              </div>

              {/* Primary Call-to-Action */}
              <div className="mb-6">
                <motion.button
                  whileHover={{ scale: 1.02, y: -0.5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNewPlan}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e1e1a] via-[#121210] to-[#1e1e1a] border border-white/5 px-4 py-2.5 text-xs font-semibold text-paper-1 shadow-[0_4px_12px_rgba(30,30,26,0.15)] transition-all duration-300 hover:bg-[#282824] hover:shadow-[0_8px_20px_-4px_rgba(30,30,26,0.35)]"
                >
                  <Plus size={13} strokeWidth={2.5} className="text-amber-400" />
                  <span>New Plan</span>
                </motion.button>
              </div>

              {/* Scrollable Nav Sections — Recent → Saved → Booked, one home per trip */}
              <nav className="flex-1 space-y-6 overflow-y-auto pr-1 custom-scrollbar">
                <WorkspaceSection
                  title="Recent plans"
                  workspaces={recent}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={handleOpenWorkspace}
                  onDelete={handleDelete}
                  emptyMessage="Nothing in progress — start a new trip"
                />
                <WorkspaceSection
                  title="Saved plans"
                  workspaces={saved}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={handleOpenWorkspace}
                  onDelete={handleDelete}
                  emptyMessage="Save a plan to keep it here"
                />
                <WorkspaceSection
                  title="Booked trips"
                  workspaces={booked}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={handleOpenWorkspace}
                  onDelete={handleDelete}
                />
              </nav>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="flex h-full w-[68px] flex-col items-center overflow-hidden py-5 px-2"
            >
              {/* Header Toggle */}
              <div className="mb-6 flex justify-center">
                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line/60 bg-white/60 text-ink-500 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-line-strong hover:bg-white hover:text-slate-900 hover:shadow-md active:scale-95"
                  title="Expand sidebar"
                >
                  <PanelLeftOpen size={14} strokeWidth={1.5} />
                </button>
              </div>

              {/* Compact CTA */}
              <div className="mb-6 flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleNewPlan}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-[#1e1e1a] to-[#121210] border border-white/5 text-paper-1 shadow-sm transition-all duration-300 hover:shadow-md"
                  title="New Plan"
                >
                  <Plus size={15} strokeWidth={2.5} className="text-amber-400" />
                </motion.button>
              </div>

              {/* Compact Icon List */}
              <div className="flex-1 w-full space-y-3 overflow-y-auto pr-0.5 custom-scrollbar flex flex-col items-center">
                {workspaces.length > 0 ? (
                  workspaces.map((workspace) => {
                    const hasPlan = hasGeneratedPlan(workspace);
                    const isActive = workspace.id === activeWorkspaceId;

                    return (
                      <button
                        key={workspace.id}
                        onClick={() => handleOpenWorkspace(workspace)}
                        className={cn(
                          "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 border shrink-0 cursor-pointer",
                          isActive
                            ? "bg-white border-[#d3cbbe] text-[#bfa780] shadow-[0_4px_12px_rgba(139,124,103,0.12)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-md before:bg-[#bfa780]"
                            : "bg-white/45 border-[#e8e3d5]/30 text-ink-500 hover:bg-white hover:border-line-strong"
                        )}
                        title={workspace.title}
                      >
                        {hasPlan ? <Map size={14} strokeWidth={1.8} /> : <MessageSquare size={14} strokeWidth={1.8} />}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-[9px] text-[#968f83]/40 italic">Empty</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
