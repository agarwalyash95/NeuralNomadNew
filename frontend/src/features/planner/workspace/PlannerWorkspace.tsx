'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Sparkles } from 'lucide-react';

// ── Plan Canvas Components & Utilities ─────────────────────────────────────
import PlanStreamerLoader from './plan-canvas/PlanStreamerLoader';
import { prefetchWorkspaceData } from './utils/workspacePrefetch';
import { recommendOptimalSlot, SlotRecommendationResult } from './plan-canvas/utils/routeOptimizer';


// ── Helper Canvases — new paths ──────────────────────────────────────────────
import FlightCanvas from './helper-canvases/booking/canvases/FlightCanvas';
import HotelCanvas from './helper-canvases/booking/canvases/HotelCanvas';
import TrainCanvas from './helper-canvases/booking/canvases/TrainCanvas';
import BusCanvas from './helper-canvases/booking/canvases/BusCanvas';
import CabCanvas from './helper-canvases/booking/canvases/CabCanvas';
import AttractionsCanvas from './helper-canvases/explore/AttractionsCanvas';
import RestaurantsCanvas from './helper-canvases/explore/RestaurantsCanvas';
import ActivitiesCanvas from './helper-canvases/explore/ActivitiesCanvas';
import ForexCanvas from './helper-canvases/travel-prep/forex/ForexCanvas';
import VisaCanvas from './helper-canvases/travel-prep/visa/VisaCanvas';

// ── Plan Canvas — new path ──────────────────────────────────────────────────
import { mockTripData, MockTripData, ItineraryCity, ItineraryItem } from './plan-canvas/mockData';
import PlannerMap from './plan-canvas/PlannerMap';
import AIInsightsPanel from './plan-canvas/AIInsightsPanel';
import PlannerHeader from './plan-canvas/PlannerHeader';
import PreJourneyChecklist from './plan-canvas/PreJourneyChecklist';
import ItineraryTimeline from './plan-canvas/ItineraryTimeline';

// ── Types ──────────────────────────────────────────────────────────────────
import { TripContext, NodeClickPayload } from './types';
import { plannerService } from '@/services/planner.service';
import type { PlannerTrip } from '@/services/planner.types';


type ContextPanelType =
  | 'none'
  | 'flight' | 'hotel' | 'train' | 'bus' | 'cab'
  | 'attractions' | 'restaurants' | 'activities'
  | 'forex' | 'visa';

export interface PlannerWorkspaceProps {
  workspaceId: string | null;
}

export default function PlannerWorkspace({ workspaceId }: PlannerWorkspaceProps) {
  const [activePanel, setActivePanel] = useState<ContextPanelType>('none');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [planData, setPlanData] = useState<MockTripData | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ItineraryItem | null>(null);
  const [focusedDayId, setFocusedDayId] = useState<string | null>(null);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ── AI Command Bar State ────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState('');
  const [isSavingCloud, setIsSavingCloud] = useState(false);


  // ── Smart Position Recommendation Modal State ──────────────────────────
  const [pendingRecommendation, setPendingRecommendation] = useState<{
    rec: SlotRecommendationResult;
    newItem: ItineraryItem;
    targetDayId: string;
    targetIndex: number;
  } | null>(null);

  // ── Replace Node state ─────────────────────────────────────────────────
  const [activeNodePayload, setActiveNodePayload] = useState<NodeClickPayload | null>(null);

  // Resizable split-screen state
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);


  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

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
    const lastCity = planData.cities[planData.cities.length - 1];

    const travMatch = planData.stats?.match(/(\d+)\s+travellers?/i);
    const travellers = travMatch ? parseInt(travMatch[1] || '2', 10) : 2;

    // Parse date ranges from the first and last city
    const startDate = firstCity?.dateRange?.split(' to ')?.[0] ?? '';
    const endDate = lastCity?.dateRange?.split(' to ')?.[1] ?? '';

    return {
      tripId: workspaceId,
      destination: firstCity?.cityName ?? '',
      allCities,
      startDate,
      endDate,
      travellers,
      currency: 'INR',
      // Active node context (set when a node is clicked)
      activeNodeId: activeNodePayload?.nodeId,
      activeNodeDayId: activeNodePayload?.dayId,
      activeNodeCityId: activeNodePayload?.cityId,
      activeNodeType: activeNodePayload?.nodeType,
      activeNodeTitle: activeNodePayload?.nodeTitle,
      activeNodeDayLabel: activeNodePayload?.dayLabel,
    };
  }, [planData, workspaceId, activeNodePayload]);

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


  // ── Sidebar sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleToggle = (e: Event) => {
      setIsSidebarOpen((e as CustomEvent).detail);
    };
    window.addEventListener('planner:toggle-sidebar', handleToggle);
    return () => window.removeEventListener('planner:toggle-sidebar', handleToggle);
  }, []);

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

  // ── Fetch plan from backend ──────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) { setIsLoading(false); return; }

    let isMounted = true;
    const fetchPlan = async () => {
      try {
        const trip = await plannerService.getPlan(workspaceId);
        if (!isMounted) return;
        setPlanData(transformTripData(trip));
        setIsLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to fetch plan:', err);
        setPlanData(mockTripData);
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    fetchPlan();
    return () => { isMounted = false; };
  }, [workspaceId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const originalHeight = exportRef.current.style.height;
      exportRef.current.style.height = 'max-content';
      const canvas = await html2canvas(exportRef.current, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#fbfaf7',
      });
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

  const handlePlanDataChange = async (newData: MockTripData) => {
    setPlanData(newData);
    if (!workspaceId) return;
    setIsSavingCloud(true);
    try {
      const backendDays = newData.cities.flatMap(city =>
        city.days.map(day => ({
          id: day.id,
          day_number: day.dayNumber,
          date: day.dateStr,
          title: day.title,
          city: city.cityName,
          activities: day.items.map(item => {
            const raw = { ...(item._rawActivity || {}) };
            raw.is_active = !item.isInactive;
            raw.status = item.isInactive ? 'inactive' : (item.status === 'Confirmed' ? 'booked' : 'pending');
            return raw;
          }),
        }))
      );
      const backendCities = newData.cities.map(city => ({
        id: city.id,
        name: city.cityName,
        nights: city.nights,
        arrival_date: city.dateRange?.split(' to ')[0] || '',
        departure_date: city.dateRange?.split(' to ')[1] || '',
        transitToNext: city.transitToNext ? {
          ...(city.transitToNext._rawActivity || {}),
          id: city.transitToNext.id,
          type: city.transitToNext.type,
          title: city.transitToNext.title,
          subtitle: city.transitToNext.subtitle,
          details: city.transitToNext.details,
          price: city.transitToNext.price,
          is_active: !city.transitToNext.isInactive,
          status: city.transitToNext.isInactive ? 'inactive' : 'booked',
        } : null,
      }));
      await plannerService.updatePlan(workspaceId, { days: backendDays as any, cities: backendCities as any });
    } catch (err) {
      console.error('Failed to save updated plan to backend:', err);
    } finally {
      setTimeout(() => setIsSavingCloud(false), 800);
    }
  };

  /**
   * handleNodeClick — called by ItineraryTimeline when any node is clicked.
   * Sets the active node context and opens the appropriate Helper Canvas.
   */
  const handleNodeClick = (payload: NodeClickPayload) => {
    setActiveNodePayload(payload);
    switch (payload.nodeType) {
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
   * handleAddToPlan — called by any Helper Canvas when user confirms a selection.
   * Finds the node that triggered the canvas (by activeNodePayload) and replaces it.
   */
  const handleAddToPlan = (newItem: ItineraryItem) => {
    if (!planData || !activeNodePayload) return;

    const newData: MockTripData = JSON.parse(JSON.stringify(planData));

    // Check if item causes detour and recommend optimal slot
    let targetDay = null;
    let targetDayId = activeNodePayload.dayId;
    for (const city of newData.cities) {
      const d = city.days.find(day => day.id === targetDayId);
      if (d) { targetDay = d; break; }
    }

    if (targetDay) {
      const targetIdx = targetDay.items.findIndex(i => i.id === activeNodePayload.nodeId);
      const recResult = recommendOptimalSlot(newItem, targetDay, Math.max(0, targetIdx));
      if (!recResult.isOptimal) {
        setPendingRecommendation({
          rec: recResult,
          newItem,
          targetDayId,
          targetIndex: Math.max(0, targetIdx),
        });
      }
    }

    // Replace the specific clicked node
    let replaced = false;
    for (const city of newData.cities) {
      for (const day of city.days) {
        const idx = day.items.findIndex(i => i.id === activeNodePayload.nodeId);
        if (idx !== -1) {
          newItem.id = activeNodePayload.nodeId;
          day.items[idx] = newItem;
          replaced = true;
          break;
        }
      }
      if (replaced) break;
    }

    if (!replaced) {
      for (const city of newData.cities) {
        const day = city.days.find(d => d.id === activeNodePayload.dayId);
        if (day) {
          day.items.push(newItem);
          break;
        }
      }
    }

    handlePlanDataChange(newData);
    setActivePanel('none');
    setActiveNodePayload(null);
  };


  // ── Render ───────────────────────────────────────────────────────────────

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading || !planData) {
    return (
      <PlanStreamerLoader destination={planData?.cities?.[0]?.cityName || 'Manali'} />
    );
  }

  const defaultItem = planData?.cities?.[0]?.days?.[0]?.items?.[0] || null;

  return (
    <div ref={containerRef} className="relative flex h-full w-full overflow-hidden bg-[#f6f4ef]">
      {/* Smart Position Recommendation Modal */}
      <AnimatePresence>
        {pendingRecommendation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="flex max-w-md flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-amber-600">
                <Sparkles size={20} className="animate-spin-slow text-amber-500" />
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  AI Route Distance Warning
                </h4>
              </div>

              <p className="text-xs font-medium leading-relaxed text-slate-600">
                {pendingRecommendation.rec.reasonText}
              </p>

              <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs font-semibold text-slate-700">
                <div className="flex justify-between">
                  <span>Current placement travel:</span>
                  <span className="text-rose-600 font-bold">{pendingRecommendation.rec.currentDistanceKm} km</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span>Optimal position travel:</span>
                  <span className="text-emerald-600 font-bold">{pendingRecommendation.rec.recommendedDistanceKm} km</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setPendingRecommendation(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Keep Original Slot
                </button>
                <button
                  onClick={() => {
                    const { newItem, rec, targetDayId } = pendingRecommendation;
                    if (planData) {
                      const newData: MockTripData = JSON.parse(JSON.stringify(planData));
                      for (const city of newData.cities) {
                        const day = city.days.find(d => d.id === targetDayId);
                        if (day) {
                          const existIdx = day.items.findIndex(i => i.id === newItem.id);
                          if (existIdx !== -1) day.items.splice(existIdx, 1);
                          day.items.splice(rec.recommendedIndex, 0, newItem);
                          break;
                        }
                      }
                      handlePlanDataChange(newData);
                    }
                    setPendingRecommendation(null);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Accept Optimal Slot (Saves ~{pendingRecommendation.rec.savedTravelMins}m)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Panel: Sticky Top Nav + Workspace AI Bar + Timeline & Checklist */}
      <div
        className="custom-scrollbar relative h-full overflow-y-auto border-r border-[#e2ddd2] bg-[#fbfaf7] flex flex-col"
        style={{ width: `${leftWidth}%` }}
      >
        {/* Sticky city + day navigation bar */}
        <div className={`sticky top-0 z-50 flex w-full flex-col border-b border-[#e2ddd2] bg-[#fbfaf7]/95 backdrop-blur-md shadow-xs ${
          isSidebarOpen ? 'px-4 py-2' : 'pl-20 pr-4 py-2'
        }`}>
          <div className="flex w-full items-center justify-between gap-2">
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

          {/* Workspace AI Command Bar (Magic Bar) */}
          <div className="mt-2 flex w-full flex-col gap-1.5 pt-1.5 border-t border-slate-200/60">
            <div className="relative flex w-full items-center">
              <Sparkles size={14} className="absolute left-3 text-indigo-600 pointer-events-none" />
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiPrompt.trim()) {
                    // Quick workspace prompt trigger
                    setAiPrompt('');
                  }
                }}
                placeholder="Ask AI to refine workspace (e.g. 'Make Day 2 more relaxed', 'Find dinner in Old Manali')..."
                className="w-full rounded-xl border border-slate-200/90 bg-white/90 py-1.5 pl-8 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Prompt Action Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { label: '⚡ Optimize Routes', prompt: 'Optimize daily activity routes for distance' },
                { label: '💰 Budget Options', prompt: 'Show budget-friendly alternatives' },
                { label: '🍽️ Local Foodie Spots', prompt: 'Add top authentic local dining spots' },
                { label: '🌧️ Rainy Day Backup', prompt: 'Suggest indoor alternatives' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => {
                    setAiPrompt(chip.prompt);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-600 shadow-2xs hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>


        {/* Scrollable Timeline */}
        <div className="flex-1 px-4 py-4" ref={exportRef}>
          <PlannerHeader data={planData} onExport={handleExport} isExporting={isExporting} />
          <PreJourneyChecklist
            data={planData.checklist}
            onChecklistClick={(type) => {
              if (type === 'visa') setActivePanel('visa');
              else if (type === 'forex') setActivePanel('forex');
            }}
          />
          <ItineraryTimeline
            data={planData}
            onItemHover={(item) => { if (item) setHoveredItem(item); }}
            onCityEnter={(cityId) => setActiveCityId(cityId)}
            onDayEnter={(dayId) => setFocusedDayId(dayId)}
            onDataChange={handlePlanDataChange}
            onItemClick={handleNodeClick}
          />
        </div>
      </div>

      {/* Resizable Split-Screen Handle Bar */}
      <div
        onMouseDown={startResize}
        className={`relative flex h-full w-[6px] cursor-col-resize items-center justify-center border-l border-r border-[#e2ddd2] bg-[#fbfaf7] hover:bg-slate-200 transition-colors select-none z-40 ${
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
        className="relative h-full flex flex-col overflow-hidden bg-[#fbfaf7]"
        style={{ width: `${100 - leftWidth}%` }}
      >
        <AnimatePresence mode="wait">
          {activePanel === 'none' ? (
            <motion.div
              key="default-map-insights"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="flex h-full w-full flex-col overflow-hidden"
            >
              <div className="h-[58%] w-full overflow-hidden border-b border-[#e2ddd2]">
                <PlannerMap
                  planData={planData}
                  hoveredItem={hoveredItem}
                  focusedDayId={focusedDayId}
                  onPinClick={(item) => setHoveredItem(item)}
                />
              </div>
              <div className="h-[42%] w-full overflow-hidden">
                <AIInsightsPanel item={hoveredItem || defaultItem} onSwapItem={handleAddToPlan} />
              </div>

            </motion.div>
          ) : (
            <motion.div
              key={`helper-${activePanel}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="flex h-full w-full flex-col overflow-hidden"
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

              {/* Explore Canvases (3 separate) */}
              {activePanel === 'attractions' && (
                <AttractionsCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'restaurants' && (
                <RestaurantsCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}
              {activePanel === 'activities' && (
                <ActivitiesCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} onAddToPlan={handleAddToPlan} />
              )}

              {/* Travel Prep Canvases */}
              {activePanel === 'forex' && (
                <ForexCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} />
              )}
              {activePanel === 'visa' && (
                <VisaCanvas tripContext={tripContext} onClose={() => setActivePanel('none')} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Data Transformer ─────────────────────────────────────────────────────────
function transformTripData(trip: PlannerTrip): MockTripData {
  const travelers = (trip.metadata?.travelers as number) || 1;
  const stats = `${trip.days.length} days • ${trip.cities.length} locations • ${trip.currency_code} ${trip.total_budget} budget • ${travelers} travellers`;

  const cityMap = new Map<string, ItineraryCity>();

  trip.cities.forEach((city, index) => {
    const transit = (city as any).transitToNext;
    let mappedTransit = undefined;
    if (transit) {
      const isTransitInactive = transit.is_active === false || transit.status === 'inactive';
      mappedTransit = {
        id: transit.id || `transit-${city.id}`,
        type: transit.type || 'taxi',
        title: transit.title,
        subtitle: transit.subtitle || '',
        details: transit.details,
        price: transit.price,
        status: isTransitInactive ? 'inactive' : (transit.status === 'booked' ? 'Confirmed' : 'Pending'),
        image: transit.image,
        isInactive: isTransitInactive,
        _rawActivity: transit,
      } as ItineraryItem;
    }

    cityMap.set(city.name, {
      id: city.id || `city-${index}`,
      cityName: city.name,
      nights: city.nights,
      dateRange: city.arrival_date ? `${city.arrival_date} to ${city.departure_date}` : '',
      weather: '20°C • Pleasant',
      iconBgColor: index % 2 === 0 ? 'bg-indigo-500' : 'bg-emerald-500',
      icon: city.name.substring(0, 2).toUpperCase(),
      days: [],
      transitToNext: mappedTransit,
    });
  });

  trip.days.forEach((day, index) => {
    let targetCityName = (day as any).city || (day as any).cityName;

    if (!targetCityName) {
      let nightSum = 0;
      let foundCityName = '';
      for (const city of trip.cities) {
        nightSum += city.nights;
        if (day.day_number <= nightSum) { foundCityName = city.name; break; }
      }
      targetCityName = foundCityName || trip.cities[trip.cities.length - 1]?.name || 'Itinerary';
    }

    let targetCity = cityMap.get(targetCityName);
    if (!targetCity) {
      const lowerName = targetCityName.toLowerCase();
      targetCity = Array.from(cityMap.values()).find(c => c.cityName.toLowerCase() === lowerName);
    }
    if (!targetCity) {
      const newCityObj: ItineraryCity = {
        id: `city-dynamic-${index}`,
        cityName: targetCityName,
        nights: 1,
        dateRange: '',
        weather: '20°C • Pleasant',
        iconBgColor: 'bg-indigo-500',
        icon: targetCityName.substring(0, 2).toUpperCase(),
        days: [],
      };
      cityMap.set(targetCityName, newCityObj);
      targetCity = newCityObj;
    }

    const items: ItineraryItem[] = day.activities?.map((a, actIdx) => {
      const metadata = a.metadata || {};
      const isInactive = (a as any).is_active === false || (a as any).status === 'inactive';
      return {
        id: a.id || `activity-${day.day_number}-${actIdx}`,
        type: (a.category?.toLowerCase() || 'activity') as any,
        startTime: a.start_time || '',
        endTime: a.end_time || '',
        title: a.title,
        subtitle: a.location_name || '',
        price: a.estimated_cost ? `${a.currency_code || trip.currency_code} ${a.estimated_cost}` : undefined,
        status: isInactive ? 'inactive' : (a.status === 'booked' ? 'Confirmed' : 'Pending'),
        details: a.notes,
        latitude: a.latitude ?? (metadata.latitude as number | undefined),
        longitude: a.longitude ?? (metadata.longitude as number | undefined),
        aiTip: (a as any).aiTip || (a as any).ai_tip || (metadata.aiTip as string | undefined) || (metadata.ai_tip as string | undefined),
        rating: (a as any).rating || (metadata.rating as number | undefined),
        image: (a as any).image || (a as any).image_url || (metadata.image as string | undefined),
        geoTag: (a as any).geoTag || (a as any).geo_tag || (metadata.geoTag as string | undefined) || targetCityName,
        isInactive,
        _rawActivity: a,
      };
    }) || [];

    targetCity.days.push({
      id: day.id || `day-${day.day_number}`,
      dayNumber: day.day_number,
      dateStr: day.date || `Day ${day.day_number}`,
      title: day.title || `Exploring ${targetCity.cityName}`,
      items,
    });
  });

  return {
    title: trip.title || 'Your Generated Trip',
    stats,
    checklist: [
      { id: 'hotels', label: 'Hotel Bookings', status: 'Pending', type: 'accommodation' },
      { id: 'transport', label: 'Local Transport', status: 'Pending', type: 'transport' },
      { id: 'cash', label: 'Travel Funds/Forex', status: 'Pending', type: 'forex' },
    ],
    cities: Array.from(cityMap.values()).filter(c => c.days.length > 0),
  };
}
