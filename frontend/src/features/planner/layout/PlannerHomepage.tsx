'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, MapPin, Calendar, Plane } from 'lucide-react';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import { useWorkspaces, useCreateWorkspace } from '@/hooks/use-planner';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';

const GREETING = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  draft: { label: 'Draft', dot: 'bg-amber-400' },
  active: { label: 'Planning', dot: 'bg-blue-500' },
  completed: { label: 'Completed', dot: 'bg-emerald-500' },
  booked: { label: 'Booked', dot: 'bg-violet-500' },
  archived: { label: 'Archived', dot: 'bg-slate-400' },
};

export default function PlannerHomepage() {
  const user = useAuthStore((s) => s.user);
  const setActiveWorkspaceId = usePlannerStore((s) => s.setActiveWorkspaceId);
  const { data: workspaces, isLoading } = useWorkspaces();
  const createMutation = useCreateWorkspace();

  const handleNewPlan = () => {
    createMutation.mutate('New Trip');
  };

  const greeting = GREETING();
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'Traveler';

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 overflow-y-auto">
      {/* ─── Hero ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="text-center max-w-2xl"
      >
        {/* Animated gradient orb */}
        <div className="relative mx-auto mb-8 w-20 h-20">
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 via-violet-400 to-rose-400 opacity-20 blur-xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-rose-500 shadow-lg shadow-violet-500/20">
            <Sparkles className="text-white" size={28} />
          </div>
        </div>

        <motion.h1
          className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {greeting}, {firstName}
        </motion.h1>

        <motion.p
          className="mt-3 text-lg text-slate-500 dark:text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Where would you like to go next?
        </motion.p>

        {/* New Plan Button */}
        <motion.button
          onClick={handleNewPlan}
          disabled={createMutation.isPending}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group mt-8 inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 text-sm font-semibold shadow-lg shadow-slate-900/10 dark:shadow-white/10 hover:shadow-xl transition-all"
        >
          <Sparkles size={16} className="opacity-80" />
          {createMutation.isPending ? 'Creating...' : 'Start Planning'}
          <ArrowRight size={16} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>
      </motion.div>

      {/* ─── Recent Trips ──────────────────────── */}
      {workspaces && workspaces.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-16 w-full max-w-3xl"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 px-1">
            Recent Trips
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workspaces.slice(0, 6).map((ws, idx) => {
              const statusInfo = STATUS_LABELS[ws.status] || STATUS_LABELS.draft;
              return (
                <motion.button
                  key={ws.id}
                  onClick={() => setActiveWorkspaceId(ws.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + idx * 0.05 }}
                  whileHover={{ y: -2 }}
                  className="group text-left p-4 rounded-2xl bg-white/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 backdrop-blur-sm hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-slate-900/40 transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {statusInfo.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {ws.title}
                  </h3>

                  <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {formatDate(ws.created_at)}
                    </span>
                    {ws.chat_count > 0 && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {ws.chat_count} msgs
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-16"
        >
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <motion.div
              className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            Loading your trips...
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && workspaces && workspaces.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex flex-col items-center text-center"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 mb-4">
            <Plane className="text-blue-500" size={24} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ready for your next adventure?
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Start planning and let AI build your perfect trip.
          </p>
        </motion.div>
      )}
    </div>
  );
}
