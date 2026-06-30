'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, History, Bookmark, Briefcase, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlannerSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function PlannerSidebar({ isOpen, onToggle }: PlannerSidebarProps) {
  const sidebarWidth = 260;

  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? sidebarWidth : 0 }}
      className={cn(
        'relative z-20 flex h-full shrink-0 flex-col border-r border-[#d9d4c7] bg-[#f2eee5]',
        !isOpen && 'border-none'
      )}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
    >
      <div className={`absolute top-4 z-50 ${isOpen ? 'right-4' : '-right-12'}`}>
        <button
          onClick={onToggle}
          className="rounded-xl border border-[#d9d4c7] bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-[#faf8f2] hover:text-slate-900"
          title={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-full w-[260px] flex-col overflow-hidden p-4"
          >
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Planner
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Trips in progress</h2>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#d9d4c7] bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-[#faf8f2] hover:text-slate-900">
                <Plus size={14} />
                New Plan
              </button>
              <div className="w-8 shrink-0" />
            </div>

            <nav className="custom-scrollbar flex-1 space-y-5 overflow-y-auto pr-2">
              <div className="space-y-1">
                <h3 className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Recent
                </h3>
                <SidebarItem icon={<History size={16} />} label="Tokyo Itinerary" meta="Updated 2h ago" />
                <SidebarItem icon={<History size={16} />} label="Bali Getaway" meta="Waiting on flights" />
              </div>

              <div className="space-y-1">
                <h3 className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Saved
                </h3>
                <SidebarItem icon={<Bookmark size={14} />} label="Europe Backpacking" meta="Ideas and notes" />
                <SidebarItem icon={<Bookmark size={14} />} label="Kerala Houseboat" meta="Draft itinerary" />
              </div>

              <div className="space-y-1">
                <h3 className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Booked
                </h3>
                <SidebarItem icon={<Briefcase size={14} />} label="Goa 2024" meta="Locked itinerary" />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SidebarItem({
  icon,
  label,
  meta,
}: {
  icon: React.ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/80">
      <div className="rounded-lg bg-white p-1.5 text-slate-500 shadow-sm">{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 truncate text-[10px] text-slate-500">{meta}</p>
      </div>
    </button>
  );
}
