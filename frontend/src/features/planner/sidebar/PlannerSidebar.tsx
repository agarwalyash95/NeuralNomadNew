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
  const sidebarWidth = 256;
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
        animate={{ width: isOpen ? sidebarWidth : 60 }}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col overflow-hidden',
          'bg-paper-0',
          // Subtle right separator — whitespace over borders
          'border-r border-line/50'
        )}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex h-full w-[256px] flex-col overflow-hidden"
            >
              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="px-5 pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    {/* Eyebrow — travel notebook tone */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={10} className="text-amber-500/70" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-400">
                        Neural Nomad
                      </span>
                    </div>
                    <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">
                      Your Journeys
                    </h2>
                  </div>

                  <button
                    onClick={onToggle}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-paper-1 hover:text-ink-700 active:scale-95"
                    style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
                    title="Close sidebar"
                  >
                    <PanelLeftClose size={15} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* ── New Plan CTA ─────────────────────────────────────────── */}
              <div className="px-4 pb-5">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNewPlan}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5',
                    'bg-ink-900 text-paper-1 text-[12px] font-semibold',
                    'shadow-surface hover:shadow-hover',
                    'transition-all'
                  )}
                  style={{ transition: `all var(--motion-card) var(--ease-out)` }}
                >
                  <Plus size={13} strokeWidth={2.5} className="text-amber-400" />
                  <span>New Plan</span>
                </motion.button>
              </div>

              {/* ── Divider ──────────────────────────────────────────────── */}
              <div className="mx-4 h-px bg-line/60 mb-4" />

              {/* ── Nav sections ─────────────────────────────────────────── */}
              <nav className="flex-1 overflow-y-auto px-3 pb-6 custom-scrollbar space-y-1">
                <WorkspaceSection
                  title="Recent"
                  workspaces={recent}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={handleOpenWorkspace}
                  onDelete={handleDelete}
                  emptyMessage="Nothing in progress — start a new trip"
                />
                <WorkspaceSection
                  title="Saved"
                  workspaces={saved}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={handleOpenWorkspace}
                  onDelete={handleDelete}
                  emptyMessage="Save a plan to keep it here"
                />
                <WorkspaceSection
                  title="Booked"
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex h-full w-[60px] flex-col items-center overflow-hidden py-5 gap-4"
            >
              {/* Toggle */}
              <button
                onClick={onToggle}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-paper-1 hover:text-ink-700 active:scale-95"
                style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
                title="Expand sidebar"
              >
                <PanelLeftOpen size={15} strokeWidth={1.5} />
              </button>

              {/* Compact CTA */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleNewPlan}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-900 text-paper-1 shadow-surface"
                title="New Plan"
              >
                <Plus size={14} strokeWidth={2.5} className="text-amber-400" />
              </motion.button>

              {/* Trip icons — compact list */}
              <div className="flex flex-1 w-full flex-col items-center gap-2 overflow-y-auto no-scrollbar px-2">
                {workspaces.map((workspace) => {
                  const hasPlan = hasGeneratedPlan(workspace);
                  const isActive = workspace.id === activeWorkspaceId;
                  return (
                    <button
                      key={workspace.id}
                      onClick={() => handleOpenWorkspace(workspace)}
                      className={cn(
                        'relative flex h-8 w-8 items-center justify-center rounded-xl shrink-0 cursor-pointer',
                        'transition-all',
                        isActive
                          ? 'bg-white shadow-surface text-ink-700 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-r-full before:bg-[rgb(var(--color-journey))]'
                          : 'text-ink-400 hover:bg-paper-1 hover:text-ink-700'
                      )}
                      style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
                      title={workspace.title}
                    >
                      {hasPlan
                        ? <Map size={13} strokeWidth={1.8} />
                        : <MessageSquare size={13} strokeWidth={1.8} />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
