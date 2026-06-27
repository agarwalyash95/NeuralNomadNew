'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Sparkles, FileText, CheckCircle2, Plane,
  MoreHorizontal, Home,
} from 'lucide-react';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import { useWorkspaces, useCreateWorkspace } from '@/hooks/use-planner';
import type { PlannerWorkspace } from '@/services/planner.types';

const STATUS_GROUPS: { key: string; label: string; icon: React.ElementType; statuses: string[] }[] = [
  { key: 'active', label: 'Active', icon: Sparkles, statuses: ['draft', 'active'] },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, statuses: ['completed', 'booked'] },
  { key: 'archived', label: 'Archived', icon: FileText, statuses: ['archived'] },
];

export default function PlannerSidebar() {
  const { activeWorkspaceId, setActiveWorkspaceId, setShowHomepage } = usePlannerStore();
  const { data: workspaces } = useWorkspaces();
  const createMutation = useCreateWorkspace();

  const grouped = React.useMemo(() => {
    const map: Record<string, PlannerWorkspace[]> = {};
    STATUS_GROUPS.forEach((g) => { map[g.key] = []; });
    (workspaces || []).forEach((ws) => {
      const group = STATUS_GROUPS.find((g) => g.statuses.includes(ws.status));
      if (group) map[group.key]?.push(ws);
    });
    return map;
  }, [workspaces]);

  return (
    <div className="flex flex-col h-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      {/* ─── Header ──────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 shadow-sm">
            <Plane className="text-white" size={14} />
          </div>
          <span className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">
            NeuralNomad
          </span>
        </div>
      </div>

      {/* ─── Home Button ─────────────────────── */}
      <div className="px-3 pt-3">
        <button
          onClick={() => {
            setActiveWorkspaceId(null);
            setShowHomepage(true);
          }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
        >
          <Home size={14} />
          Home
        </button>
      </div>

      {/* ─── New Plan ────────────────────────── */}
      <div className="px-3 pt-2 pb-1">
        <motion.button
          onClick={() => createMutation.mutate('New Trip')}
          disabled={createMutation.isPending}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-100 dark:to-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={14} />
          {createMutation.isPending ? 'Creating...' : 'New Plan'}
        </motion.button>
      </div>

      {/* ─── Workspace Groups ────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar space-y-4">
        {STATUS_GROUPS.map((group) => {
          const items = grouped[group.key] || [];
          if (items.length === 0) return null;

          const Icon = group.icon;

          return (
            <div key={group.key}>
              <div className="flex items-center gap-1.5 px-1 mb-1.5">
                <Icon size={11} className="text-slate-400 dark:text-slate-500" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {group.label}
                </span>
                <span className="text-[10px] text-slate-300 dark:text-slate-600 ml-auto">
                  {items.length}
                </span>
              </div>

              <div className="space-y-0.5">
                {items.map((ws) => {
                  const isActive = ws.id === activeWorkspaceId;
                  return (
                    <motion.button
                      key={ws.id}
                      onClick={() => setActiveWorkspaceId(ws.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        group flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all
                        ${isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/40'
                        }
                      `}
                    >
                      <span className="text-xs font-medium truncate flex-1">
                        {ws.title}
                      </span>
                      <MoreHorizontal
                        size={12}
                        className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0"
                      />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Footer ──────────────────────────── */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/60">
        <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center">
          NeuralNomad AI Planner
        </p>
      </div>
    </div>
  );
}
