'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, Wallet, AlertTriangle, Sparkles,
  Clock, ArrowDown, ChevronRight,
} from 'lucide-react';
import { usePlan, useContext, useRecommendations } from '@/hooks/use-planner';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import { formatCurrency } from '@/lib/utils';
import type { TripDay, TripActivity, Recommendation, CanvasType } from '@/services/planner.types';
import { CANVAS_COLORS } from '@/services/planner.types';

interface PlanCanvasProps {
  workspaceId: string;
}

export default function PlanCanvas({ workspaceId }: PlanCanvasProps) {
  const { data: plan, isLoading: planLoading } = usePlan(workspaceId);
  const { data: context } = useContext(workspaceId);
  const { data: recommendations } = useRecommendations(workspaceId);
  const openCanvas = usePlannerStore((s) => s.openCanvas);

  // Calculate budget progress
  const totalBudget = plan?.total_budget || context?.budget || 0;
  const spentBudget = plan?.spent_budget || 0;
  const budgetPercent = totalBudget > 0 ? Math.min((spentBudget / totalBudget) * 100, 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ─── Header ──────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-14 pb-4 bg-gradient-to-b from-white/80 to-transparent dark:from-slate-900/80">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Trip title */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {plan?.title || context?.destination_location || 'Journey Canvas'}
            </h1>
          </div>

          {/* Trip meta */}
          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            {context?.start_date && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {context.start_date}
                {context.end_date && ` → ${context.end_date}`}
              </span>
            )}
            {totalBudget > 0 && (
              <span className="flex items-center gap-1">
                <Wallet size={10} />
                {formatCurrency(totalBudget)}
              </span>
            )}
            {context?.adults && (
              <span className="flex items-center gap-1">
                👤 {context.adults + (context.children || 0)} travelers
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* ─── Scrollable Content ──────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar space-y-5">
        {/* ─── Budget Tracker ──────────────── */}
        {totalBudget > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100/50 dark:border-emerald-800/30 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Budget Tracker
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {formatCurrency(spentBudget)} / {formatCurrency(totalBudget)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                initial={{ width: 0 }}
                animate={{ width: `${budgetPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}

        {/* ─── Empty State ─────────────────── */}
        {!planLoading && (!plan?.days || plan.days.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col items-center text-center py-16"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 mb-4">
              <MapPin className="text-blue-500" size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Your journey starts here
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 max-w-[260px] leading-relaxed">
              Chat with the AI to add destinations, dates, and activities. Your timeline will appear here.
            </p>
          </motion.div>
        )}

        {/* ─── Timeline ────────────────────── */}
        {plan?.days && plan.days.length > 0 && (
          <div className="space-y-1">
            {plan.days.map((day: TripDay, dIdx: number) => (
              <motion.div
                key={day.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + dIdx * 0.05 }}
              >
                {/* Day header */}
                <div className="flex items-center gap-2.5 py-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold">
                    {day.day_number}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {day.title || `Day ${day.day_number}`}
                    </h3>
                    {day.date && (
                      <p className="text-[10px] text-slate-400">{day.date}</p>
                    )}
                  </div>
                  <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50">
                    {day.day_type}
                  </span>
                </div>

                {/* Activities */}
                <div className="ml-3.5 border-l-2 border-slate-200/60 dark:border-slate-700/40 pl-4 space-y-1 py-1">
                  {day.activities?.map((activity: TripActivity, aIdx: number) => (
                    <TimelineItem key={activity.id} activity={activity} index={aIdx} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── Recommendations ─────────────── */}
        {recommendations && recommendations.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
              AI Suggestions
            </h3>
            {recommendations.slice(0, 4).map((rec: Recommendation, rIdx: number) => (
              <motion.button
                key={rec.id}
                onClick={() => openCanvas(rec.canvas_type as CanvasType)}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + rIdx * 0.05 }}
                whileHover={{ x: 2 }}
                className="group flex items-start gap-3 w-full p-3 rounded-xl bg-white/60 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/30 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm text-left transition-all"
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: CANVAS_COLORS[rec.canvas_type as CanvasType]?.bg || '#f0f0f0',
                    color: CANVAS_COLORS[rec.canvas_type as CanvasType]?.accent || '#666',
                  }}
                >
                  <Sparkles size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {rec.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {rec.reason}
                  </p>
                  {rec.estimated_cost && (
                    <span className="inline-block text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrency(rec.estimated_cost)}
                    </span>
                  )}
                </div>
                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-400 mt-0.5 flex-shrink-0 transition-colors" />
              </motion.button>
            ))}
          </div>
        )}

        {/* Loading */}
        {planLoading && (
          <div className="space-y-3 py-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Item ──────────────────────────────────

function TimelineItem({ activity, index }: { activity: TripActivity; index: number }) {
  const CATEGORY_EMOJIS: Record<string, string> = {
    flight: '✈️',
    hotel: '🏨',
    restaurant: '🍽️',
    attraction: '🏛️',
    activity: '🎭',
    transport: '🚕',
    visa: '📄',
    forex: '💱',
    general: '📍',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="group flex items-center gap-3 py-1.5 px-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/30 transition-all cursor-pointer"
    >
      {/* Timeline dot */}
      <div className="relative flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 transition-colors" />
        <div className="absolute -left-[21px] top-1/2 w-4 h-px bg-slate-200/60 dark:bg-slate-700/40" />
      </div>

      {/* Content */}
      <span className="text-sm flex-shrink-0">
        {CATEGORY_EMOJIS[activity.category] || '📍'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {activity.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {activity.start_time && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock size={8} />
              {activity.start_time}
            </span>
          )}
          {activity.duration_minutes > 0 && (
            <span className="text-[10px] text-slate-400">
              {activity.duration_minutes}min
            </span>
          )}
          {activity.estimated_cost > 0 && (
            <span className="text-[10px] text-emerald-500 font-medium">
              {formatCurrency(activity.estimated_cost)}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      {activity.status === 'booked' && (
        <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md flex-shrink-0">
          Booked
        </span>
      )}
    </motion.div>
  );
}
