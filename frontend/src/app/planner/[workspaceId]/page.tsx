'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import PlannerChat from '@/features/planner/chat/PlannerChat';
import PlannerWorkspace from '@/features/planner/workspace/PlannerWorkspace';
import { useWorkspace } from '@/features/planner/hooks/usePlannerQueries';
import { hasGeneratedPlan } from '@/features/planner/sidebar/lib/groupWorkspaces';

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { data: workspace, isPending, isError } = useWorkspace(workspaceId);

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-paper-0 p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            This trip could not be found
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            It may have been deleted, or the link may be wrong.
          </p>
          <button
            onClick={() => router.push('/planner')}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Start a new plan
          </button>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex h-full w-full flex-col gap-4 bg-paper-0 p-8">
        <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-[#ece8dd]" />
        <div className="h-8 w-1/3 animate-pulse rounded-xl bg-[#ece8dd]" />
        <div className="flex-1 animate-pulse rounded-3xl bg-[#ece8dd]/60" />
      </div>
    );
  }

  const mode = workspace && hasGeneratedPlan(workspace) ? 'plan' : 'chat';

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-paper-0">
      <AnimatePresence mode="wait">
        {mode === 'chat' ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <PlannerChat workspaceId={workspaceId} />
          </motion.div>
        ) : (
          <motion.div
            key="plan"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="absolute inset-0 flex"
          >
            <PlannerWorkspace workspaceId={workspaceId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
