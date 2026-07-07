import React, { useState, useEffect } from 'react';
import { MockTripData, ItineraryItem } from './mockData';
import CityHeaderNode from './nodes/CityHeaderNode';
import DayHeaderNode from './nodes/DayHeaderNode';
import TransportNode from './nodes/TransportNode';
import GenericNode from './nodes/GenericNode';
import TransitNode from './nodes/TransitNode';
import DeletingNode from './nodes/DeletingNode';
import { Plus } from 'lucide-react';
import { NodeClickPayload } from '../types';
import { calculateHaversineDistanceKm, estimateTransitMins, optimizeDayRoute } from './utils/routeOptimizer';

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
}

/** Transport types — use TransportNode (departure/arrival layout) */
const TRANSPORT_TYPES = new Set(['flight', 'train', 'bus', 'cab']);

export default function ItineraryTimeline({
  data,
  onItemClick,
  onItemHover,
  onCityEnter,
  onDayEnter,
  onDataChange
}: ItineraryTimelineProps) {
  const [localData, setLocalData] = useState<MockTripData>(data);
  const [collapsedCities, setCollapsedCities] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeInfo = findDayAndCity(active.id);
    const overInfo = findDayAndCity(over.id);

    if (!activeInfo || !overInfo) return;
    if (activeInfo.cityIndex !== overInfo.cityIndex) return;

    if (activeInfo.dayIndex !== overInfo.dayIndex) {
      setLocalData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        const activeItem = newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items.splice(activeInfo.itemIndex, 1)[0];

        if (overInfo.isDay) {
          newData.cities[overInfo.cityIndex].days[overInfo.dayIndex].items.push(activeItem);
        } else {
          newData.cities[overInfo.cityIndex].days[overInfo.dayIndex].items.splice(overInfo.itemIndex, 0, activeItem);
        }
        onDataChange?.(newData);
        return newData;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeInfo = findDayAndCity(active.id);
    const overInfo = findDayAndCity(over.id);

    if (!activeInfo || !overInfo) return;
    if (activeInfo.cityIndex !== overInfo.cityIndex) return;

    if (activeInfo.dayIndex === overInfo.dayIndex && activeInfo.itemIndex !== overInfo.itemIndex) {
      setLocalData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        const dayItems = newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items;
        newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items = arrayMove(dayItems, activeInfo.itemIndex, overInfo.itemIndex);
        onDataChange?.(newData);
        return newData;
      });
    }
  };

  // Safe ID-based soft removal with 5s countdown
  const handleRemove = (itemId: string) => {
    setLocalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      for (const city of newData.cities) {
        for (const day of city.days) {
          const item = day.items.find((i: any) => i.id === itemId);
          if (item) {
            item.isDeleting = true;
            break;
          }
        }
      }
      onDataChange?.(newData);
      return newData;
    });
  };

  const handleUndo = (itemId: string) => {
    setLocalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      for (const city of newData.cities) {
        for (const day of city.days) {
          const item = day.items.find((i: any) => i.id === itemId);
          if (item) {
            delete item.isDeleting;
            break;
          }
        }
      }
      onDataChange?.(newData);
      return newData;
    });
  };

  const handlePermanentRemove = (itemId: string) => {
    setLocalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
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
      onDataChange?.(newData);
      return newData;
    });
  };

  // Transit soft removal with 5s countdown
  const handleRemoveTransit = (cityId: string) => {
    setLocalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const city = newData.cities.find((c: any) => c.id === cityId);
      if (city?.transitToNext) {
        city.transitToNext.isDeleting = true;
      }
      onDataChange?.(newData);
      return newData;
    });
  };

  const handleUndoTransit = (cityId: string) => {
    setLocalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const city = newData.cities.find((c: any) => c.id === cityId);
      if (city?.transitToNext) {
        delete city.transitToNext.isDeleting;
      }
      onDataChange?.(newData);
      return newData;
    });
  };

  const handlePermanentRemoveTransit = (cityId: string) => {
    setLocalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const city = newData.cities.find((c: any) => c.id === cityId);
      if (city?.transitToNext) {
        city.transitToNext.isInactive = true;
        delete city.transitToNext.isDeleting;
      }
      onDataChange?.(newData);
      return newData;
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="pb-10">
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
                <div id={`day-${day.dayNumber}`}>
                  <DayHeaderNode
                    day={day}
                    isCollapsed={isDayCollapsed}
                    onToggle={() => toggleDay(day.id)}
                    onOptimizeRoute={() => {
                      const optResult = optimizeDayRoute(day);
                      setLocalData(prev => {
                        const newData = JSON.parse(JSON.stringify(prev));
                        newData.cities[cityIndex].days[dayIndex] = optResult.day;
                        onDataChange?.(newData);
                        return newData;
                      });
                    }}
                  />
                </div>

                {!isDayCollapsed && (
                <SortableContext id={day.id} items={day.items.filter(i => !i.isInactive).map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col">
                    {day.items.filter(item => !item.isInactive).map((item, itemIndex, activeItems) => {
                      const isLastItemInDay = itemIndex === activeItems.length - 1;
                      const isVeryLastItem = isLastItemInDay && dayIndex === city.days.length - 1 && !city.transitToNext && cityIndex === localData.cities.length - 1;
                      const nextItem = activeItems[itemIndex + 1];

                      // Distance calculation to next node
                      let distPill = null;
                      if (nextItem) {
                        const dist = calculateHaversineDistanceKm(item.latitude, item.longitude, nextItem.latitude, nextItem.longitude, item, nextItem);
                        const mins = estimateTransitMins(dist);
                        if (dist > 0.3) {
                          distPill = (
                            <div key={`dist-${item.id}-${nextItem.id}`} className="relative py-2 pl-[144px]">
                              <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
                              <div className="absolute bottom-1/2 left-[120px] top-0 w-[1.5px] bg-slate-200" />
                              <div className="ml-[-0.75rem] flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-100/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 shadow-2xs backdrop-blur-xs">
                                <span>🚘</span>
                                <span>{dist} km</span>
                                <span className="text-slate-400">•</span>
                                <span>~{mins} mins transit</span>
                              </div>
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
                          />
                          {distPill}
                        </React.Fragment>
                      );
                    })}

                    <div className="relative py-4 pl-[144px]">
                      <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
                      <div className="absolute bottom-1/2 left-[120px] top-0 w-[1.5px] bg-slate-200" />
                      <div className="ml-[-1rem] flex justify-start">
                        <button className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 cursor-pointer">
                          <Plus size={14} /> Add Activity
                        </button>
                      </div>
                    </div>
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
