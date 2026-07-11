'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Sparkles, RefreshCw } from 'lucide-react';
// exportPdf (and jsPDF within it) is dynamically imported inside
// handleExport instead of here — it was loading on every workspace visit
// for a button most users never click. See PF4, docs/planner-product-audit-2026-07.md.

// ── Plan Canvas Components & Utilities ─────────────────────────────────────
import { parsePriceToInteger } from './plan-canvas/utils/priceParser';
import { ProposalCard } from '../components/ProposalCard';
import DockedChat from '../chat/DockedChat';


// ── Helper Canvases — new paths ──────────────────────────────────────────────
import FlightCanvas from './helper-canvases/booking/canvases/FlightCanvas';
import HotelCanvas from './helper-canvases/booking/canvases/HotelCanvas';
import TrainCanvas from './helper-canvases/booking/canvases/TrainCanvas';
import BusCanvas from './helper-canvases/booking/canvases/BusCanvas';
import CabCanvas from './helper-canvases/booking/canvases/CabCanvas';
import TransportCompareCanvas from './helper-canvases/booking/canvases/TransportCompareCanvas';
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
import InsightStrip from './plan-canvas/InsightStrip';

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
  useOptimizeRoute,
  plannerKeys,
} from '@/features/planner/hooks/usePlannerQueries';
import { useQueryClient } from '@tanstack/react-query';
import { usePlannerHoverStore } from '@/store/planner-hover.store';
import { useIsMobile } from '@/hooks/use-is-mobile';
import MobileWorkspace from './mobile/MobileWorkspace';


export type ContextPanelType =
  | 'none'
  | 'flight' | 'hotel' | 'train' | 'bus' | 'cab' | 'compare'
  | 'attractions' | 'restaurants' | 'activities'
  | 'forex' | 'visa'
  | 'checkout'
  | 'wallet';

export interface PlannerWorkspaceProps {
  workspaceId: string | null;
}

export default function PlannerWorkspace({ workspaceId }: PlannerWorkspaceProps) {
  const isMobile = useIsMobile();
  const [activePanel, setActivePanel] = useState<ContextPanelType>('none');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [planData, setPlanData] = useState<TripViewModel | null>(null);
  // Undo/redo command stacks over TripViewModel snapshots — reset whenever
  // the workspace changes so switching trips doesn't carry over history.
  const [undoStack, setUndoStack] = useState<TripViewModel[]>([]);
  const [redoStack, setRedoStack] = useState<TripViewModel[]>([]);
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, [workspaceId]);
  // Hover lives in a Zustand store (planner-hover.store.ts), not component
  // state — writing to it here never re-renders PlannerWorkspace or the
  // timeline; only the map/insights panel subscribe to the value, so a
  // sweep down a long timeline no longer re-renders the whole tree per node.
  const setHoveredItem = usePlannerHoverStore((s) => s.setHoveredItem);
  // A deliberately-selected item's insights survive mouse movement elsewhere
  // — unlike hover, which used to strobe the panel on every node the pointer
  // crossed while sweeping down the timeline. Stored by id and re-resolved
  // from planData below so a pin never shows stale data after an edit —
  // if the block was deleted/replaced, the pin naturally clears instead of
  // holding a frozen snapshot of a block that no longer exists.
  const [pinnedItemId, setPinnedItemId] = useState<string | null>(null);
  const hoverIntentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleItemHover = (item: ItineraryItem | null) => {
    if (hoverIntentTimer.current) clearTimeout(hoverIntentTimer.current);
    if (!item) return; // leaving a node keeps showing whatever was last hovered/pinned
    hoverIntentTimer.current = setTimeout(() => setHoveredItem(item), 150);
  };
  const [focusedDayId, setFocusedDayId] = useState<string | null>(null);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);


  const [isSavingCloud, setIsSavingCloud] = useState(false);


  // ── Proposals — AI proposes, the traveler decides ──────────────────────
  const queryClient = useQueryClient();
  const { data: openProposals = [] } = useProposals(workspaceId);
  const acceptProposal = useAcceptProposal(workspaceId);
  const rejectProposal = useRejectProposal(workspaceId);
  const optimizeRoute = useOptimizeRoute(workspaceId);
  const [optimizeNotice, setOptimizeNotice] = useState<string | null>(null);
  const [optimizeNoticeTone, setOptimizeNoticeTone] = useState<'success' | 'info'>('success');

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

  const pinnedItem = useMemo(() => {
    if (!pinnedItemId || !planData) return null;
    for (const city of planData.cities) {
      if (city.transitToNext?.id === pinnedItemId) return city.transitToNext;
      for (const day of city.days) {
        const found = day.items.find(i => i.id === pinnedItemId);
        if (found) return found;
      }
    }
    return null; // deleted/replaced since pinning — pin naturally clears
  }, [pinnedItemId, planData]);

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
    const activeCityName = activeNodePayload?.cityName ?? focusedDayContext?.cityName;
    const activeCitySegment = activeCityName
      ? planData.cities.find(c => c.cityName.toLowerCase() === activeCityName.toLowerCase())
      : undefined;

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
      activeNodeCityNights: activeCitySegment?.nights,
      activeNodeCityDateRange: activeCitySegment?.dateRange,
      activeNodeLatitude: activeNodePayload?.latitude ?? focusedDayContext?.latitude,
      activeNodeLongitude: activeNodePayload?.longitude ?? focusedDayContext?.longitude,
      activeNodePrice: activeNodePayload?.price,
      activeNodeCost: activeNodePayload?.cost,
      activeDayItemTitles,
    };
  }, [planData, workspaceId, activeNodePayload, focusedDayContext, activeDayItemTitles]);

  // ── Sync initial active city/day & trigger background prefetching ─────
  // Runs once per workspace load, not on every edit — `planData` is replaced
  // wholesale on every mutation (drag, replace, delete...), and this effect
  // used to fire every time, yanking focus back to city[0]/day[0] mid-edit.
  const initializedWorkspaceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!planData?.cities?.[0]) return;
    if (initializedWorkspaceRef.current === workspaceId) return;
    initializedWorkspaceRef.current = workspaceId;
    setActiveCityId(planData.cities[0].id);
    if (planData.cities[0].days?.[0]) {
      setFocusedDayId(planData.cities[0].days[0].id);
    }
  }, [planData, workspaceId]);

  // ── Scroll-spy for the city/day nav chips ──────────────────────────────
  // Previously hover-driven (mousing over a day section set the "active"
  // chip), which meant scrolling the timeline with the mouse parked
  // anywhere never moved the chips, and a mouse sweep flickered them. Hover
  // still drives only the map/insights preview (handleItemHover) — this
  // drives just the chip highlight + which day Helper Canvases default to.
  useEffect(() => {
    const container = exportRef.current;
    if (!container || !planData) return;
    const dayEls = Array.from(container.querySelectorAll<HTMLElement>('[id^="day-"]'));
    if (dayEls.length === 0) return;

    const dayIdByNumber = new Map<number, string>();
    const cityIdByDayNumber = new Map<number, string>();
    planData.cities.forEach((city) => {
      city.days.forEach((day) => {
        dayIdByNumber.set(day.dayNumber, day.id);
        cityIdByDayNumber.set(day.dayNumber, city.id);
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const dayNumber = parseInt(topMost.target.id.replace('day-', ''), 10);
        const dayId = dayIdByNumber.get(dayNumber);
        const cityId = cityIdByDayNumber.get(dayNumber);
        if (dayId) setFocusedDayId(dayId);
        if (cityId) setActiveCityId(cityId);
      },
      // A thin band near the top of the scroll container — whichever day
      // header has just crossed it is "the one currently in view".
      { root: container, rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );

    dayEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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
  // Workspace data drives the refetch interval: if the workspace says a plan
  // exists (status !== 'draft') but the plan query returned empty/errored,
  // we poll every 4 s until data arrives — covers race conditions right after
  // generation, and transient backend errors. Polling stops the moment we
  // get a valid trip with cities.
  const { data: workspace } = useWorkspace(workspaceId);
  const workspaceHasPlan = workspace && workspace.status !== 'draft';

  const {
    data: trip,
    isPending: isPlanPending,
    isError: isPlanError,
    refetch: refetchPlan,
  } = usePlan(workspaceId);
  const { data: ledger } = useLedger(workspaceId);
  const savePlan = useSavePlan(workspaceId);
  const bookTrip = useBookTrip(workspaceId);
  // Warm rich place details for every identifiable block — hover is instant
  usePrefetchPlaceDetails(planData);

  // Auto-poll every 4 s when the workspace has a plan but the data is absent.
  // Stops as soon as planData is populated.
  const autoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const tripIsEmpty = !trip || !trip.cities || trip.cities.length === 0;
    if (workspaceHasPlan && !isPlanPending && (isPlanError || tripIsEmpty) && !planData) {
      if (!autoPollRef.current) {
        autoPollRef.current = setInterval(() => { refetchPlan(); }, 4000);
      }
    } else {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    }
    return () => {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceHasPlan, isPlanPending, isPlanError, trip, planData]);

  useEffect(() => {
    if (!workspaceId) { setIsLoading(false); return; }
    if (isPlanPending) { setIsLoading(true); return; }

    if (!isPlanError && trip && trip.cities && trip.cities.length > 0) {
      setPlanData(transformTripData(trip));
    } else {
      // Expected when the plan is still in draft mode or data hasn't arrived yet
      setPlanData(null);
    }
    setIsLoading(false);
  }, [workspaceId, trip, isPlanPending, isPlanError]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!planData) return;
    setIsExporting(true);
    try {
      const { exportTripToPdf } = await import('./utils/exportPdf');
      await exportTripToPdf(planData);
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

  const persistPlan = async (newData: TripViewModel) => {
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
      // Insights/proposals were computed against the plan as it existed
      // before this edit — a deleted or replaced block must not leave a
      // warning about itself sitting on screen after the edit lands.
      queryClient.invalidateQueries({ queryKey: plannerKeys.insights(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.proposals(workspaceId) });
    } catch (err) {
      console.error('Failed to save updated plan to backend:', err);
    } finally {
      setTimeout(() => setIsSavingCloud(false), 800);
    }
  };

  // Debounced network write — local state updates instantly (below) so undo
  // stays snappy, but a burst of edits (drag, then a swap, then a time
  // tweak) coalesces into one PATCH instead of one per keystroke/drop.
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = (data: TripViewModel) => {
    if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    patchTimerRef.current = setTimeout(() => persistPlan(data), 1200);
  };

  /**
   * handlePlanDataChange — the single choke point every plan mutation flows
   * through (drag, replace, delete, time edit...). Every call here records
   * the PRE-change state on the undo stack, so Ctrl+Z always has something
   * real to restore — see handleUndo/handleRedo below. Redefined fresh each
   * render, so it always closes over the current planData/stacks — no stale
   * closures despite not being memoized.
   */
  const handlePlanDataChange = (newData: TripViewModel) => {
    if (planData) {
      setUndoStack((stack) => [...stack.slice(-49), planData]);
      setRedoStack([]);
    }
    setPlanData(newData);
    schedulePersist(newData);
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !planData) return;
    const prev = undoStack[undoStack.length - 1]!;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, planData]);
    setPlanData(prev);
    schedulePersist(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !planData) return;
    const next = redoStack[redoStack.length - 1]!;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, planData]);
    setPlanData(next);
    schedulePersist(next);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditable || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, planData]);

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
   * Computed server-side now (apps.planner.services.route_optimizer) instead
   * of duplicating the haversine/permutation logic client-side — this was
   * the exact inconsistency the audit flagged: a direct-apply button and a
   * proposal-wrapped button both existed for the identical computation.
   * There is now one computation, and it always produces a PlanProposal.
   */
  const handleProposeRouteOptimization = async () => {
    if (!planData || !workspaceId) return;
    setOptimizeNotice(null);

    try {
      const result = await optimizeRoute.mutateAsync();
      if (!result.proposal) {
        setOptimizeNoticeTone('success');
        setOptimizeNotice(result.detail || 'Your routes are already efficient — reordering would not save meaningful travel time.');
        setTimeout(() => setOptimizeNotice(null), 6000);
      }
    } catch (err) {
      console.error('Failed to compute route optimization:', err);
    }
  };

  /** Start a standing price watch — the agent re-checks daily and files
   *  any drop as a proposal (never a silent change). */
  const handleWatchPrice = async (itemId: string) => {
    if (!workspaceId) return;
    try {
      await plannerService.watchBlock(workspaceId, itemId);
      setOptimizeNoticeTone('success');
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

  /** Opens the mode-comparison canvas for an inter-city leg — the same node
   *  context as handleNodeClick, but always the compare panel regardless of
   *  the block's own type. */
  const handleCompareClick = (payload: NodeClickPayload) => {
    setActiveNodePayload(payload);
    setActivePanel('compare');
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
    const targetNodeId = activeNodePayload?.nodeId || usePlannerHoverStore.getState().hoveredItem?.id || defaultItem?.id;
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

    // Inter-city transit (city.transitToNext) lives outside day.items, so the
    // loop above never matches it — previously that meant a flight/train/bus
    // swap silently fell through to the "append as a new day item" branch
    // below instead of updating the transit segment, leaving a phantom
    // duplicate item and the stale transit block untouched.
    if (!replaced) {
      for (const city of newData.cities) {
        if (city.transitToNext?.id === targetNodeId) {
          city.transitToNext = mergeReplacementItem(city.transitToNext, newItem);
          replaced = true;
          break;
        }
      }
    }

    if (!replaced && targetDayId) {
      for (const city of newData.cities) {
        const day = city.days.find(d => d.id === targetDayId);
        if (day) {
          // A brand-new block needs a complete backend dict too, or the next
          // PATCH would persist only the handful of fields serialize touches.
          newItem._rawActivity = toRawActivity(newItem);
          // Insert-between: land right after the anchor item instead of
          // always appending to the end of the day.
          const anchorIdx = activeNodePayload?.insertAfterId
            ? day.items.findIndex(i => i.id === activeNodePayload.insertAfterId)
            : -1;
          if (anchorIdx !== -1) {
            day.items.splice(anchorIdx + 1, 0, newItem);
          } else {
            day.items.push(newItem);
          }
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
    // Layout-true — reopening an existing trip is a fetch, not a generation,
    // so this mirrors the real header/chip-row/timeline/map shape rather
    // than a handful of generic pulsing blocks that give no sense of what's
    // about to appear.
    return (
      <div role="status" aria-live="polite" aria-label="Loading trip" className="flex h-full w-full overflow-hidden bg-paper-0">
        <div className="flex h-full w-[60%] flex-col border-r border-line bg-paper-1">
          {/* Header: title bar + day-chip row, mirrors PlannerHeader */}
          <div className="border-b border-line px-4 pt-4 pb-3 shrink-0">
            <div className="h-5 w-1/2 motion-safe:animate-pulse rounded-md bg-line" />
            <div className="mt-3 flex gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-14 shrink-0 motion-safe:animate-pulse rounded-full bg-line" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>
          {/* Timeline: card-shaped rows, mirrors GenericNode/TransportNode */}
          <div className="flex-1 overflow-hidden px-4 py-4 flex flex-col gap-3">
            <div className="h-4 w-24 motion-safe:animate-pulse rounded bg-line" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-stretch gap-3 rounded-[16px] border border-line bg-paper-2 p-3 min-h-[92px] motion-safe:animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-1/4 shrink-0 rounded-xl bg-line" />
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <div className="h-3.5 w-2/3 rounded bg-line" />
                  <div className="h-2.5 w-1/3 rounded bg-line/70" />
                  <div className="h-2.5 w-1/2 rounded bg-line/50" />
                </div>
                <div className="w-16 shrink-0 rounded bg-line/70" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex h-full flex-1 flex-col">
          <div className="h-1/2 w-full motion-safe:animate-pulse bg-paper-2 border-b border-line" />
          <div className="h-1/2 w-full flex flex-col items-center justify-center gap-3 bg-paper-1">
            <div className="h-3 w-1/3 motion-safe:animate-pulse rounded bg-line" />
            <div className="h-2.5 w-1/2 motion-safe:animate-pulse rounded bg-line/70" />
          </div>
        </div>
      </div>
    );
  }

  if (!planData) {
    const isRetrying = workspaceHasPlan && !isPlanPending;
    return (
      <div className="flex h-full w-full items-center justify-center bg-paper-0 p-8">
        <div className="flex flex-col items-center max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 mb-4">
            {isRetrying ? (
              <RefreshCw size={28} className="text-blue-500 animate-spin" />
            ) : (
              <Sparkles size={28} className="text-blue-500" />
            )}
          </div>
          <h2 className="text-xl font-black text-ink-900 mb-2">
            {isRetrying ? 'Loading Your Trip…' : 'Awaiting Trip Details'}
          </h2>
          <p className="text-sm font-medium text-ink-500 mb-6">
            {isRetrying
              ? 'Your itinerary is on its way. This usually takes just a moment.'
              : 'Your workspace is ready. Tell the AI what kind of trip you want to plan, and we\u0027ll generate the perfect itinerary for you here.'}
          </p>
          {isRetrying ? (
            <button
              onClick={() => refetchPlan()}
              className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <RefreshCw size={14} />
              Refresh now
            </button>
          ) : (
            <div className="h-1 w-12 rounded-full bg-blue-200"></div>
          )}
        </div>
      </div>
    );
  }

  const defaultItem = planData?.cities?.[0]?.days?.[0]?.items?.[0] || null;

  // Shared between the desktop split-pane panel and the mobile full-screen
  // canvas sheet — one switch, so the two surfaces can't drift apart.
  const activePanelContent = (
    <>
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
      {activePanel === 'compare' && (
        <TransportCompareCanvas
          tripContext={tripContext}
          onClose={() => setActivePanel('none')}
          onSelectMode={(mode) => setActivePanel(mode === 'cab' ? 'cab' : mode)}
        />
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
      {activePanel === 'checkout' && planData && (
        <CheckoutCanvas
          planData={planData}
          workspaceId={workspaceId}
          onClose={() => setActivePanel('none')}
          onVerifyLivePrice={handleVerifyLivePrice}
          onConfirmBooking={async (checkedIds) => {
            if (!workspaceId || !planData) throw new Error('No active trip to book.');
            // Server-authoritative booking: the state machine creates
            // commitment rows and stamps verified/booking provenance.
            // Errors are re-thrown — the checkout UI only shows success
            // once this has actually happened, never on a timer.
            //
            // The traveler's checkout selection is authoritative for
            // WHICH items to book, but never trusted blindly — every
            // id is re-validated against the current plan (bookable
            // category, priced, not already booked) before it's sent.
            // Attractions/meals aren't booked here (no ticketing flow
            // exists yet), so the trip-level book/ call below is
            // allowed to stay partial rather than pretending an
            // itinerary with a priced attraction can ever fully book.
            const BOOKABLE_TYPES = new Set(['flight', 'train', 'bus', 'cab', 'taxi', 'hotel']);
            const checkedSet = new Set(checkedIds);
            const isBookable = (item: ItineraryItem | undefined) =>
              item && checkedSet.has(item.id) && !item.isInactive && item.blockStatus !== 'booked' &&
              BOOKABLE_TYPES.has(item.type) && Boolean(item.price);
            const blockIds: string[] = [];
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

              const noticeLines: string[] = [];
              const failedCount = Object.keys(result.errors || {}).length;
              if (failedCount > 0) {
                noticeLines.push(`${failedCount} item${failedCount === 1 ? '' : 's'} couldn't be confirmed and stayed as they were.`);
              }

              // allow_partial: the trip is only promoted to Booked
              // once every costed block (incl. any priced attraction
              // or meal) holds a booked commitment — otherwise it
              // stays honestly in Recent instead of throwing away
              // the transport/hotel booking that DID succeed.
              try {
                const bookResult = await bookTrip.mutateAsync({ allow_partial: true });
                const blocking = bookResult?.blocking_blocks;
                if (blocking?.length) {
                  noticeLines.push(
                    `Trip stays in Recent until ${blocking.length} more item${blocking.length === 1 ? '' : 's'} ` +
                    `(${blocking.slice(0, 2).map(b => b.title).join(', ')}${blocking.length > 2 ? ', …' : ''}) ` +
                    `${blocking.length === 1 ? 'is' : 'are'} booked too.`
                  );
                }
              } catch (bookErr) {
                console.warn('Trip-level booking not completed:', bookErr);
                noticeLines.push("Couldn't update the trip's overall booking status — it stays in Recent for now.");
              }

              if (noticeLines.length > 0) {
                setOptimizeNoticeTone('info');
                setOptimizeNotice(noticeLines.join(' '));
                setTimeout(() => setOptimizeNotice(null), 10000);
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
      {activePanel === 'wallet' && planData && (
        <WalletCanvas
          planData={planData}
          onClose={() => setActivePanel('none')}
        />
      )}
    </>
  );

  if (isMobile) {
    return (
      <MobileWorkspace
        planData={planData}
        workspaceId={workspaceId}
        activePanel={activePanel}
        activePanelContent={activePanelContent}
        onOpenPanel={(panel) => setActivePanel(panel as ContextPanelType)}
        onOpenPanelForType={openPanelForType}
        onDataChange={handlePlanDataChange}
        onVerifyLivePrice={handleVerifyLivePrice}
        onWatchPrice={handleWatchPrice}
        onOptimizeRoutes={handleProposeRouteOptimization}
        onCompareTransit={handleCompareClick}
        onAddToPlan={handleAddToPlan}
        onExport={handleExport}
        isExporting={isExporting}
        onSave={() => savePlan.mutate()}
        isSaving={savePlan.isPending}
        openProposals={openProposals}
        onAcceptProposal={(id) => acceptProposal.mutateAsync(id)}
        onRejectProposal={(id, reason) => rejectProposal.mutateAsync({ proposalId: id, reason })}
        focusedDayId={focusedDayId}
        onFocusDay={setFocusedDayId}
      />
    );
  }

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
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`w-[340px] rounded-2xl border px-4 py-3 text-[11px] font-semibold shadow-md ${
                optimizeNoticeTone === 'info'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
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
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
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
                    <MapPin size={11} className="shrink-0" /> {city.cityName}
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
              <span
                role="status"
                aria-live="polite"
                className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0 motion-safe:animate-pulse"
              >
                ⚡ Saving...
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Timeline */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4" ref={exportRef}>
          <InsightStrip workspaceId={workspaceId ?? null} />
          <ItineraryTimeline
            data={planData}
            onItemHover={handleItemHover}
            onDataChange={handlePlanDataChange}
            onItemClick={handleNodeClick}
            onVerifyLivePrice={handleVerifyLivePrice}
            onWatchPrice={handleWatchPrice}
            onOptimizeRoutes={handleProposeRouteOptimization}
            onCompareTransit={handleCompareClick}
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
                  pinnedItem={pinnedItem}
                  focusedDayId={focusedDayId}
                  onPinClick={(item) => setPinnedItemId(item.id)}
                />
              </div>

              {/* Bottom Half: AI Insights */}
              <div className="h-1/2 w-full overflow-hidden relative bg-paper-1">
                <AIInsightsPanel
                  pinnedItem={pinnedItem}
                  defaultItem={defaultItem}
                  isPinned={Boolean(pinnedItem)}
                  onTogglePin={() => setPinnedItemId(pinnedItem ? null : (usePlannerHoverStore.getState().hoveredItem || defaultItem)?.id ?? null)}
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
              {activePanelContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
