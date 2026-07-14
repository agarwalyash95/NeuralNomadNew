import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MockTripData, ItineraryItem } from './types';
import CityHeaderNode from './nodes/CityHeaderNode';
import DayHeaderNode from './nodes/DayHeaderNode';
import TransportNode from './nodes/TransportNode';
import GenericNode from './nodes/GenericNode';
import TransitNode from './nodes/TransitNode';
import DeletingNode from './nodes/DeletingNode';
import AddTypeMenu from './nodes/AddTypeMenu';
import { AlertTriangle, Car, FolderOpen, FolderClosed } from 'lucide-react';
import { NodeClickPayload } from '../types';
import { optimizeDayRoute } from './utils/routeOptimizer';
import { useTransitDistances } from '../hooks/useTransitDistances';
import { cn } from '@/lib/utils';
import { TripIntelligenceTimeline } from '../TripIntelligenceTimeline';
import type { PlanInsight } from '@/services/planner.types';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface ItineraryTimelineProps {
  data: MockTripData;
  /**
   * Called when the user clicks a plan node.
   * Now includes nodeId, dayId, cityId so PlannerWorkspace can
   * know WHICH node triggered the Helper Canvas (for Replace flow).
   */
  onItemClick?: (payload: NodeClickPayload) => void;
  onItemHover?: (item: ItineraryItem | null) => void;
  onDataChange?: (newData: MockTripData) => void;
  onVerifyLivePrice?: (itemId: string) => void;
  /** Starts a standing price watch — findings arrive later as proposals */
  onWatchPrice?: (itemId: string) => void;
  /**
   * Computes and files a route-optimization PlanProposal server-side — the
   * one reviewed path, replacing what used to be a second, unreviewed
   * direct-apply mutation here (see the day-header optimize button below).
   */
  onOptimizeRoutes?: () => void;
  /** Opens the mode-comparison canvas for an inter-city transit block */
  onCompareTransit?: (payload: NodeClickPayload) => void;
  /** T7.2: live intelligence strip per day — passed from the workspace's useInsights hook */
  insights?: PlanInsight[];
}

/** Transport types — use TransportNode (departure/arrival layout) */
const TRANSPORT_TYPES = new Set(['flight', 'train', 'bus', 'cab']);

export default function ItineraryTimeline({
  data,
  onItemClick,
  onItemHover,
  onDataChange,
  onVerifyLivePrice,
  onWatchPrice,
  onOptimizeRoutes,
  onCompareTransit,
  insights = [],
}: ItineraryTimelineProps) {
  const [localData, setLocalData] = useState<MockTripData>(data);
  const [collapsedCities, setCollapsedCities] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const [crossCityHint, setCrossCityHint] = useState(false);
  const crossCityHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { getTransit } = useTransitDistances(localData);

  // Every day in the trip, labeled "City — Day N" — the option list for
  // MoveToDaySelect, the accessible/mobile path for relocating a block
  // across cities (which drag-drop intentionally rejects, see handleDragOver).
  const allDayOptions = useMemo(
    () =>
      localData.cities.flatMap((city) =>
        city.days.map((day) => ({ id: day.id, label: `${city.cityName} — Day ${day.dayNumber}` }))
      ),
    [localData]
  );

  const handleMoveToDay = (itemId: string, targetDayId: string) => {
    const newData: MockTripData = JSON.parse(JSON.stringify(localData));
    let moved: ItineraryItem | null = null;
    for (const city of newData.cities) {
      for (const day of city.days) {
        const idx = day.items.findIndex((i: ItineraryItem) => i.id === itemId);
        if (idx !== -1) {
          moved = day.items.splice(idx, 1)[0]!;
          break;
        }
      }
      if (moved) break;
    }
    if (!moved) return;
    for (const city of newData.cities) {
      const targetDay = city.days.find((d) => d.id === targetDayId);
      if (targetDay) {
        targetDay.items.push(moved);
        break;
      }
    }
    updateData(newData, true);
  };

  useEffect(() => {
    // Preserve any isDeleting/isInactive states from localData when new props arrive
    setLocalData(prev => {
      const merged = JSON.parse(JSON.stringify(data));
      prev.cities.forEach((pCity, cIdx) => {
        const mCity = merged.cities[cIdx];
        if (!mCity) return;

        if (pCity.transitToNext?.isDeleting) {
          if (mCity.transitToNext) mCity.transitToNext.isDeleting = true;
        }
        if (pCity.transitToNext?.isInactive) {
          if (mCity.transitToNext) mCity.transitToNext.isInactive = true;
        }

        pCity.days.forEach((pDay, dIdx) => {
          const mDay = mCity.days[dIdx];
          if (!mDay) return;

          pDay.items.forEach((pItem) => {
            if (pItem.isDeleting || pItem.isInactive) {
              const mItem = mDay.items.find((i: any) => i.id === pItem.id);
              if (mItem) {
                if (pItem.isDeleting) mItem.isDeleting = true;
                if (pItem.isInactive) mItem.isInactive = true;
              }
            }
          });
        });
      });
      return merged;
    });
  }, [data]);

  const toggleCity = (cityId: string) => {
    setCollapsedCities(prev => ({ ...prev, [cityId]: !prev[cityId] }));
  };

  const toggleDay = (dayId: string) => {
    setCollapsedDays(prev => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findDayAndCity = (id: string | number) => {
    for (let c = 0; c < localData.cities.length; c++) {
      const city = localData.cities[c];
      if (!city) continue;
      for (let d = 0; d < city.days.length; d++) {
        const day = city.days[d];
        if (!day) continue;
        if (day.id === id) return { cityIndex: c, dayIndex: d, isDay: true, itemIndex: -1 };
        const itemIndex = day.items.findIndex(i => i.id === id);
        if (itemIndex !== -1) return { cityIndex: c, dayIndex: d, isDay: false, itemIndex };
      }
    }
    return null;
  };

  const updateData = (newData: MockTripData, shouldPersist = true) => {
    setLocalData(newData);
    if (shouldPersist) {
      onDataChange?.(newData);
    }
  };
 
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeInfo = findDayAndCity(active.id);
    const overInfo = findDayAndCity(over.id);

    if (!activeInfo || !overInfo) return;
    if (activeInfo.cityIndex !== overInfo.cityIndex) {
      // Splicing an item across two different cities' itineraries mid-drag
      // risks corrupting more than it fixes — rejected, but no longer
      // silently: a brief hint explains why it snapped back and points at
      // the accessible path (each node's "Move to…" picker).
      setCrossCityHint(true);
      if (crossCityHintTimer.current) clearTimeout(crossCityHintTimer.current);
      crossCityHintTimer.current = setTimeout(() => setCrossCityHint(false), 2500);
      return;
    }

    if (activeInfo.dayIndex !== overInfo.dayIndex) {
      const newData = JSON.parse(JSON.stringify(localData));
      const activeItem = newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items.splice(activeInfo.itemIndex, 1)[0];
 
      if (overInfo.isDay) {
        newData.cities[overInfo.cityIndex].days[overInfo.dayIndex].items.push(activeItem);
      } else {
        newData.cities[overInfo.cityIndex].days[overInfo.dayIndex].items.splice(overInfo.itemIndex, 0, activeItem);
      }
      updateData(newData, false); // Only update visual UI state, do not persist to database
    }
  };
 
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      // Persist the final drag-over visual positions
      onDataChange?.(localData);
      return;
    }
 
    const activeInfo = findDayAndCity(active.id);
    const overInfo = findDayAndCity(over.id);
 
    if (!activeInfo || !overInfo) {
      onDataChange?.(localData);
      return;
    }
    if (activeInfo.cityIndex !== overInfo.cityIndex) {
      onDataChange?.(localData);
      return;
    }
 
    if (activeInfo.dayIndex === overInfo.dayIndex && activeInfo.itemIndex !== overInfo.itemIndex) {
      const newData = JSON.parse(JSON.stringify(localData));
      const dayItems = newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items;
      newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items = arrayMove(dayItems, activeInfo.itemIndex, overInfo.itemIndex);
      updateData(newData, true); // Save final position to database
    } else {
      // Save the final state after dragging across different days
      onDataChange?.(localData);
    }
  };

  const handleTimeChange = (itemId: string, field: 'start' | 'end', value: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    for (const city of newData.cities) {
      for (const day of city.days) {
        const item = day.items.find((i: any) => i.id === itemId);
        if (item) {
          if (field === 'start') item.startTime = value;
          else item.endTime = value;
          updateData(newData, true);
          return;
        }
      }
    }
  };

  // Safe ID-based soft removal with 5s countdown
  const handleRemove = (itemId: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    for (const city of newData.cities) {
      for (const day of city.days) {
        const item = day.items.find((i: any) => i.id === itemId);
        if (item) {
          item.isDeleting = true;
          break;
        }
      }
    }
    updateData(newData);
  };

  const handleUndo = (itemId: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    for (const city of newData.cities) {
      for (const day of city.days) {
        const item = day.items.find((i: any) => i.id === itemId);
        if (item) {
          delete item.isDeleting;
          break;
        }
      }
    }
    updateData(newData);
  };

  // The 5s undo window has expired — actually remove the block rather than
  // flagging it isInactive forever. A soft-deleted-forever ghost still gets
  // serialized on every PATCH and every reader has to remember to filter it;
  // once the user has had their chance to undo, there's nothing left to keep.
  const handlePermanentRemove = (itemId: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    for (const city of newData.cities) {
      for (const day of city.days) {
        const idx = day.items.findIndex((i: any) => i.id === itemId);
        if (idx !== -1) {
          day.items.splice(idx, 1);
          updateData(newData);
          return;
        }
      }
    }
  };

  // Transit soft removal with 5s countdown
  const handleRemoveTransit = (cityId: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    const city = newData.cities.find((c: any) => c.id === cityId);
    if (city?.transitToNext) {
      city.transitToNext.isDeleting = true;
    }
    updateData(newData);
  };

  const handleUndoTransit = (cityId: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    const city = newData.cities.find((c: any) => c.id === cityId);
    if (city?.transitToNext) {
      delete city.transitToNext.isDeleting;
    }
    updateData(newData);
  };

  const handlePermanentRemoveTransit = (cityId: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    const city = newData.cities.find((c: any) => c.id === cityId);
    if (city) {
      delete city.transitToNext;
    }
    updateData(newData);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* pt-2 is deliberate, not decorative: without a nonzero padding-top
          here, CityHeaderNode's mt-10 margin-collapses through this block
          parent, so the "Collapse All" button (absolute, top-0, below)
          visually overlaps the first city's own Collapse button instead of
          sitting above it. */}
      <div className="relative pt-2 pb-10">
        {crossCityHint && (
          <div className="sticky top-0 z-30 mx-4 mb-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-caption font-semibold !text-amber-800 shadow-surface">
            Can&apos;t drag items between cities — use the &quot;Move to…&quot; picker on the item instead.
          </div>
        )}
        {/* Bulk expand/collapse — pinned to the corner instead of reserving
            its own full-width row above the itinerary content. */}
        <button
          type="button"
          onClick={() => {
            const allDayIds = localData.cities.flatMap(c => c.days).map(d => d.id);
            const anyCollapsed = allDayIds.some(id => collapsedDays[id]);
            const next: Record<string, boolean> = {};
            if (!anyCollapsed) {
              allDayIds.forEach(id => {
                next[id] = true;
              });
            }
            setCollapsedDays(next);
          }}
          className="absolute right-4 top-0 z-20 flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-caption font-semibold hover:border-[rgb(var(--color-journey)/0.5)] hover:bg-paper-0 hover:!text-ink-700 transition-all cursor-pointer shadow-surface export-hidden"
        >
          {localData.cities.flatMap(c => c.days).some(d => collapsedDays[d.id])
            ? <><FolderOpen size={12} /> Expand All</>
            : <><FolderClosed size={12} /> Collapse All</>}
        </button>

        {localData.cities.map((city, cityIndex) => {
          const isCityCollapsed = !!collapsedCities[city.id];
          // Hotel stay-spans: a hotel booked on day K with stayNights=N
          // covers days K..K+N-1 of this city segment. Days it covers that
          // don't have their own hotel get a continuation ribbon instead of
          // silently looking like lodging vanished (docs/planner-product-audit-2026-07.md BK2).
          const hotelCoverage: Record<number, ItineraryItem> = {};
          let activeStay: { hotel: ItineraryItem; endIndex: number } | null = null;
          city.days.forEach((d, idx) => {
            const ownHotel = d.items.find(i => !i.isInactive && i.type === 'hotel');
            if (ownHotel) {
              const nights = ownHotel.stayNights && ownHotel.stayNights > 1 ? ownHotel.stayNights : 1;
              activeStay = nights > 1 ? { hotel: ownHotel, endIndex: idx + nights - 1 } : null;
            } else if (activeStay && idx <= activeStay.endIndex) {
              hotelCoverage[idx] = activeStay.hotel;
            } else {
              activeStay = null;
            }
          });
          return (
          <div
            key={city.id}
            className="w-full"
          >
            <div id={`city-${city.cityName.replace(/\s+/g, '-').toLowerCase()}`}>
              <CityHeaderNode
                city={city}
                isCollapsed={isCityCollapsed}
                onToggle={() => toggleCity(city.id)}
              />
            </div>

            {!isCityCollapsed && city.days.map((day, dayIndex) => {
              const isDayCollapsed = !!collapsedDays[day.id];
              // A detour threshold relative to this day's own legs — 12 km
              // flat was a detour in Old Manali and a normal hop in Delhi.
              // Floor of 5 km so a compact day doesn't flag every short walk.
              const dayActiveItems = day.items.filter(i => !i.isInactive);
              const dayLegKms = dayActiveItems
                .slice(0, -1)
                .map((it, i) => getTransit(it, dayActiveItems[i + 1]!, day.transitHints).distanceKm)
                .filter((d) => d > 0.3);
              const dayMedianKm = dayLegKms.length
                ? [...dayLegKms].sort((a, b) => a - b)[Math.floor(dayLegKms.length / 2)]!
                : 0;
              const detourThresholdKm = Math.max(5, dayMedianKm * 2.5);
              return (
              <div
                key={day.id}
                className="w-full"
              >
                {(() => {
                  // Estimate only — informational "saves ~Xm" hint, computed
                  // the same way as before. Clicking no longer applies this
                  // client-side result directly; it defers to the one
                  // reviewed path (onOptimizeRoutes -> a server-computed
                  // PlanProposal), closing the audit's "two divergent trust
                  // models for the identical action" finding.
                  const optResult = optimizeDayRoute(day);
                  const canOptimize = optResult.savedKm > 0.5 && optResult.savedMins > 5;
                  const timeSavedText = canOptimize ? `saves ~${optResult.savedMins}m` : undefined;

                  return (
                    <div id={`day-${day.dayNumber}`}>
                      <DayHeaderNode
                        day={day}
                        isCollapsed={isDayCollapsed}
                        onToggle={() => toggleDay(day.id)}
                        timeSavedText={timeSavedText}
                        onOptimizeRoute={canOptimize ? onOptimizeRoutes : undefined}
                      />
                      {!isDayCollapsed && (
                        <TripIntelligenceTimeline day={day} insights={insights} className="mt-1 mb-0.5" />
                      )}
                    </div>
                  );
                })()}

                {!isDayCollapsed && hotelCoverage[dayIndex] && (
                  <div className="relative py-1.5 pl-[54px] pr-4">
                    {/* spine */}
                    <div className="absolute bottom-0 left-[20px] top-0 w-px bg-line/60" />
                    <div className="flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/60 px-3 py-1.5 text-caption font-semibold !text-indigo-700 w-fit">
                      <span>🏨</span>
                      <span>Staying at {hotelCoverage[dayIndex]!.title}</span>
                    </div>
                  </div>
                )}

                {!isDayCollapsed && dayIndex > 0 && (() => {
                  // Overnight/day-opening gap: yesterday's last stop vs today's
                  // first — the airport/station-to-hotel case generation
                  // doesn't stamp a transfer for yet. Suggested only past 2km;
                  // haversine is enough for "should I suggest this", not
                  // precise enough to price it (that's what the cab canvas is for).
                  const prevItems = city.days[dayIndex - 1]?.items.filter(i => !i.isInactive) ?? [];
                  const currItems = day.items.filter(i => !i.isInactive);
                  const lastPrev = prevItems[prevItems.length - 1];
                  const firstCurr = currItems[0];
                  if (!lastPrev || !firstCurr || lastPrev.latitude == null || lastPrev.longitude == null || firstCurr.latitude == null || firstCurr.longitude == null) {
                    return null;
                  }
                  const transit = getTransit(lastPrev, firstCurr);
                  if (transit.distanceKm <= 2) return null;
                  return (
                    <div className="relative py-2 pl-[54px] pr-4">
                      {/* spine */}
                      <div className="absolute bottom-0 left-[20px] top-0 w-px bg-line/60" />
                      <button
                        type="button"
                        onClick={() => onItemClick?.({
                          nodeId: `transfer-${lastPrev.id}-${firstCurr.id}`,
                          nodeType: 'cab',
                          nodeTitle: `Transfer to ${firstCurr.title}`,
                          dayId: day.id,
                          dayNumber: day.dayNumber,
                          dayLabel: `Day ${day.dayNumber}`,
                          cityId: city.id,
                          cityName: city.cityName,
                          dateStr: day.dateStr,
                          subtitle: `${lastPrev.title} to ${firstCurr.title}`,
                          startTime: firstCurr.startTime || '',
                        })}
                        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-left text-caption font-bold !text-amber-700 transition-all cursor-pointer hover:border-amber-400 hover:bg-amber-100 export-hidden"
                        title="No transfer is planned for this gap yet — click to book a cab"
                      >
                        <Car size={12} className="shrink-0" />
                        <span>Add transfer — {firstCurr.title} is ~{transit.distanceKm} km from {lastPrev.title}</span>
                      </button>
                    </div>
                  );
                })()}

                {!isDayCollapsed && (
                <SortableContext id={day.id} items={day.items.filter(i => !i.isInactive).map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col">
                    {day.items.filter(item => !item.isInactive).map((item, itemIndex, activeItems) => {
                      const isLastItemInDay = itemIndex === activeItems.length - 1;
                      const isVeryLastItem = isLastItemInDay && dayIndex === city.days.length - 1 && !city.transitToNext && cityIndex === localData.cities.length - 1;
                      const nextItem = activeItems[itemIndex + 1];

                      // Distance to next node: generation hint → server-resolved → haversine.
                      // Also the insert-between affordance — always available for any
                      // consecutive pair, not just ones far enough apart to show a distance pill.
                      let distPill = null;
                      if (nextItem) {
                        const transit = getTransit(item, nextItem, day.transitHints);
                        const dist = transit.distanceKm;
                        const mins = transit.durationMins;
                        const isDetour = dist > detourThresholdKm;
                        const showDistance = dist > 0.3;
                        distPill = (
                          <div key={`dist-${item.id}-${nextItem.id}`} className="relative flex items-center gap-1.5 py-1 pl-[104px]">
                            {/* main spine */}
                            <div className="absolute bottom-0 left-[20px] top-0 w-px bg-line/60" />
                            {/* sub-spine — dashed, softer */}
                            <div
                              className="absolute bottom-1/2 left-[91px] top-0 w-px"
                              style={{ borderLeft: '1px dashed rgb(var(--line) / 0.35)' }}
                            />
                            {showDistance && (
                              <button
                                type="button"
                                onClick={() => {
                                  onItemClick?.({
                                    nodeId: `transit-${item.id}-${nextItem.id}`,
                                    nodeType: 'cab',
                                    nodeTitle: `Transit from ${item.title} to ${nextItem.title}`,
                                    dayId: day.id,
                                    dayNumber: day.dayNumber,
                                    dayLabel: `Day ${day.dayNumber}`,
                                    cityId: city.id,
                                    cityName: city.cityName,
                                    dateStr: day.dateStr,
                                    subtitle: `${item.title} to ${nextItem.title}`,
                                    startTime: item.endTime || item.startTime || '',
                                  });
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-semibold transition-all cursor-pointer shadow-surface",
                                  isDetour
                                    ? "bg-amber-50 border-amber-300 !text-amber-700 hover:bg-amber-100 hover:border-amber-400"
                                    // C3: neutral hover — NOT blue. Info pill hover = amber (caution), not booking
                                    : "bg-white border-line !text-ink-600 hover:bg-amber-50/60 hover:border-amber-200/80 hover:!text-amber-700"
                                )}
                                title={isDetour ? "Noticeably farther than this day's other legs. Click to book transport." : "Click to book a taxi/cab for this transit"}
                              >
                                {isDetour ? <AlertTriangle size={10} className="shrink-0" /> : <Car size={10} className="shrink-0" />}
                                <span>{isDetour ? `Detour: ${dist} km` : `${dist} km`}</span>
                                <span className="text-ink-400">•</span>
                                <span>~{mins} mins transit</span>
                              </button>
                            )}
                            <AddTypeMenu
                              variant="icon"
                              label="Insert stop"
                              className={cn('export-hidden', showDistance ? '' : 'ml-[-0.25rem]')}
                              onSelect={(nodeType) => onItemClick?.({
                                nodeId: `insert-${item.id}-${nextItem.id}`,
                                nodeType,
                                nodeTitle: `Insert between ${item.title} and ${nextItem.title}`,
                                dayId: day.id,
                                dayNumber: day.dayNumber,
                                dayLabel: `Day ${day.dayNumber}`,
                                cityId: city.id,
                                cityName: city.cityName,
                                dateStr: day.dateStr,
                                subtitle: `Between ${item.title} and ${nextItem.title}`,
                                startTime: item.endTime || item.startTime || '',
                                insertAfterId: item.id,
                              })}
                            />
                          </div>
                        );
                      }


                      // Build the NodeClickPayload for this item
                      const clickPayload: NodeClickPayload = {
                        nodeId: item.id,
                        nodeType: item.type,
                        nodeTitle: item.title,
                        dayId: day.id,
                        dayNumber: day.dayNumber,
                        dayLabel: `Day ${day.dayNumber}${day.dateStr ? ` — ${day.dateStr}` : ''}`,
                        cityId: city.id,
                        cityName: city.cityName,
                        dateStr: day.dateStr,
                        subtitle: item.subtitle,
                        startTime: item.startTime || '',
                        latitude: item.latitude ?? undefined,
                        longitude: item.longitude ?? undefined,
                        price: item.price,
                        cost: item.cost,
                      };

                      if (item.isDeleting) {
                        return (
                          <React.Fragment key={item.id}>
                            <DeletingNode
                              item={item}
                              onUndo={() => handleUndo(item.id)}
                              onExpire={() => handlePermanentRemove(item.id)}
                            />
                            {distPill}
                          </React.Fragment>
                        );
                      }

                      // Transport types get the specialized departure/arrival node
                      if (TRANSPORT_TYPES.has(item.type)) {
                        let computedOrigin: string | undefined;
                        let computedDestination: string | undefined;
                        let distanceKm: number | undefined;

                        const hasCoords = (i: ItineraryItem) => typeof i.latitude === 'number' && typeof i.longitude === 'number';
                        
                        let prevWithCoords: ItineraryItem | undefined;
                        for (let i = itemIndex - 1; i >= 0; i--) {
                          if (hasCoords(activeItems[i])) { prevWithCoords = activeItems[i]; break; }
                        }
                        if (!prevWithCoords) {
                          for (let d = dayIndex - 1; d >= 0; d--) {
                            const dItems = city.days[d].items.filter(i => !i.isInactive);
                            for (let i = dItems.length - 1; i >= 0; i--) {
                              if (hasCoords(dItems[i])) { prevWithCoords = dItems[i]; break; }
                            }
                            if (prevWithCoords) break;
                          }
                        }
                        if (!prevWithCoords) {
                          for (let c = cityIndex - 1; c >= 0; c--) {
                            const cDays = localData.cities[c].days;
                            for (let d = cDays.length - 1; d >= 0; d--) {
                              const dItems = cDays[d].items.filter(i => !i.isInactive);
                              for (let i = dItems.length - 1; i >= 0; i--) {
                                if (hasCoords(dItems[i])) { prevWithCoords = dItems[i]; break; }
                              }
                              if (prevWithCoords) break;
                            }
                            if (prevWithCoords) break;
                          }
                        }
                        
                        let nextWithCoords: ItineraryItem | undefined;
                        for (let i = itemIndex + 1; i < activeItems.length; i++) {
                          if (hasCoords(activeItems[i])) { nextWithCoords = activeItems[i]; break; }
                        }
                        if (!nextWithCoords) {
                          for (let d = dayIndex + 1; d < city.days.length; d++) {
                            const dItems = city.days[d].items.filter(i => !i.isInactive);
                            for (let i = 0; i < dItems.length; i++) {
                              if (hasCoords(dItems[i])) { nextWithCoords = dItems[i]; break; }
                            }
                            if (nextWithCoords) break;
                          }
                        }
                        if (!nextWithCoords) {
                          for (let c = cityIndex + 1; c < localData.cities.length; c++) {
                            const cDays = localData.cities[c].days;
                            for (let d = 0; d < cDays.length; d++) {
                              const dItems = cDays[d].items.filter(i => !i.isInactive);
                              for (let i = 0; i < dItems.length; i++) {
                                if (hasCoords(dItems[i])) { nextWithCoords = dItems[i]; break; }
                              }
                              if (nextWithCoords) break;
                            }
                            if (nextWithCoords) break;
                          }
                        }

                        if (prevWithCoords) computedOrigin = prevWithCoords.title;
                        if (nextWithCoords) computedDestination = nextWithCoords.title;

                        if (prevWithCoords && nextWithCoords) {
                          const transit = getTransit(prevWithCoords, nextWithCoords, day.transitHints);
                          distanceKm = transit.distanceKm;
                        }

                        let fallbackOriginCity = city.cityName;
                        let fallbackDestCity = city.cityName;
                        if (isVeryLastItem && localData.cities[cityIndex + 1]) {
                          fallbackDestCity = localData.cities[cityIndex + 1]!.cityName;
                        }

                        return (
                          <React.Fragment key={item.id}>
                            <TransportNode
                              item={item}
                              isLast={isVeryLastItem}
                              computedOrigin={computedOrigin}
                              computedDestination={computedDestination}
                              distanceKm={distanceKm}
                              fallbackOriginCity={fallbackOriginCity}
                              fallbackDestCity={fallbackDestCity}
                              onClick={() => onItemClick?.(clickPayload)}
                              onRemove={() => handleRemove(item.id)}
                              onHover={(hovered) => onItemHover?.(hovered ? item : null)}
                              onVerifyLivePrice={onVerifyLivePrice}
                              onWatchPrice={onWatchPrice}
                              onTimeChange={(field, value) => handleTimeChange(item.id, field, value)}
                              moveDayOptions={allDayOptions}
                              currentDayId={day.id}
                              onMoveToDay={(targetDayId) => handleMoveToDay(item.id, targetDayId)}
                            />
                            {distPill}
                          </React.Fragment>
                        );
                      }

                      // Everything else (hotel, food, activity, taxi) → GenericNode
                      return (
                        <React.Fragment key={item.id}>
                          <GenericNode
                            item={item}
                            isLast={isVeryLastItem}
                            onClick={() => onItemClick?.(clickPayload)}
                            onRemove={() => handleRemove(item.id)}
                            onHover={(hovered) => onItemHover?.(hovered ? item : null)}
                            onVerifyLivePrice={onVerifyLivePrice}
                            onTimeChange={(field, value) => handleTimeChange(item.id, field, value)}
                            moveDayOptions={allDayOptions}
                            currentDayId={day.id}
                            onMoveToDay={(targetDayId) => handleMoveToDay(item.id, targetDayId)}
                          />
                          {distPill}
                        </React.Fragment>
                      );
                    })}

                    {day.items.filter(item => !item.isInactive).length === 0 && (
                      <div className="relative py-4 pl-[54px] pr-4">
                        {/* spine */}
                        <div className="absolute bottom-0 left-[20px] top-0 w-px bg-line/60" />
                        {/* horizontal connector line connecting spine to the empty menu */}
                        <div className="absolute left-[20px] top-1/2 -translate-y-1/2 w-[34px] h-px bg-line/60" />
                        <div className="flex flex-col items-start gap-1.5 ml-2.5">
                          <p className="text-caption font-medium !text-ink-400 italic">No activities planned</p>
                          <AddTypeMenu
                            variant="block"
                            label="Add stop"
                            className="export-hidden"
                            onSelect={(nodeType) => onItemClick?.({
                              nodeId: `add-activity-${day.id}`,
                              nodeType,
                              nodeTitle: `Add to Day ${day.dayNumber}`,
                              dayId: day.id,
                              dayNumber: day.dayNumber,
                              dayLabel: `Day ${day.dayNumber}`,
                              cityId: city.id,
                              cityName: city.cityName,
                              dateStr: day.dateStr,
                              subtitle: `Exploring ${city.cityName}`,
                              startTime: '09:00',
                            })}
                          />
                        </div>
                      </div>
                    )}

                    {day.items.filter(item => !item.isInactive).length > 0 && (
                      <div className="relative py-4 pl-[104px]">
                        {/* spine */}
                        <div className="absolute bottom-0 left-[20px] top-0 w-px bg-line/60" />
                        {/* sub-spine */}
                        <div
                          className="absolute bottom-1/2 left-[91px] top-0 w-px"
                          style={{ borderLeft: '1px dashed rgb(var(--line) / 0.35)' }}
                        />
                        <div className="ml-[-0.25rem] flex justify-start">
                          <AddTypeMenu
                            variant="pill"
                            label="Add"
                            className="export-hidden"
                            onSelect={(nodeType) => onItemClick?.({
                              nodeId: `add-activity-${day.id}`,
                              nodeType,
                              nodeTitle: `Add to Day ${day.dayNumber}`,
                              dayId: day.id,
                              dayNumber: day.dayNumber,
                              dayLabel: `Day ${day.dayNumber}`,
                              cityId: city.id,
                              cityName: city.cityName,
                              dateStr: day.dateStr,
                              subtitle: `Exploring ${city.cityName}`,
                              startTime: '09:00',
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </SortableContext>
                )}

              </div>
            );})}

            {!isCityCollapsed && city.transitToNext && !city.transitToNext.isInactive && (
              city.transitToNext.isDeleting ? (
                <DeletingNode
                  key={city.transitToNext.id}
                  item={city.transitToNext}
                  onUndo={() => handleUndoTransit(city.id)}
                  onExpire={() => handlePermanentRemoveTransit(city.id)}
                />
              ) : (
                <TransitNode
                  item={city.transitToNext}
                  onVerifyLivePrice={onVerifyLivePrice}
                  onClick={() => onItemClick?.({
                    nodeId: city.transitToNext!.id,
                    nodeType: city.transitToNext!.type,
                    nodeTitle: city.transitToNext!.title,
                    dayId: city.days[city.days.length - 1]?.id ?? city.id,
                    dayNumber: city.days[city.days.length - 1]?.dayNumber ?? 0,
                    dayLabel: `Transit from ${city.cityName}`,
                    cityId: city.id,
                    cityName: city.cityName,
                    dateStr: city.days[city.days.length - 1]?.dateStr ?? '',
                    subtitle: city.transitToNext!.subtitle,
                    startTime: city.transitToNext!.startTime || '',
                    price: city.transitToNext!.price,
                    cost: city.transitToNext!.cost,
                  })}
                  onCompare={onCompareTransit ? () => onCompareTransit({
                    nodeId: city.transitToNext!.id,
                    nodeType: city.transitToNext!.type,
                    nodeTitle: city.transitToNext!.title,
                    dayId: city.days[city.days.length - 1]?.id ?? city.id,
                    dayNumber: city.days[city.days.length - 1]?.dayNumber ?? 0,
                    dayLabel: `Transit from ${city.cityName}`,
                    cityId: city.id,
                    cityName: city.cityName,
                    dateStr: city.days[city.days.length - 1]?.dateStr ?? '',
                    subtitle: city.transitToNext!.subtitle,
                    startTime: city.transitToNext!.startTime || '',
                  }) : undefined}
                  onHover={(hovered) => onItemHover?.(hovered ? city.transitToNext! : null)}
                  onRemove={() => handleRemoveTransit(city.id)}
                />
              )
            )}
          </div>
        );})}
      </div>
    </DndContext>
  );
}
