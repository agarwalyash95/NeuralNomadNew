import React, { useState, useEffect } from 'react';
import { MockTripData, ItineraryItem } from './types';
import CityHeaderNode from './nodes/CityHeaderNode';
import DayHeaderNode from './nodes/DayHeaderNode';
import TransportNode from './nodes/TransportNode';
import GenericNode from './nodes/GenericNode';
import TransitNode from './nodes/TransitNode';
import DeletingNode from './nodes/DeletingNode';
import { Plus } from 'lucide-react';
import { NodeClickPayload } from '../types';
import { optimizeDayRoute } from './utils/routeOptimizer';
import { useTransitDistances } from '../hooks/useTransitDistances';
import { cn } from '@/lib/utils';

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
  onCityEnter?: (cityId: string) => void;
  onDayEnter?: (dayId: string) => void;
  onDataChange?: (newData: MockTripData) => void;
  onVerifyLivePrice?: (itemId: string) => void;
  /** Starts a standing price watch — findings arrive later as proposals */
  onWatchPrice?: (itemId: string) => void;
}

/** Transport types — use TransportNode (departure/arrival layout) */
const TRANSPORT_TYPES = new Set(['flight', 'train', 'bus', 'cab']);

export default function ItineraryTimeline({
  data,
  onItemClick,
  onItemHover,
  onCityEnter,
  onDayEnter,
  onDataChange,
  onVerifyLivePrice,
  onWatchPrice
}: ItineraryTimelineProps) {
  const [localData, setLocalData] = useState<MockTripData>(data);
  const [collapsedCities, setCollapsedCities] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const { getTransit } = useTransitDistances(localData);

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
    if (activeInfo.cityIndex !== overInfo.cityIndex) return;
 
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

  const handlePermanentRemove = (itemId: string) => {
    const newData = JSON.parse(JSON.stringify(localData));
    for (const city of newData.cities) {
      for (const day of city.days) {
        const item = day.items.find((i: any) => i.id === itemId);
        if (item) {
          item.isInactive = true;
          delete item.isDeleting;
          break;
        }
      }
    }
    updateData(newData);
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
    if (city?.transitToNext) {
      city.transitToNext.isInactive = true;
      delete city.transitToNext.isDeleting;
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
      <div className="pb-10">
        <div className="mb-2 flex justify-end px-4">
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
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-extrabold text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer shadow-3xs export-hidden"
          >
            {localData.cities.flatMap(c => c.days).some(d => collapsedDays[d.id]) ? '📂 Expand All Days' : '📁 Collapse All Days'}
          </button>
        </div>

        {localData.cities.map((city, cityIndex) => {
          const isCityCollapsed = !!collapsedCities[city.id];
          return (
          <div
            key={city.id}
            className="w-full"
            onMouseEnter={() => onCityEnter?.(city.id)}
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
              return (
              <div
                key={day.id}
                className="w-full"
                onMouseEnter={() => {
                  onDayEnter?.(day.id);
                  onCityEnter?.(city.id);
                }}
              >
                {(() => {
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
                        onOptimizeRoute={() => {
                          const newData = JSON.parse(JSON.stringify(localData));
                          newData.cities[cityIndex].days[dayIndex] = optResult.day;
                          updateData(newData);
                        }}
                      />
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

                      // Distance to next node: generation hint → server-resolved → haversine
                      let distPill = null;
                      if (nextItem) {
                        const transit = getTransit(item, nextItem, day.transitHints);
                        const dist = transit.distanceKm;
                        const mins = transit.durationMins;
                        if (dist > 0.3) {
                          const isDetour = dist > 12.0;
                          distPill = (
                            <div key={`dist-${item.id}-${nextItem.id}`} className="relative py-2 pl-[144px]">
                              <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
                              <div className="absolute bottom-1/2 left-[120px] top-0 w-[1.5px] bg-slate-200" />
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
                                  "ml-[-0.75rem] flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer backdrop-blur-xs shadow-2xs",
                                  isDetour
                                    ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-450 animate-pulse"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                )}
                                title={isDetour ? "⚠️ Geographically suboptimal transit leg. Click to book transport." : "Click to book a taxi/cab for this transit"}
                              >
                                <span>{isDetour ? "⚠️" : "🚘"}</span>
                                <span>{isDetour ? `Detour: ${dist} km` : `${dist} km`}</span>
                                <span className="text-slate-400">•</span>
                                <span>~{mins} mins transit</span>
                              </button>
                            </div>
                          );
                        }
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
                        return (
                          <React.Fragment key={item.id}>
                            <TransportNode
                              item={item}
                              isLast={isVeryLastItem}
                              onClick={() => onItemClick?.(clickPayload)}
                              onRemove={() => handleRemove(item.id)}
                              onHover={(hovered) => onItemHover?.(hovered ? item : null)}
                              onVerifyLivePrice={onVerifyLivePrice}
                              onWatchPrice={onWatchPrice}
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
                          />
                          {distPill}
                        </React.Fragment>
                      );
                    })}

                    {day.items.filter(item => !item.isInactive).length === 0 && (
                      <div className="relative py-4 pl-[70px] pr-4">
                        <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
                        <button
                          type="button"
                          onClick={() => {
                            onItemClick?.({
                              nodeId: `add-activity-${day.id}`,
                              nodeType: 'activity',
                              nodeTitle: `Add Spot to Day ${day.dayNumber}`,
                              dayId: day.id,
                              dayNumber: day.dayNumber,
                              dayLabel: `Day ${day.dayNumber}`,
                              cityId: city.id,
                              cityName: city.cityName,
                              dateStr: day.dateStr,
                              subtitle: `Exploring ${city.cityName}`,
                              startTime: '09:00 AM',
                            });
                          }}
                          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200/80 bg-white/40 p-4 text-xs font-bold text-slate-500 hover:bg-slate-55 hover:border-slate-300 hover:text-slate-700 transition-all cursor-pointer shadow-2xs export-hidden"
                        >
                          <Plus size={14} /> Add Spot to Day {day.dayNumber}
                        </button>
                      </div>
                    )}

                    {day.items.filter(item => !item.isInactive).length > 0 && (
                      <div className="relative py-4 pl-[144px]">
                        <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
                        <div className="absolute bottom-1/2 left-[120px] top-0 w-[1.5px] bg-slate-200" />
                        <div className="ml-[-1rem] flex justify-start">
                          <button
                            type="button"
                            onClick={() => {
                              onItemClick?.({
                                nodeId: `add-activity-${day.id}`,
                                nodeType: 'activity',
                                nodeTitle: `Add Activity to Day ${day.dayNumber}`,
                                dayId: day.id,
                                dayNumber: day.dayNumber,
                                dayLabel: `Day ${day.dayNumber}`,
                                cityId: city.id,
                                  cityName: city.cityName,
                                  dateStr: day.dateStr,
                                  subtitle: `Exploring ${city.cityName}`,
                                  startTime: '09:00 AM',
                                });
                              }}
                              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 cursor-pointer export-hidden"
                            >
                              <Plus size={14} /> Add Activity
                            </button>
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
