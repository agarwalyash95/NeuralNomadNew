import React, { useState, useEffect } from 'react';
import { MockTripData } from './mockData';
import CityHeaderNode from './nodes/CityHeaderNode';
import DayHeaderNode from './nodes/DayHeaderNode';
import FlightNode from './nodes/FlightNode';
import GenericNode from './nodes/GenericNode';
import TransitNode from './nodes/TransitNode';
import { Plus } from 'lucide-react';
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
  onItemClick?: (type: string) => void;
}

export default function ItineraryTimeline({ data, onItemClick }: ItineraryTimelineProps) {
  const [localData, setLocalData] = useState<MockTripData>(data);
  const [collapsedCities, setCollapsedCities] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalData(data);
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
      for (let d = 0; d < localData.cities[c].days.length; d++) {
        const day = localData.cities[c].days[d];
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
        return newData;
      });
    }
  };

  const handleRemove = (cityIndex: number, dayIndex: number, itemIndex: number) => {
    setLocalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData.cities[cityIndex].days[dayIndex].items.splice(itemIndex, 1);
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
          <React.Fragment key={city.id}>
            <CityHeaderNode 
              city={city} 
              isCollapsed={isCityCollapsed} 
              onToggle={() => toggleCity(city.id)} 
            />

            {!isCityCollapsed && city.days.map((day, dayIndex) => {
              const isDayCollapsed = !!collapsedDays[day.id];
              return (
              <React.Fragment key={day.id}>
                <DayHeaderNode 
                  day={day} 
                  isCollapsed={isDayCollapsed} 
                  onToggle={() => toggleDay(day.id)} 
                />

                {!isDayCollapsed && (
                <SortableContext id={day.id} items={day.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col">
                    {day.items.map((item, itemIndex) => {
                      const isLastItemInDay = itemIndex === day.items.length - 1;
                      
                      const isVeryLastItem = isLastItemInDay && dayIndex === city.days.length - 1 && !city.transitToNext && cityIndex === localData.cities.length - 1;

                      if (item.type === 'flight') {
                        return (
                          <FlightNode 
                            key={item.id} 
                            item={item} 
                            isLast={isVeryLastItem} 
                            onClick={() => onItemClick?.('flight')}
                            onReplace={() => onItemClick?.('helper')}
                            onRemove={() => handleRemove(cityIndex, dayIndex, itemIndex)}
                          />
                        );
                      } else {
                        return (
                          <GenericNode 
                            key={item.id} 
                            item={item} 
                            isLast={isVeryLastItem} 
                            onClick={() => onItemClick?.(item.type)} 
                            onReplace={() => onItemClick?.('helper')}
                            onRemove={() => handleRemove(cityIndex, dayIndex, itemIndex)}
                          />
                        );
                      }
                    })}

                    <div className="relative py-4 pl-[144px]">
                      <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
                      <div className="absolute bottom-1/2 left-[120px] top-0 w-[1.5px] bg-slate-200" />
                      <div className="ml-[-1rem] flex justify-start">
                        <button className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700">
                          <Plus size={14} /> Add Activity
                        </button>
                      </div>
                    </div>
                  </div>
                </SortableContext>
                )}
              </React.Fragment>
            )})}

            {!isCityCollapsed && city.transitToNext && (
              <TransitNode item={city.transitToNext} onClick={() => onItemClick?.(city.transitToNext!.type)} />
            )}
          </React.Fragment>
        )})}
      </div>
    </DndContext>
  );
}
