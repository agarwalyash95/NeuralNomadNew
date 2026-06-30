import React, { useState } from 'react';
import { mockTripData } from './mockData';
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
  onItemClick?: (type: string) => void;
}

export default function ItineraryTimeline({ onItemClick }: ItineraryTimelineProps) {
  const [data, setData] = useState(mockTripData);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findDayAndCity = (id: string | number) => {
    for (let c = 0; c < data.cities.length; c++) {
      for (let d = 0; d < data.cities[c].days.length; d++) {
        const day = data.cities[c].days[d];
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
    // Disallow cross-city dragging
    if (activeInfo.cityIndex !== overInfo.cityIndex) return;

    // Moving between different days in the same city
    if (activeInfo.dayIndex !== overInfo.dayIndex) {
      setData(prev => {
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

    // Moving within the same day
    if (activeInfo.dayIndex === overInfo.dayIndex && activeInfo.itemIndex !== overInfo.itemIndex) {
      setData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        const dayItems = newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items;
        newData.cities[activeInfo.cityIndex].days[activeInfo.dayIndex].items = arrayMove(dayItems, activeInfo.itemIndex, overInfo.itemIndex);
        return newData;
      });
    }
  };

  const handleRemove = (cityIndex: number, dayIndex: number, itemIndex: number) => {
    setData(prev => {
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
        {data.cities.map((city, cityIndex) => (
          <React.Fragment key={city.id}>
            <CityHeaderNode city={city} />

            {city.days.map((day, dayIndex) => (
              <React.Fragment key={day.id}>
                <DayHeaderNode day={day} />

                <SortableContext id={day.id} items={day.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col">
                    {day.items.map((item, itemIndex) => {
                      const isLastItemInDay = itemIndex === day.items.length - 1;
                      
                      // For the last day of a city, and the last item of that day,
                      // if there's no transit to the next city, the timeline stops here.
                      const isVeryLastItem = isLastItemInDay && dayIndex === city.days.length - 1 && !city.transitToNext && cityIndex === data.cities.length - 1;

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

                    {/* Add Activity Button at the end of the day */}
                    <div className="relative py-1.5 pl-24 md:pl-28">
                      <div className="absolute bottom-0 left-[81px] top-0 w-px bg-[#ddd7ca] md:left-[89px]" />
                      <div className="ml-[-0.5rem] flex justify-center">
                        <button className="flex items-center gap-1.5 rounded-lg border border-[#ddd7ca] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-[#c8c1b3] hover:bg-[#faf8f2]">
                          <Plus size={14} /> Add Activity
                        </button>
                      </div>
                    </div>
                  </div>
                </SortableContext>
              </React.Fragment>
            ))}

            {/* Inter-city Transit */}
            {city.transitToNext && (
              <TransitNode item={city.transitToNext} onClick={() => onItemClick?.(city.transitToNext!.type)} />
            )}
          </React.Fragment>
        ))}
      </div>
    </DndContext>
  );
}
