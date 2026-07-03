'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Map, PanelLeftClose, PanelLeftOpen, MessageSquare, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { plannerService } from '@/services/planner.service';
import type { PlannerWorkspace } from '@/services/planner.types';

interface PlannerSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function PlannerSidebar({ isOpen, onToggle }: PlannerSidebarProps) {
  const sidebarWidth = 260;
  const [workspaces, setWorkspaces] = useState<PlannerWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // Synchronize active workspace ID with app-wide state
  useEffect(() => {
    const handleOpenWorkspace = (e: Event) => {
      const { workspaceId: wid } = (e as CustomEvent).detail;
      if (wid) {
        setActiveWorkspaceId(wid);
      }
    };

    const handleNewPlan = () => {
      setActiveWorkspaceId(null);
    };

    window.addEventListener('planner:open-workspace', handleOpenWorkspace);
    window.addEventListener('planner:new-plan', handleNewPlan);

    return () => {
      window.removeEventListener('planner:open-workspace', handleOpenWorkspace);
      window.removeEventListener('planner:new-plan', handleNewPlan);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadWorkspaces = async () => {
      try {
        const data = await plannerService.listWorkspaces();
        if (isMounted) setWorkspaces(data);
      } catch {
        if (isMounted) setWorkspaces([]);
      }
    };

    loadWorkspaces();
    window.addEventListener('planner:refresh-workspaces', loadWorkspaces);
    return () => {
      isMounted = false;
      window.removeEventListener('planner:refresh-workspaces', loadWorkspaces);
    };
  }, []);

  const handleNewPlan = () => {
    window.dispatchEvent(new CustomEvent('planner:new-plan'));
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await plannerService.deleteWorkspace(id);
      setWorkspaces((prev) => prev.filter(w => w.id !== id));
      
      // If we deleted the currently active workspace, reset state
      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(null);
        window.dispatchEvent(new CustomEvent('planner:new-plan'));
      }
    } catch (error) {
      console.error('Failed to delete workspace', error);
    }
  };

  const openWorkspace = (workspace: PlannerWorkspace, hasPlan: boolean) => {
    setActiveWorkspaceId(workspace.id);
    window.dispatchEvent(new CustomEvent('planner:open-workspace', {
      detail: { workspaceId: workspace.id, hasPlan }
    }));
  };

  const recentWorkspaces = workspaces.filter(w => w.status === 'draft' || w.status === 'active');
  const savedWorkspaces = workspaces.filter(w => w.status === 'saved');
  const bookedWorkspaces = workspaces.filter(w => w.status === 'booked');

  return (
    <>
      {/* Floating Trigger shown ONLY when Sidebar is closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-5 top-5 z-50"
          >
            <button
              onClick={onToggle}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-500 shadow-md backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-slate-300 hover:bg-white hover:text-slate-950 hover:shadow-lg active:scale-95"
              title="Open sidebar"
            >
              <PanelLeftOpen size={16} strokeWidth={1.8} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ width: isOpen ? sidebarWidth : 0 }}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200',
          'bg-[#f8fafc]', // Sleek mist-slate-50 background that looks crisp and premium
          'shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.015),_inset_1px_0_0_0_rgba(255,255,255,0.8)]',
          !isOpen && 'border-none'
        )}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex h-full w-[260px] flex-col overflow-hidden p-5"
            >
              {/* Header Container with Title & Collapse Button */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Sparkles size={11} className="text-blue-500 animate-pulse" />
                    <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Neural Nomad
                    </p>
                  </div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-800">
                    Trips in progress
                  </h2>
                </div>
                
                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-500 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950 hover:shadow-md active:scale-95"
                  title="Close sidebar"
                >
                  <PanelLeftClose size={15} strokeWidth={1.8} />
                </button>
              </div>

              {/* Primary Call-to-Action */}
              <div className="mb-6">
                <button
                  onClick={handleNewPlan}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-[0_4px_12px_rgba(15,23,42,0.15)] active:scale-[0.98]"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>New Plan</span>
                </button>
              </div>

              {/* Scrollable Nav Sections */}
              <nav className="flex-1 space-y-6 overflow-y-auto pr-1 custom-scrollbar">
                <WorkspaceSection
                  title="Recent"
                  workspaces={recentWorkspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={openWorkspace}
                  onDelete={handleDelete}
                  emptyMessage="No recent plans yet"
                />
                <WorkspaceSection
                  title="Saved Plans"
                  workspaces={savedWorkspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={openWorkspace}
                  onDelete={handleDelete}
                />
                <WorkspaceSection
                  title="Booked Trips"
                  workspaces={bookedWorkspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  onOpen={openWorkspace}
                  onDelete={handleDelete}
                />
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

interface WorkspaceSectionProps {
  title: string;
  workspaces: PlannerWorkspace[];
  activeWorkspaceId: string | null;
  onOpen: (w: PlannerWorkspace, hasPlan: boolean) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  emptyMessage?: string;
}

function WorkspaceSection({
  title,
  workspaces,
  activeWorkspaceId,
  onOpen,
  onDelete,
  emptyMessage
}: WorkspaceSectionProps) {
  if (workspaces.length === 0 && !emptyMessage) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2 mb-1.5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
          {title}
        </h3>
        {workspaces.length > 0 && (
          <span className="text-[9px] font-bold bg-slate-200/50 text-slate-500 px-1.5 py-0.5 rounded-full scale-90">
            {workspaces.length}
          </span>
        )}
      </div>

      <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-0.5 space-y-1">
        {workspaces.length > 0 ? (
          workspaces.map((workspace) => {
            const hasPlan = workspace.status !== 'draft';
            const dateStr = workspace.last_activity_at
              ? new Date(workspace.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '';
            return (
              <SidebarItem
                key={workspace.id}
                icon={hasPlan ? <Map size={14} strokeWidth={1.8} /> : <MessageSquare size={14} strokeWidth={1.8} />}
                label={workspace.title}
                meta={`${hasPlan ? 'Plan ready' : 'Draft'}${dateStr ? ' · ' + dateStr : ''}`}
                isActive={workspace.id === activeWorkspaceId}
                onClick={() => onOpen(workspace, hasPlan)}
                onDelete={(e) => onDelete(e, workspace.id)}
              />
            );
          })
        ) : (
          <p className="px-2 py-2 text-xs text-slate-400/80 italic font-medium">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  meta: string;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

function SidebarItem({
  icon,
  label,
  meta,
  isActive = false,
  onClick,
  onDelete,
}: SidebarItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left cursor-pointer transition-all duration-200",
        isActive
          ? "bg-white border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.02)] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:rounded-r-full before:bg-blue-600"
          : "hover:bg-slate-200/50 active:bg-slate-200/85 border border-transparent"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 shadow-sm shrink-0",
          isActive
            ? "bg-blue-600 text-white"
            : "bg-white border border-slate-200 text-slate-500 group-hover:text-slate-800 group-hover:bg-white"
        )}
      >
        {icon}
      </div>
      
      <div className="min-w-0 flex-1 pr-6">
        <p
          className={cn(
            "truncate text-xs font-semibold leading-none",
            isActive ? "text-slate-900 font-bold" : "text-slate-600 font-medium group-hover:text-slate-900"
          )}
        >
          {label}
        </p>
        <p className="mt-1 truncate text-[10px] text-slate-400 font-medium">
          {meta}
        </p>
      </div>

      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 opacity-0 transition-all duration-150 hover:bg-red-50 hover:text-red-600 rounded-lg group-hover:opacity-100 focus:opacity-100"
          title="Delete Plan"
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
