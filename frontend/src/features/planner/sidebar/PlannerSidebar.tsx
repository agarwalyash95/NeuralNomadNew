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
            className="absolute left-5 top-5 z-[60]"
          >
            <button
              onClick={onToggle}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2ddd2] bg-white/90 text-[#8c857b] shadow-[0_4px_12px_rgba(139,124,103,0.15)] backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-[#dcd7cb] hover:bg-white hover:text-slate-900 active:scale-95"
              title="Open sidebar"
            >
              <PanelLeftOpen size={15} strokeWidth={1.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ width: isOpen ? sidebarWidth : 0 }}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-[#e2ddd2]/70',
          'bg-gradient-to-b from-[#fbf9f4]/95 via-[#f6f4ef]/90 to-[#faf8f3]/95 backdrop-blur-md',
          'shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.4)]',
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
                    <Sparkles size={11} className="text-amber-500 fill-amber-500/10 animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9c957b]">
                      Neural Nomad
                    </p>
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                    Your Journeys
                  </h2>
                </div>
                
                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2ddd2]/60 bg-white/60 text-[#8c857b] shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-[#ddd7ca] hover:bg-white hover:text-slate-900 hover:shadow-md active:scale-95"
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e1e1a] via-[#121210] to-[#1e1e1a] border border-white/5 px-4 py-2.5 text-xs font-semibold text-[#fbfaf7] shadow-[0_4px_12px_rgba(30,30,26,0.15)] transition-all duration-300 hover:bg-[#282824] hover:shadow-[0_8px_20px_-4px_rgba(30,30,26,0.35)]"
                >
                  <Plus size={13} strokeWidth={2.5} className="text-amber-400" />
                  <span>New Plan</span>
                </motion.button>
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
        <h3 className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#968f83]">
          {title}
        </h3>
        {workspaces.length > 0 && (
          <span className="text-[9px] font-bold bg-[#e8e3d5]/60 text-[#7c756a] px-2 py-0.5 rounded-full scale-90">
            {workspaces.length}
          </span>
        )}
      </div>

      <div className="max-h-[220px] overflow-y-auto custom-scrollbar pr-0.5 space-y-1.5">
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
                dateStr={dateStr}
                status={workspace.status}
                isActive={workspace.id === activeWorkspaceId}
                onClick={() => onOpen(workspace, hasPlan)}
                onDelete={(e) => onDelete(e, workspace.id)}
              />
            );
          })
        ) : (
          <p className="px-2 py-2 text-xs text-[#968f83]/80 italic font-medium">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  dateStr?: string;
  status: string;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

function SidebarItem({
  icon,
  label,
  dateStr,
  status,
  isActive = false,
  onClick,
  onDelete,
}: SidebarItemProps) {
  
  // Render luxury-style pill badges
  const getStatusBadge = () => {
    switch (status) {
      case 'booked':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/40 px-1.5 py-0.5 rounded-md">
            Booked
          </span>
        );
      case 'saved':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/40 px-1.5 py-0.5 rounded-md">
            Saved
          </span>
        );
      case 'draft':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-slate-100/90 text-slate-600 border border-slate-200/40 px-1.5 py-0.5 rounded-md">
            Draft
          </span>
        );
      case 'active':
      default:
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-amber-50 text-amber-700 border border-amber-200/40 px-1.5 py-0.5 rounded-md">
            Plan Ready
          </span>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left cursor-pointer transition-all duration-300",
        isActive
          ? "bg-white border border-[#d3cbbe] shadow-[0_6px_16px_-4px_rgba(139,124,103,0.12)] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:rounded-r-md before:bg-[#bfa780]"
          : "bg-white/45 border border-[#e8e3d5]/30 hover:bg-white/85 hover:border-[#ddd7ca] hover:shadow-[0_4px_12px_rgba(139,124,103,0.04)]"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 shadow-sm shrink-0",
          isActive
            ? "bg-[#bfa780] text-white shadow-[0_2px_8px_rgba(191,167,128,0.25)] border border-[#bfa780]"
            : "bg-white border border-[#e8e3d5]/60 text-[#8c857b] group-hover:text-slate-800 group-hover:bg-white group-hover:border-[#ddd7ca]"
        )}
      >
        {icon}
      </div>
      
      <div className="min-w-0 flex-1 pr-6">
        <p
          className={cn(
            "truncate text-xs leading-tight transition-colors duration-200",
            isActive ? "text-slate-900 font-bold" : "text-slate-600 font-semibold group-hover:text-slate-900"
          )}
        >
          {label}
        </p>
        
        <div className="mt-1 flex items-center gap-1.5">
          {getStatusBadge()}
          {dateStr && (
            <span className="text-[9px] text-[#9c958a] font-medium">
              • {dateStr}
            </span>
          )}
        </div>
      </div>

      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-600 rounded-lg group-hover:opacity-100 focus:opacity-100"
          title="Delete Plan"
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

