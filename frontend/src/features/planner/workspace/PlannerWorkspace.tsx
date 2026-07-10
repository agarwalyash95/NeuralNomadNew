'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ── Plan Canvas Components & Utilities ─────────────────────────────────────
import { optimizeDayRoute } from './plan-canvas/utils/routeOptimizer';
import { parsePriceToInteger } from './plan-canvas/utils/priceParser';
import { prefetchWorkspaceData } from './utils/workspacePrefetch';
import { ProposalCard } from '../components/ProposalCard';
import DockedChat from '../chat/DockedChat';


// ── Helper Canvases — new paths ──────────────────────────────────────────────
import FlightCanvas from './helper-canvases/booking/canvases/FlightCanvas';
import HotelCanvas from './helper-canvases/booking/canvases/HotelCanvas';
import TrainCanvas from './helper-canvases/booking/canvases/TrainCanvas';
import BusCanvas from './helper-canvases/booking/canvases/BusCanvas';
import CabCanvas from './helper-canvases/booking/canvases/CabCanvas';
import CheckoutCanvas from './helper-canvases/booking/canvases/CheckoutCanvas';
import WalletCanvas from './helper-canvases/booking/canvases/WalletCanvas';
import AttractionsCanvas from './helper-canvases/explore/AttractionsCanvas';
import RestaurantsCanvas from './helper-canvases/explore/RestaurantsCanvas';
import ForexCanvas from './helper-canvases/travel-prep/forex/ForexCanvas';
import VisaCanvas from './helper-canvases/travel-prep/visa/VisaCanvas';

// ── Plan Canvas — new path ──────────────────────────────────────────────────
import { TripViewModel, ItineraryItem } from './plan-canvas/types';
import { mergeReplacementItem, toRawActivity } from './services/blockMerge';
import { usePrefetchPlaceDetails } from './hooks/usePlaceDetails';
import { transformTripData, serializePlanUpdate, getVerifyContext } from './services/planTransform';
import PlannerMap from './plan-canvas/PlannerMap';
import AIInsightsPanel from './plan-canvas/AIInsightsPanel';
import PlannerHeader from './plan-canvas/PlannerHeader';
import ItineraryTimeline from './plan-canvas/ItineraryTimeline';

// ── Types ──────────────────────────────────────────────────────────────────
import { TripContext, NodeClickPayload } from './types';
import { plannerService } from '@/services/planner.service';
import {
  usePlan,
  useLedger,
  useProposals,
  useAcceptProposal,
  useRejectProposal,
  useWorkspace,
  useSavePlan,
  useBookTrip,
  plannerKeys,
} from '@/features/planner/hooks/usePlannerQueries';
import { useQueryClient } from '@tanstack/react-query';


type ContextPanelType =
  | 'none'
  | 'flight' | 'hotel' | 'train' | 'bus' | 'cab'
  | 'attractions' | 'restaurants' | 'activities'
  | 'forex' | 'visa'
  | 'checkout'
  | 'wallet';

export interface PlannerWorkspaceProps {
  workspaceId: string | null;
}

export default function PlannerWorkspace({ workspaceId }: PlannerWorkspaceProps) {
  const [activePanel, setActivePanel] = useState<ContextPanelType>('none');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [planData, setPlanData] = useState<TripViewModel | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ItineraryItem | null>(null);
  const [focusedDayId, setFocusedDayId] = useState<string | null>(null);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);


  const [isSavingCloud, setIsSavingCloud] = useState(false);


  // ── Proposals — AI proposes, the traveler decides ──────────────────────
  const queryClient = useQueryClient();
  const { data: openProposals = [] } = useProposals(workspaceId);
  const acceptProposal = useAcceptProposal(workspaceId);
  const rejectProposal = useRejectProposal(workspaceId);
  const [optimizeNotice, setOptimizeNotice] = useState<string | null>(null);

  // ── Replace Node state ─────────────────────────────────────────────────
  const [activeNodePayload, setActiveNodePayload] = useState<NodeClickPayload | null>(null);

  // Resizable split-screen state
  const [leftWidth, setLeftWidth] = useState(60);
  const [isDragging, setIsDragging] = useState(false);


  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // ── "Current day" fallback — used when no node has been explicitly
  // clicked, so helper canvases opened generically still default to
  // wherever the user is currently looking, not always the trip's first
  // city/start date. Derived from focusedDayId, which tracks hover over
  // the itinerary timeline (PlannerWorkspace.tsx onDayEnter/onCityEnter).
  const focusedDayContext = useMemo(() => {
    if (!planData || !focusedDayId) return null;
    for (const city of planData.cities) {
      const day = city.days.find(d => d.id === focusedDayId);
      if (!day) continue;
      const geoItem = day.items.find(i => i.latitude != null && i.longitude != null);
      return {
        cityName: city.cityName,
        dateStr: day.dateStr,
        dayLabel: `Day ${day.dayNumber} — ${day.dateStr}`,
        latitude: geoItem?.latitude,
        longitude: geoItem?.longitude,
        itemTitles: day.items.map(i => i.title),
      };
    }
    return null;
  }, [planData, focusedDayId]);

  // Titles already planned for whichever day is "in play" (explicit click's
  // day, else the focused day) — Helper Canvases use this to avoid
  // suggesting something already sitting in that day's plan.
  const activeDayItemTitles = useMemo(() => {
    if (!planData) return undefined;
    const dayId = activeNodePayload?.dayId ?? focusedDayId;
    if (!dayId) return undefined;
    for (const city of planData.cities) {
      const day = city.days.find(d => d.id === dayId);
      if (day) return day.items.map(i => i.title);
    }
    return undefined;
  }, [planData, activeNodePayload?.dayId, focusedDayId]);

  // ── TripContext — computed from planData ─────────────────────────────────
  const tripContext = useMemo<TripContext>(() => {
    if (!planData) {
      return {
        tripId: workspaceId,
        destination: '',
        allCities: [],
        startDate: '',
        endDate: '',
        travellers: 2,
        currency: 'INR',
      };
    }

    const allCities = planData.cities.map(c => c.cityName);
    const firstCity = planData.cities[0];

    return {
      tripId: workspaceId,
      destination: firstCity?.cityName ?? '',
      allCities,
      // Structured fields from the view model — no display-string parsing
      startDate: planData.startDate ?? '',
      endDate: planData.endDate ?? '',
      travellers: planData.travelers ?? 1,
      currency: planData.budget?.currency ?? 'INR',
      // Active node context: explicit click > currently-focused day > nothing.
      // This is what lets a Helper Canvas opened without clicking a node
      // still show suggestions near "the current day we are" in the trip.
      activeNodeId: activeNodePayload?.nodeId,
      activeNodeDayId: activeNodePayload?.dayId,
      activeNodeCityId: activeNodePayload?.cityId,
      activeNodeType: activeNodePayload?.nodeType,
      activeNodeTitle: activeNodePayload?.nodeTitle,
      activeNodeDayLabel: activeNodePayload?.dayLabel ?? focusedDayContext?.dayLabel,
      activeNodeSubtitle: activeNodePayload?.subtitle,
      activeNodeStartTime: activeNodePayload?.startTime,
      activeNodeCityName: activeNodePayload?.cityName ?? focusedDayContext?.cityName,
      activeNodeDateStr: activeNodePayload?.dateStr ?? focusedDayContext?.dateStr,
      activeNodeLatitude: activeNodePayload?.latitude ?? focusedDayContext?.latitude,
      activeNodeLongitude: activeNodePayload?.longitude ?? focusedDayContext?.longitude,
      activeNodePrice: activeNodePayload?.price,
      activeNodeCost: activeNodePayload?.cost,
      activeDayItemTitles,
    };
  }, [planData, workspaceId, activeNodePayload, focusedDayContext, activeDayItemTitles]);

  // ── Sync initial active city/day & trigger background prefetching ─────
  useEffect(() => {
    if (planData?.cities?.[0]) {
      setActiveCityId(planData.cities[0].id);
      if (planData.cities[0].days?.[0]) {
        setFocusedDayId(planData.cities[0].days[0].id);
      }
      // Asynchronously pre-fetch hotel/flight/activities for destination in background
      prefetchWorkspaceData(planData.cities[0].cityName);
    }
  }, [planData]);




  // ── Resize split screen ──────────────────────────────────────────────────
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      if (newWidth >= 30 && newWidth <= 70) setLeftWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // ── Fetch plan from backend (shared React Query cache) ──────────────────
  const { data: trip, isPending: isPlanPending, isError: isPlanError } = usePlan(workspaceId);
  const { data: ledger } = useLedger(workspaceId);
  const { data: workspace } = useWorkspace(workspaceId);
  const savePlan = useSavePlan(workspaceId);
  const bookTrip = useBookTrip(workspaceId);
  // Warm rich place details for every identifiable block — hover is instant
  usePrefetchPlaceDetails(planData);

  useEffect(() => {
    if (!workspaceId) { setIsLoading(false); return; }
    if (isPlanPending) { setIsLoading(true); return; }

    if (!isPlanError && trip && trip.cities && trip.cities.length > 0) {
      setPlanData(transformTripData(trip));
    } else {
      // Expected when the plan is still in draft mode
      setPlanData(null);
    }
    setIsLoading(false);
  }, [workspaceId, trip, isPlanPending, isPlanError]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const originalHeight = exportRef.current.style.height;
      exportRef.current.style.height = 'max-content';
      exportRef.current.classList.add('is-exporting-pdf');

      const canvas = await html2canvas(exportRef.current, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#fbfaf7',
      });

      exportRef.current.classList.remove('is-exporting-pdf');
      exportRef.current.style.height = originalHeight;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('neural_nomad_itinerary.pdf');
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRenameTitle = async (title: string) => {
    if (!planData || !workspaceId) return;
    setPlanData({ ...planData, title });
    try {
      // Trip title is the display truth; workspace title feeds the sidebar.
      await plannerService.updatePlan(workspaceId, { title } as any);
      await plannerService.updateWorkspace(workspaceId, { title });
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspace(workspaceId) });
    } catch (err) {
      console.error('Failed to rename trip:', err);
    }
  };

  const handlePlanDataChange = async (newData: TripViewModel) => {
    setPlanData(newData);
    if (!workspaceId) return;
    setIsSavingCloud(true);
    try {
      const { days, cities } = serializePlanUpdate(newData);
      await plannerService.updatePlan(workspaceId, { days: days as any, cities: cities as any });
      queryClient.invalidateQueries({ queryKey: plannerKeys.ledger(workspaceId) });
      // The PATCH sets is_modified server-side — refresh workspace/bucket so a
      // saved trip visibly falls back to Recent and the Save button re-arms.
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
    } catch (err) {
      console.error('Failed to save updated plan to backend:', err);
    } finally {
      setTimeout(() => setIsSavingCloud(false), 800);
    }
  };

  /**
   * handleVerifyLivePrice — ask the backend to check a block's price against
   * real data. The server writes cost + provenance atomically; we mirror the
   * returned block locally. A miss keeps the current tier — "couldn't verify"
   * is an honest, valid outcome.
   */
  const handleVerifyLivePrice = async (itemId: string) => {
    if (!planData || !workspaceId) return;

    let targetItem: ItineraryItem | null = null;
    let targetCityName = '';
    let targetDateStr: string | undefined;

    for (const city of planData.cities) {
      if (city.transitToNext?.id === itemId) {
        targetItem = city.transitToNext;
        targetCityName = city.cityName;
        break;
      }
      for (const day of city.days) {
        const found = day.items.find(i => i.id === itemId);
        if (found) {
          targetItem = found;
          targetCityName = city.cityName;
          targetDateStr = day.dateStr;
          break;
        }
      }
      if (targetItem) break;
    }

    if (!targetItem) {
      console.warn('Item not found for price verification:', itemId);
      return;
    }

    setIsSavingCloud(true);
    try {
      const context = getVerifyContext(targetItem, targetCityName, targetDateStr);
      const result = await plannerService.verifyBlock(workspaceId, itemId, context);

      if (result.verified && result.block) {
        const updatedData = JSON.parse(JSON.stringify(planData)) as TripViewModel;
        const apply = (item: ItineraryItem) => {
          item.cost = result.block.cost;
          item.blockStatus = result.block.block_status;
          if (item.cost?.amount != null) {
            item.price = `${item.cost.currency} ${item.cost.amount}`;
          }
        };
        for (const city of updatedData.cities) {
          if (city.transitToNext?.id === itemId) apply(city.transitToNext);
          for (const day of city.days) {
            const found = day.items.find(i => i.id === itemId);
            if (found) apply(found);
          }
        }
        // Server already persisted — local mirror only, no PATCH round-trip
        setPlanData(updatedData);
      }
    } catch (error) {
      console.error('Price verification failed:', error);
    } finally {
      setIsSavingCloud(false);
    }
  };

  /**
   * handleProposeRouteOptimization — the first proposal producer.
   * Computes a shorter stop order per day; if any day improves, files a
   * PlanProposal (never mutates the plan directly) for the user to decide.
   */
  const handleProposeRouteOptimization = async () => {
    if (!planData || !workspaceId) return;
    setOptimizeNotice(null);

    const optimized: TripViewModel = JSON.parse(JSON.stringify(planData));
    let totalSavedKm = 0;
    let totalSavedMins = 0;
    const improvedDayNumbers: number[] = [];

    optimized.cities.forEach((city) => {
      city.days.forEach((day, di) => {
        const result = optimizeDayRoute(day);
        if (result.savedKm > 0.5) {
          city.days[di] = result.day;
          totalSavedKm += result.savedKm;
          totalSavedMins += result.savedMins;
          improvedDayNumbers.push(day.dayNumber);
        }
      });
    });

    if (improvedDayNumbers.length === 0) {
      setOptimizeNotice('Your routes are already efficient — reordering would not save meaningful travel time.');
      setTimeout(() => setOptimizeNotice(null), 6000);
      return;
    }

    const before = serializePlanUpdate(planData);
    const after = serializePlanUpdate(optimized);
    const affected = new Set(improvedDayNumbers.map(String));
    const dayList = improvedDayNumbers.join(', ');

    try {
      await plannerService.createProposal(workspaceId, {
        kind: 'route_optimization',
        title: `Reorder day ${dayList} to cut travel time`,
        rationale: `Reordering the stops on day ${dayList} shortens the route between them — same places, less time in transit.`,
        diff: {
          before: { days: before.days.filter((d: any) => affected.has(String(d.day_number))) },
          after: { days: after.days.filter((d: any) => affected.has(String(d.day_number))) },
          deltas: { saved_km: totalSavedKm, saved_mins: totalSavedMins },
        },
      });
      queryClient.invalidateQueries({ queryKey: plannerKeys.proposals(workspaceId) });
    } catch (err) {
      console.error('Failed to create route optimization proposal:', err);
    }
  };

  /** Start a standing price watch — the agent re-checks daily and files
   *  any drop as a proposal (never a silent change). */
  const handleWatchPrice = async (itemId: string) => {
    if (!workspaceId) return;
    try {
      await plannerService.watchBlock(workspaceId, itemId);
      setOptimizeNotice("Watching this price — I'll re-check it daily and propose a change if it drops.");
      setTimeout(() => setOptimizeNotice(null), 6000);
    } catch (err) {
      console.error('Failed to start price watch:', err);
    }
  };

  /** Map an item type to the Helper Canvas that can search real options for it. */
  const openPanelForType = (nodeType: string) => {
    switch (nodeType) {
      case 'flight':     setActivePanel('flight'); break;
      case 'hotel':      setActivePanel('hotel'); break;
      case 'train':      setActivePanel('train'); break;
      case 'bus':        setActivePanel('bus'); break;
      case 'taxi':
      case 'cab':        setActivePanel('cab'); break;
      case 'activity':   setActivePanel('activities'); break;
      case 'food':       setActivePanel('restaurants'); break;
      case 'attraction': setActivePanel('attractions'); break;
      default:           setActivePanel('attractions');
    }
  };

  /**
   * handleNodeClick — called by ItineraryTimeline when any node is clicked.
   * Sets the active node context and opens the appropriate Helper Canvas.
   */
  const handleNodeClick = (payload: NodeClickPayload) => {
    setActiveNodePayload(payload);
    openPanelForType(payload.nodeType);
  };

  /**
   * handleAddToPlan — called by any Helper Canvas when user confirms a selection.
   * Finds the node that triggered the canvas (by activeNodePayload) and replaces it.
   */
  const handleAddToPlan = (newItem: ItineraryItem, options?: { thenBook?: boolean }) => {
    if (!planData) return;

    // A block's trust tier must never go blank on replace — if the Helper
    // Canvas that produced this item didn't stamp a provenance, give it the
    // lowest honest tier rather than leaving it unset.
    if (!newItem.cost) {
      newItem.cost = {
        amount: parsePriceToInteger(newItem.price) || null,
        currency: 'INR',
        provenance: { tier: 'suggested', source: 'Added from search results' },
      };
    }

    const newData: TripViewModel = JSON.parse(JSON.stringify(planData));

    // Fallback to hovered/default item context if swap clicked without opening helper canvas
    const targetNodeId = activeNodePayload?.nodeId || hoveredItem?.id || defaultItem?.id;
    if (!targetNodeId) return;

    let targetDayId = activeNodePayload?.dayId;
    if (!targetDayId) {
      for (const city of newData.cities) {
        for (const day of city.days) {
          if (day.items.some(i => i.id === targetNodeId)) {
            targetDayId = day.id;
            break;
          }
        }
        if (targetDayId) break;
      }
    }



    // Detour recommendation checks are disabled per user request to preserve the current layout
    // of in-place replacements. Users can manually optimize later if desired.

    // Replace the specific clicked or hovered node. The old block's slot data
    // (id, timing, backend fields) survives the swap — only the place changes.
    let replaced = false;
    for (const city of newData.cities) {
      for (const day of city.days) {
        const idx = day.items.findIndex(i => i.id === targetNodeId);
        if (idx !== -1) {
          day.items[idx] = mergeReplacementItem(day.items[idx]!, newItem);
          replaced = true;
          break;
        }
      }
      if (replaced) break;
    }

    if (!replaced && targetDayId) {
      for (const city of newData.cities) {
        const day = city.days.find(d => d.id === targetDayId);
        if (day) {
          // A brand-new block needs a complete backend dict too, or the next
          // PATCH would persist only the handful of fields serialize touches.
          newItem._rawActivity = toRawActivity(newItem);
          day.items.push(newItem);
          break;
        }
      }
    }

    handlePlanDataChange(newData);
    // "Add to booking" flows straight into Checkout with the block priced
    setActivePanel(options?.thenBook ? 'checkout' : 'none');
    setActiveNodePayload(null);
  };


  // ── Render ───────────────────────────────────────────────────────────────

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    // Plain skeleton — reopening an existing trip is a fetch, not a generation
    return (
      <div className="flex h-full w-full overflow-hidden bg-paper-0">
        <div className="flex h-full w-[60%] flex-col gap-4 border-r border-line bg-paper-1 p-6">
          <div className="h-24 w-full animate-pulse rounded-2xl bg-[#ece8dd]" />
          <div className="h-8 w-2/3 animate-pulse rounded-xl bg-[#ece8dd]" />
          <div className="flex-1 animate-pulse rounded-2xl bg-[#ece8dd]/60" />
        </div>
        <div className="flex h-full flex-1 flex-col">
          <div className="h-1/2 w-full animate-pulse bg-[#ece8dd]/50" />
          <div className="h-1/2 w-full animate-pulse bg-[#ece8dd]/30" />
        </div>
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl mb-4">
            🌍
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Awaiting Trip Details</h2>
          <p className="text-sm font-medium text-slate-500 mb-6">
            Your workspace is ready. Tell the AI what kind of trip you want to plan, and we&apos;ll generate the perfect itinerary for you here.
          </p>
          <div className="h-1 w-12 rounded-full bg-blue-200"></div>
        </div>
      </div>
    );
  }

  const defaultItem = planData?.cities?.[0]?.days?.[0]?.items?.[0] || null;

  return (
    <div ref={containerRef} className="relative flex h-full w-full overflow-hidden bg-paper-0">
      {workspaceId && (
        <DockedChat
          workspaceId={workspaceId}
          onOpenHelper={(panel) => setActivePanel(panel as any)}
          onOptimizeRoutes={handleProposeRouteOptimization}
        />
      )}

      {/* Open proposals — the universal accept/reject grammar for AI changes */}
      <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-3">
        <AnimatePresence>
          {optimizeNotice && (
            <motion.div
              key="optimize-notice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-[340px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-semibold text-emerald-800 shadow-md"
            >
              {optimizeNotice}
            </motion.div>
          )}
          {openProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onAccept={(id) => acceptProposal.mutateAsync(id)}
              onReject={(id, reason) => rejectProposal.mutateAsync({ proposalId: id, reason })}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Left Panel: Sticky Top Nav + Workspace AI Bar + Timeline */}
      <div
        className="relative h-full border-r border-line bg-paper-1 flex flex-col overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {/* Fixed Header & Navigation Container */}
        <div className="border-b border-line bg-paper-1 shadow-xs px-4 pt-4 pb-2 shrink-0">
          <PlannerHeader
            data={planData}
            ledger={ledger ?? null}
            onExport={handleExport}
            isExporting={isExporting}
            isSavingCloud={isSavingCloud}
            onBook={() => setActivePanel('checkout')}
            onViewPasses={() => setActivePanel('wallet')}
            onOptimizeRoutes={handleProposeRouteOptimization}
            onSave={() => savePlan.mutate()}
            isSaving={savePlan.isPending}
            isSaved={workspace?.bucket === 'saved'}
            onRenameTitle={handleRenameTitle}
          />
          
          <div className="flex w-full items-center justify-between gap-2 mt-3 pt-3 border-t border-line/80">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {planData.cities.map((city) => {
                const citySlug = city.cityName.replace(/\s+/g, '-').toLowerCase();
                return (
                  <button
                    key={city.id}
                    onClick={() => {
                      const el = document.getElementById(`city-${citySlug}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setActiveCityId(city.id);
                    }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold shadow-xs border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      activeCityId === city.id
                        ? 'bg-blue-600 border-blue-700 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600'
                    }`}
                  >
                    📍 {city.cityName}
                  </button>
                );
              })}

              {planData.cities.length > 0 && (
                <div className="h-4 w-[1.5px] bg-slate-300/80 shrink-0 mx-1" />
              )}

              {planData.cities.flatMap(c => c.days).map((day) => (
                <button
                  key={day.id}
                  onClick={() => {
                    const el = document.getElementById(`day-${day.dayNumber}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setFocusedDayId(day.id);
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-xs border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    focusedDayId === day.id
                      ? 'bg-blue-600 border-blue-700 text-white font-extrabold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  Day {day.dayNumber}
                </button>
              ))}
            </div>

            {/* Cloud Sync Status Indicator */}
            {isSavingCloud && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0 animate-pulse">
                ⚡ Saving...
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Timeline */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4" ref={exportRef}>
          <ItineraryTimeline
            data={planData}
            onItemHover={(item) => { if (item) setHoveredItem(item); }}
            onCityEnter={(cityId) => setActiveCityId(cityId)}
            onDayEnter={(dayId) => setFocusedDayId(dayId)}
            onDataChange={handlePlanDataChange}
            onItemClick={handleNodeClick}
            onVerifyLivePrice={handleVerifyLivePrice}
            onWatchPrice={handleWatchPrice}
          />
        </div>
      </div>

      {/* Resizable Split-Screen Handle Bar */}
      <div
        onMouseDown={startResize}
        className={`relative flex h-full w-[6px] cursor-col-resize items-center justify-center border-l border-r border-line bg-paper-1 hover:bg-slate-200 transition-colors select-none z-40 ${
          isDragging ? 'bg-slate-300 border-slate-400' : ''
        }`}
      >
        <div className="flex flex-col gap-1">
          <span className="h-1 w-0.5 rounded-full bg-slate-400" />
          <span className="h-1 w-0.5 rounded-full bg-slate-400" />
          <span className="h-1 w-0.5 rounded-full bg-slate-400" />
        </div>
      </div>

      {/* Right Panel: Helper Canvas / Default Map + AI Insights */}
      <div
        className="relative h-full flex flex-col overflow-hidden bg-paper-1"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 cursor-col-resize bg-transparent" />
        )}
        <AnimatePresence mode="wait">
          {activePanel === 'none' ? (
            <motion.div
              key="map-insights-split"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full w-full flex flex-col overflow-hidden"
            >
              {/* Top Half: Map for geo-context */}
              <div className="h-1/2 w-full overflow-hidden border-b border-line">
                <PlannerMap
                  planData={planData}
                  hoveredItem={hoveredItem}
                  focusedDayId={focusedDayId}
                  onPinClick={(item) => setHoveredItem(item)}
                />
              </div>

              {/* Bottom Half: AI Insights */}
              <div className="h-1/2 w-full overflow-hidden relative bg-paper-1">
                <AIInsightsPanel
                  item={hoveredItem || defaultItem}
                  onSwapItem={handleAddToPlan}
                  onExplore={(item) => openPanelForType(item.type)}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`helper-${activePanel}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="h-full w-full overflow-y-auto"
            >
              {/* Booking Canvases */}
              {activePanel === 'flight' && (
                <FlightCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'hotel' && (
                <HotelCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'train' && (
                <TrainCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'bus' && (
                <BusCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'cab' && (
                <CabCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}

              {activePanel === 'attractions' && (
                <AttractionsCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'restaurants' && (
                <RestaurantsCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'activities' && (
                <AttractionsCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}

              {/* Travel Prep Canvases */}
              {activePanel === 'forex' && (
                <ForexCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} />
              )}
              {activePanel === 'visa' && (
                <VisaCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} />
              )}
              {activePanel === 'checkout' && (
                <CheckoutCanvas
                  planData={planData}
                  workspaceId={workspaceId}
                  onClose={() => setActivePanel('none')}
                  onConfirmBooking={async () => {
                    if (!workspaceId || !planData) throw new Error('No active trip to book.');
                    // Server-authoritative booking: the state machine creates
                    // commitment rows and stamps verified/booking provenance.
                    // Errors are re-thrown — the checkout UI only shows success
                    // once this has actually happened, never on a timer.
                    const blockIds: string[] = [];
                    const isBookable = (item: ItineraryItem | undefined) =>
                      item && !item.isInactive && item.blockStatus !== 'booked';
                    planData.cities.forEach((city) => {
                      if (isBookable(city.transitToNext)) {
                        blockIds.push(city.transitToNext!.id);
                      }
                      city.days.forEach((day) =>
                        day.items.forEach((item) => {
                          if (isBookable(item)) blockIds.push(item.id);
                        })
                      );
                    });
                    if (blockIds.length === 0) return;
                    setIsSavingCloud(true);
                    try {
                      const result = await plannerService.transitionBlocks(workspaceId, {
                        to: 'booked',
                        block_ids: blockIds,
                      });
                      setPlanData(transformTripData(result.trip));
                      // Every costed block is now committed — promote the whole
                      // trip to Booked so it moves to the Booked sidebar bucket.
                      try {
                        await bookTrip.mutateAsync({});
                      } catch (bookErr) {
                        // 409 = some blocks still unbooked (e.g. transition
                        // errors above); the trip stays in Recent — not fatal.
                        console.warn('Trip-level booking not completed:', bookErr);
                      }
                      queryClient.invalidateQueries({ queryKey: plannerKeys.ledger(workspaceId) });
                      queryClient.invalidateQueries({ queryKey: plannerKeys.plan(workspaceId) });
                      queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
                    } catch (err) {
                      console.error('Booking transition failed:', err);
                      throw err;
                    } finally {
                      setIsSavingCloud(false);
                    }
                  }}
                />
              )}
              {activePanel === 'wallet' && (
                <WalletCanvas 
                  planData={planData} 
                  onClose={() => setActivePanel('none')} 
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
