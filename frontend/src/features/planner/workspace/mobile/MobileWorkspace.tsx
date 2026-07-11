'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Map as MapIcon, List, CreditCard, Download, Loader2, Save } from 'lucide-react';
import DockedChat from '../../chat/DockedChat';
import { ProposalCard } from '../../components/ProposalCard';
import ItineraryTimeline from '../plan-canvas/ItineraryTimeline';
import PlannerMap from '../plan-canvas/PlannerMap';
import AIInsightsPanel from '../plan-canvas/AIInsightsPanel';
import { usePlannerHoverStore } from '@/store/planner-hover.store';
import { TripViewModel, ItineraryItem } from '../plan-canvas/types';
import type { NodeClickPayload } from '../types';
import type { PlanProposal } from '@/services/planner.types';
import type { ContextPanelType } from '../PlannerWorkspace';

/**
 * MB1 — mobile composition (<768px): single-pane timeline-first, node tap
 * opens a bottom sheet instead of hover, Helper Canvases become full-screen
 * sheets, and the map is a toggle tab instead of a simultaneous pane. This
 * re-houses ItineraryTimeline/PlannerMap/AIInsightsPanel exactly as they
 * are on desktop — none of them know they're being shown differently.
 * See MB1, docs/planner-product-audit-2026-07.md.
 */

function findItemById(planData: TripViewModel, id: string): ItineraryItem | null {
  for (const city of planData.cities) {
    if (city.transitToNext?.id === id) return city.transitToNext;
    for (const day of city.days) {
      const found = day.items.find((i) => i.id === id);
      if (found) return found;
    }
  }
  return null;
}

interface MobileWorkspaceProps {
  planData: TripViewModel;
  workspaceId: string | null;
  activePanel: ContextPanelType;
  /** Pre-rendered Helper Canvas switch, shared verbatim with the desktop layout. */
  activePanelContent: React.ReactNode;
  onOpenPanel: (panel: string) => void;
  onOpenPanelForType: (nodeType: string) => void;
  onDataChange: (newData: TripViewModel) => void;
  onVerifyLivePrice: (itemId: string) => void;
  onWatchPrice: (itemId: string) => void;
  onOptimizeRoutes: () => void;
  onCompareTransit: (payload: NodeClickPayload) => void;
  onAddToPlan: (item: ItineraryItem, options?: { thenBook?: boolean }) => void;
  onExport: () => void;
  isExporting: boolean;
  onSave: () => void;
  isSaving: boolean;
  openProposals: PlanProposal[];
  onAcceptProposal: (id: string) => Promise<unknown>;
  onRejectProposal: (id: string, reason?: string) => Promise<unknown>;
  focusedDayId: string | null;
  onFocusDay: (dayId: string) => void;
}

export default function MobileWorkspace({
  planData,
  workspaceId,
  activePanel,
  activePanelContent,
  onOpenPanel,
  onOpenPanelForType,
  onDataChange,
  onVerifyLivePrice,
  onWatchPrice,
  onOptimizeRoutes,
  onCompareTransit,
  onAddToPlan,
  onExport,
  isExporting,
  onSave,
  isSaving,
  openProposals,
  onAcceptProposal,
  onRejectProposal,
  focusedDayId,
  onFocusDay,
}: MobileWorkspaceProps) {
  const [view, setView] = useState<'timeline' | 'map'>('timeline');
  const [sheetItem, setSheetItem] = useState<ItineraryItem | null>(null);

  const allDays = planData.cities.flatMap((c) => c.days);
  const closeSheet = () => setSheetItem(null);

  // A tap is mobile's only signal of "what's the user looking at" — no
  // hover exists to populate it, so this stamps the same store desktop's
  // mouseenter does. handleAddToPlan (in the parent) reads that store as
  // its fallback for which block a Helper Canvas selection should replace.
  const focusItem = (item: ItineraryItem) => {
    usePlannerHoverStore.getState().setHoveredItem(item);
    setSheetItem(item);
  };

  const handleNodeTap = (payload: NodeClickPayload) => {
    const item = findItemById(planData, payload.nodeId);
    if (item) focusItem(item);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-paper-0">
      <DockedChat workspaceId={workspaceId} onOpenHelper={onOpenPanel} onOptimizeRoutes={onOptimizeRoutes} />

      {/* Proposals — same accept/reject grammar as desktop, stacked above the tab bar */}
      <div className="fixed bottom-3 left-3 right-3 z-40 flex flex-col gap-2">
        <AnimatePresence>
          {openProposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} onAccept={onAcceptProposal} onReject={onRejectProposal} />
          ))}
        </AnimatePresence>
      </div>

      {/* Condensed header: title + stats, Save/Export/Book */}
      <div className="flex items-center gap-2 border-b border-line bg-paper-1 px-3 py-2.5 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold text-ink-900">{planData.title}</h1>
          <p className="truncate text-[11px] font-semibold text-ink-500">{planData.stats}</p>
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          aria-label="Save"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-500 disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        </button>
        <button
          onClick={onExport}
          disabled={isExporting}
          aria-label="Export PDF"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-500 disabled:opacity-50"
        >
          {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        </button>
        <button
          onClick={() => onOpenPanel('checkout')}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-[12px] font-bold text-white"
        >
          <CreditCard size={14} />
          Book
        </button>
      </div>

      {/* Day pager — horizontally-snapping */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-line bg-paper-1 px-3 py-2 shrink-0 snap-x snap-mandatory">
        {allDays.map((day) => (
          <button
            key={day.id}
            onClick={() => {
              onFocusDay(day.id);
              document.getElementById(`day-${day.dayNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`flex h-11 shrink-0 snap-start items-center rounded-full px-3.5 text-[12px] font-bold transition-colors ${
              focusedDayId === day.id ? 'bg-blue-600 text-white' : 'border border-line bg-paper-2 text-ink-600'
            }`}
          >
            Day {day.dayNumber}
          </button>
        ))}
      </div>

      {/* Timeline / Map toggle — a tab, not a simultaneous pane */}
      <div className="flex border-b border-line bg-paper-1 shrink-0" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'timeline'}
          onClick={() => setView('timeline')}
          className={`flex h-11 flex-1 items-center justify-center gap-1.5 text-[12px] font-bold ${
            view === 'timeline' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-ink-500'
          }`}
        >
          <List size={14} /> Timeline
        </button>
        <button
          role="tab"
          aria-selected={view === 'map'}
          onClick={() => setView('map')}
          className={`flex h-11 flex-1 items-center justify-center gap-1.5 text-[12px] font-bold ${
            view === 'map' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-ink-500'
          }`}
        >
          <MapIcon size={14} /> Map
        </button>
      </div>

      {/* Content pane */}
      <div className="flex-1 overflow-hidden">
        {view === 'timeline' ? (
          <div className="h-full overflow-y-auto px-3 py-3">
            <ItineraryTimeline
              data={planData}
              onItemClick={handleNodeTap}
              onItemHover={() => {}}
              onDataChange={onDataChange}
              onVerifyLivePrice={onVerifyLivePrice}
              onWatchPrice={onWatchPrice}
              onOptimizeRoutes={onOptimizeRoutes}
              onCompareTransit={onCompareTransit}
            />
          </div>
        ) : (
          <PlannerMap planData={planData} pinnedItem={sheetItem} focusedDayId={focusedDayId} onPinClick={focusItem} />
        )}
      </div>

      {/* Bottom sheet — node tap details. AIInsightsPanel already composes
          RichHoverCard internally, so this is a re-housing, not a rebuild. */}
      <AnimatePresence>
        {sheetItem && (
          <React.Fragment key="sheet">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/30"
              onClick={closeSheet}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-[71] flex max-h-[80vh] flex-col overflow-hidden rounded-t-3xl bg-paper-1 shadow-[0_-16px_48px_-24px_rgba(15,23,42,0.35)]"
            >
              <div className="relative flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
                <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Details</span>
                <button
                  onClick={closeSheet}
                  aria-label="Close"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-ink-400 hover:bg-paper-2"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <AIInsightsPanel
                  pinnedItem={sheetItem}
                  onSwapItem={(item) => {
                    onAddToPlan(item);
                    closeSheet();
                  }}
                  onExplore={(item) => {
                    onOpenPanelForType(item.type);
                    closeSheet();
                  }}
                />
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>

      {/* Helper Canvas — full-screen sheet with the canvas's own sticky Add/Book CTA */}
      <AnimatePresence>
        {activePanel !== 'none' && (
          <motion.div
            key="canvas-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-paper-0"
          >
            {activePanelContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
