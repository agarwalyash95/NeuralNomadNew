'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, DollarSign, Users, Sparkles,
  CheckCircle, ArrowRight, Star,
} from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';

interface WidgetRendererProps {
  widget: WidgetData;
  workspaceId: string;
}

/**
 * Routes widget JSON from the AI → the correct visual component.
 * Each widget type gets a distinct, premium visual treatment.
 */
export default function WidgetRenderer({ widget, workspaceId }: WidgetRendererProps) {
  const { type, data } = widget;

  switch (type) {
    case 'destination_card':
      return <DestinationCard data={data} />;
    case 'date_picker':
      return <DatePickerWidget data={data} />;
    case 'budget_slider':
      return <BudgetSliderWidget data={data} />;
    case 'traveler_selector':
      return <TravelerSelectorWidget data={data} />;
    case 'option_buttons':
      return <OptionButtonsWidget data={data} />;
    case 'checklist':
      return <ChecklistWidget data={data} />;
    case 'confirmation_card':
      return <ConfirmationCard data={data} />;
    case 'recommendation_card':
      return <RecommendationCard data={data} />;
    case 'quick_actions':
      return <QuickActionsWidget data={data} />;
    default:
      return null;
  }
}

// ─── Individual Widget Components ───────────────────

function DestinationCard({ data }: { data: Record<string, unknown> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100/60 dark:border-blue-800/40 p-3 mt-1"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 flex-shrink-0">
          <MapPin size={14} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {String(data.city || data.name || 'Destination')}
          </h4>
          {data.country && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {String(data.country)}
            </p>
          )}
          {data.description && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {String(data.description)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DatePickerWidget({ data }: { data: Record<string, unknown> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-100/60 dark:border-amber-800/40 p-3 mt-1"
    >
      <div className="flex items-center gap-2.5">
        <Calendar size={14} className="text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {data.label ? String(data.label) : 'Select dates'}
          </p>
          {data.start_date && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              {String(data.start_date)} {data.end_date ? `→ ${String(data.end_date)}` : ''}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function BudgetSliderWidget({ data }: { data: Record<string, unknown> }) {
  const presets = (data.presets as string[]) || ['Budget', 'Mid-range', 'Luxury'];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100/60 dark:border-emerald-800/40 p-3 mt-1"
    >
      <div className="flex items-center gap-2 mb-2">
        <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {data.label ? String(data.label) : 'Budget preference'}
        </p>
      </div>
      <div className="flex gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
          >
            {preset}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function TravelerSelectorWidget({ data }: { data: Record<string, unknown> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-100/60 dark:border-violet-800/40 p-3 mt-1"
    >
      <div className="flex items-center gap-2">
        <Users size={14} className="text-violet-600 dark:text-violet-400" />
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {data.label ? String(data.label) : 'Travelers'}
        </p>
      </div>
      <div className="flex gap-3 mt-2">
        {['Adults', 'Children', 'Infants'].map((label) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">{label}</span>
            <div className="flex items-center gap-0.5">
              <button className="w-5 h-5 rounded-md bg-white/80 dark:bg-slate-800/60 text-slate-500 text-[10px] border border-slate-200/60 dark:border-slate-700/40 hover:border-violet-300 transition-all">−</button>
              <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 w-4 text-center">1</span>
              <button className="w-5 h-5 rounded-md bg-white/80 dark:bg-slate-800/60 text-slate-500 text-[10px] border border-slate-200/60 dark:border-slate-700/40 hover:border-violet-300 transition-all">+</button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function OptionButtonsWidget({ data }: { data: Record<string, unknown> }) {
  const options = (data.options as string[]) || [];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-wrap gap-1.5 mt-1"
    >
      {options.map((opt) => (
        <button
          key={opt}
          className="px-3 py-1.5 rounded-xl text-[11px] font-medium bg-white/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all"
        >
          {opt}
        </button>
      ))}
    </motion.div>
  );
}

function ChecklistWidget({ data }: { data: Record<string, unknown> }) {
  const items = (data.items as string[]) || [];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-1 mt-1"
    >
      {items.map((item) => (
        <label key={item} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors">
          <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600 text-blue-500 w-3 h-3" />
          <span className="text-[11px] text-slate-600 dark:text-slate-400">{item}</span>
        </label>
      ))}
    </motion.div>
  );
}

function ConfirmationCard({ data }: { data: Record<string, unknown> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/40 dark:to-slate-700/30 border border-slate-200/60 dark:border-slate-700/40 p-3 mt-1"
    >
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle size={14} className="text-emerald-500" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {data.title ? String(data.title) : 'Confirm details'}
        </p>
      </div>
      {data.summary && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
          {String(data.summary)}
        </p>
      )}
      <div className="flex gap-1.5">
        <button className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity">
          Confirm
        </button>
        <button className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Edit
        </button>
      </div>
    </motion.div>
  );
}

function RecommendationCard({ data }: { data: Record<string, unknown> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-900/15 dark:to-violet-900/15 border border-blue-100/60 dark:border-blue-800/40 p-3 mt-1"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex-shrink-0">
          <Star size={13} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-0.5">
            AI Recommendation
          </p>
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {String(data.title || 'Suggestion')}
          </h4>
          {data.reason && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {String(data.reason)}
            </p>
          )}
          {data.estimated_cost && (
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{String(data.estimated_cost)}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 mt-2.5">
        <button className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors">
          Add to Trip
        </button>
        <button className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Compare
        </button>
      </div>
    </motion.div>
  );
}

function QuickActionsWidget({ data }: { data: Record<string, unknown> }) {
  const actions = (data.actions as Array<{ label: string; icon?: string }>) || [];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-wrap gap-1.5 mt-1"
    >
      {actions.map((action, i) => (
        <button
          key={i}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-medium bg-slate-900/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-900/10 dark:hover:bg-white/10 transition-all"
        >
          <Sparkles size={10} />
          {action.label}
          <ArrowRight size={8} className="opacity-40" />
        </button>
      ))}
    </motion.div>
  );
}
