## Dependency Tree

PlannerShell
↓
WorkspacePanel
↓
PlanCanvas
├── CityChapter
├── JourneySection
├── DayHeader
├── PreparationChecklist
└── RichCards (HotelCard, FlightCard, etc.)
    └── TimelineCard

## Support Files
- canvas.registry.ts
- planner.store.ts
- use-planner.ts
- planner.service.ts
- planner.types.ts

### PlanCanvas.tsx
src\features\planner\canvas\plan\PlanCanvas.tsx

`	sx
'use client';

import React, { useMemo, useState } from 'react';
import { Share2, Sun, DollarSign, Clock, MapPin, Search } from 'lucide-react';
import { usePlan, useContext } from '@/hooks/use-planner';
import { formatCurrency } from '@/lib/utils';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { safe } from '@/lib/safe';
import type { TripCity, TripDay, TripActivity } from '@/services/planner.types';

// New Components
import { CityChapter } from './components/CityChapter';
import { JourneySection } from './components/JourneySection';
import { DayHeader } from './components/DayHeader';
import { PreparationChecklist } from './components/PreparationChecklist';
import { HotelCard, FlightCard, RestaurantCard, AttractionCard, StandardActivityCard } from './components/RichCards';

export default function PlanCanvas({ workspaceId }: { workspaceId: string }) {
  const { data: plan } = usePlan(workspaceId);
  const { data: context } = useContext(workspaceId);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const totalBudget = plan?.total_budget || context?.budget || 0;

  const groupedData = useMemo(() => {
    if (!plan || !plan.days) return [];
    const cities = plan.cities || [];
    const days = plan.days || [];
    
    if (cities.length === 0) {
      return [{
        city: { id: '1', name: context?.destination_location || 'Destination', country: '' } as TripCity,
        days: days
      }];
    }

    let dayIndex = 0;
    return cities.map(city => {
      const cityDays = days.slice(dayIndex, dayIndex + city.nights);
      dayIndex += city.nights;
      return { city, days: cityDays };
    });
  }, [plan, context]);

  // Mock Preparation Data
  const prepItems = [
    { id: 'p1', title: 'Apply for Japan eVisa', isCompleted: true, type: 'visa' },
    { id: 'p2', title: 'Order Suica Cards', isCompleted: false, type: 'general' },
    { id: 'p3', title: 'Exchange 50,000 JPY', isCompleted: false, type: 'forex' },
    { id: 'p4', title: 'Book Airport Transfer', isCompleted: true, type: 'transport' },
  ];

  return (
    <DndContext collisionDetection={closestCenter}>
      <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0a]">
        
        {/* ─── Header ─── */}
        <header className="flex-shrink-0 px-8 pt-8 pb-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 z-20 sticky top-0">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span className="text-2xl">🌍</span> 
                {safe(plan?.title || context?.destination_location || 'Living Itinerary')}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5">
                <span>{plan?.days?.length || 0} Days</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span>{formatCurrency(totalBudget)} Budget</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span>{plan?.cities?.length || 1} Cities</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Search size={16} />
              </button>
              <button className="p-2.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Scrollable Workspace (The Document) ─── */}
        <div 
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 custom-scrollbar"
          onClick={() => setSelectedItemId(null)} // Click outside clears selection
        >
          <div className="max-w-3xl mx-auto pb-32 relative">
            
            {/* 1. Preparation (Outside the Timeline) */}
            <PreparationChecklist items={prepItems} />

            {/* 2. The Continuous Timeline Container */}
            <div className="relative w-full">
              
              {/* 
                THE BACKBONE
                This single line spans from the top to the bottom of the itinerary.
                It is absolutely positioned on the left side (left: 40px).
              */}
              <div className="absolute left-[39px] top-4 bottom-12 w-[2px] bg-slate-200 dark:bg-slate-800 rounded-full" />

              <SortableContext items={groupedData.map(g => g.city.id)} strategy={verticalListSortingStrategy}>
                {groupedData.map((group, gIdx) => (
                  <React.Fragment key={group.city.id}>
                    {/* A. Expandable City Chapter */}
                    <CityChapter
                      id={group.city.id}
                      name={group.city.name}
                      nights={group.city.nights}
                      dates={group.city.arrival_date ? `${group.city.arrival_date} - ${group.city.departure_date}` : ''}
                    >
                      <SortableContext items={group.days.map(d => d.id)} strategy={verticalListSortingStrategy}>
                        {group.days.map((day) => (
                          <div key={day.id} className="mb-10">
                            {/* B. Light Day Heading */}
                            <DayHeader 
                              dayNumber={day.day_number}
                              date={day.date || ''}
                              title={day.title}
                            />

                            {/* C. Activities attached to the timeline */}
                            <SortableContext items={(day.activities || []).map(a => a.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-0">
                                {day.activities?.map((activity) => {
                                  
                                  const isSelected = selectedItemId === activity.id;
                                  const handleSelect = (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    setSelectedItemId(activity.id);
                                  };

                                  if (activity.category === 'flight') return <FlightCard key={activity.id} activity={activity} isSelected={isSelected} onSelect={() => setSelectedItemId(activity.id)} />;
                                  if (activity.category === 'hotel') return <HotelCard key={activity.id} activity={activity} isSelected={isSelected} onSelect={() => setSelectedItemId(activity.id)} />;
                                  if (activity.category === 'restaurant') return <RestaurantCard key={activity.id} activity={activity} isSelected={isSelected} onSelect={() => setSelectedItemId(activity.id)} />;
                                  if (activity.category === 'attraction') return <AttractionCard key={activity.id} activity={activity} isSelected={isSelected} onSelect={() => setSelectedItemId(activity.id)} />;
                                  
                                  return <StandardActivityCard key={activity.id} activity={activity} isSelected={isSelected} onSelect={() => setSelectedItemId(activity.id)} />;
                                })}
                              </div>
                            </SortableContext>
                          </div>
                        ))}
                      </SortableContext>
                    </CityChapter>

                    {/* D. Journey Section (Inter-City Connector) */}
                    {gIdx < groupedData.length - 1 && (
                      <JourneySection
                        id={`journey-${group.city.id}`}
                        fromCity={group.city.name}
                        toCity={groupedData[gIdx + 1].city.name}
                        mode="train"
                        duration="2h 15m"
                        distance="513 km"
                        aiTips={[
                          'Sit on the right side (Seat E) for Mt. Fuji views!',
                          'Buy a Bento box at Tokyo Station before boarding.'
                        ]}
                        weatherTransition={{ fromTemp: '22°C', toTemp: '18°C' }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </SortableContext>

              {/* End of Journey Node */}
              <div className="relative mt-8 group flex items-center">
                <div className="absolute left-[39px] -translate-x-1/2 w-4 h-4 rounded-full bg-slate-900 dark:bg-white border-4 border-white dark:border-slate-950 z-10" />
                <div className="ml-[80px]">
                   <h3 className="text-sm font-bold text-slate-900 dark:text-white">End of Journey</h3>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

`

### CityChapter.tsx
src\features\planner\canvas\plan\components\CityChapter.tsx

`	sx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safe } from '@/lib/safe';

interface CityChapterProps {
  id: string;
  name: string;
  nights: number;
  dates: string;
  children: React.ReactNode;
}

export function CityChapter({ id, name, nights, dates, children }: CityChapterProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative w-full mb-12">
      {/* Chapter Header */}
      <div 
        className="relative group flex items-center cursor-pointer py-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* The Timeline line starts below the city header, but the header itself intercepts it */}
        {/* We'll assume the parent `PlanCanvas` draws a full height line that this sits over */}
        
        <div className="absolute left-[39px] -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 z-10 shadow-sm transition-transform group-hover:scale-110">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        <div className="ml-[80px] flex-1 flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {safe(name)}
            </h2>
            <span className="text-sm font-bold text-slate-400">
              {nights} Nights • {safe(dates)}
            </span>
          </div>
          
          <div className={`transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreVertical size={16} className="text-slate-400" />
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative Chapter Separator */}
      <div className="ml-[80px] mr-4 h-px bg-slate-200 dark:bg-slate-800 mb-8" />

      {/* Chapter Content (Days & Activities) */}
      <div className={`transition-all duration-300 origin-top ${isExpanded ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 h-0 overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
}

`

### DayHeader.tsx
src\features\planner\canvas\plan\components\DayHeader.tsx

`	sx
import React, { useState } from 'react';
import { MoreVertical, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safe } from '@/lib/safe';

interface DayHeaderProps {
  dayNumber: number;
  date: string;
  title?: string;
  isDraggable?: boolean;
}

export function DayHeader({ dayNumber, date, title, isDraggable = true }: DayHeaderProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative flex items-center mb-8 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Day Node on the timeline */}
      <div className="absolute left-[39px] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 z-10 border-2 border-white dark:border-slate-950" />

      {/* Light Document Heading */}
      <div className="ml-[80px] flex-1 flex items-center gap-4">
        
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Day {dayNumber}
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {safe(date)}
            </span>
          </div>
          {title && (
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {safe(title)}
            </span>
          )}
        </div>

        {/* Separator Line extending right */}
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />

        {/* Workspace Actions */}
        <div className={`flex items-center gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          {isDraggable && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 cursor-grab">
              <GripVertical size={14} />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
            <MoreVertical size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

`

### JourneySection.tsx
src\features\planner\canvas\plan\components\JourneySection.tsx

`	sx
import React, { useState } from 'react';
import { Train, Plane, Car, ArrowRight, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safe } from '@/lib/safe';

interface JourneySectionProps {
  id: string;
  fromCity: string;
  toCity: string;
  mode: 'train' | 'flight' | 'cab' | 'bus';
  duration: string;
  distance: string;
  aiTips?: string[];
  weatherTransition?: {
    fromTemp: string;
    toTemp: string;
  };
}

export function JourneySection({ 
  id, 
  fromCity, 
  toCity, 
  mode, 
  duration, 
  distance,
  aiTips,
  weatherTransition 
}: JourneySectionProps) {
  const [isHovered, setIsHovered] = useState(false);

  const ModeIcon = mode === 'flight' ? Plane : mode === 'train' ? Train : Car;

  return (
    <div 
      className="relative w-full mb-12 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Journey Timeline Node */}
      <div className="absolute left-[39px] top-6 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 z-10 border-2 border-white dark:border-slate-950">
        <ModeIcon size={14} />
      </div>

      <div className="ml-[80px] pt-4 pr-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">
            <span>{safe(fromCity)}</span>
            <ArrowRight size={16} className="text-slate-400" />
            <span>{safe(toCity)}</span>
          </div>
          
          <div className={`transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <Button variant="ghost" size="icon">
              <MoreVertical size={16} className="text-slate-400" />
            </Button>
          </div>
        </div>

        {/* Journey Details Card */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row gap-6">
          
          {/* Main Stats */}
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize mb-1">
              {mode} Journey
            </h3>
            <p className="text-sm font-medium text-slate-500 mb-4">
              {duration} • {distance}
            </p>
            
            {weatherTransition && (
              <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>{weatherTransition.fromTemp}</span>
                <ArrowRight size={12} className="text-slate-400" />
                <span>{weatherTransition.toTemp}</span>
              </div>
            )}
          </div>

          {/* AI Tips */}
          {aiTips && aiTips.length > 0 && (
            <div className="flex-1 md:border-l md:border-slate-200 dark:md:border-slate-800 md:pl-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-500">✨</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Journey Intelligence</span>
              </div>
              <ul className="space-y-2">
                {aiTips.map((tip, idx) => (
                  <li key={idx} className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    {safe(tip)}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

`

### PreparationChecklist.tsx
src\features\planner\canvas\plan\components\PreparationChecklist.tsx

`	sx
import React, { useState } from 'react';
import { CheckCircle2, Circle, MoreVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safe } from '@/lib/safe';

interface ChecklistItem {
  id: string;
  title: string;
  isCompleted: boolean;
  type: string;
}

interface PreparationChecklistProps {
  items: ChecklistItem[];
}

export function PreparationChecklist({ items }: PreparationChecklistProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="w-full mb-16 relative">
      {/* 
        Notice: There is NO timeline line running through here.
        This sits completely outside the main timeline.
      */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" /> Pre-Journey Checklist
        </h2>
        <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-500">
          <Plus size={14} className="mr-1" /> Add Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => (
          <div 
            key={item.id}
            className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="flex items-center gap-3">
              {item.isCompleted ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
              ) : (
                <Circle size={18} className="text-slate-300 dark:text-slate-700" />
              )}
              <span className={`text-sm font-bold ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                {safe(item.title)}
              </span>
            </div>
            
            <div className={`transition-opacity ${hoveredId === item.id ? 'opacity-100' : 'opacity-0'}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                <MoreVertical size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

`

### RichCards.tsx
src\features\planner\canvas\plan\components\RichCards.tsx

`	sx
import React from 'react';
import { TimelineCard, CardTitle, CardSubtitle, CardImage, CardBody } from './TimelineCard';
import { Plane, Utensils, MapPin, Landmark, Clock, Activity, Sparkles, Hotel } from 'lucide-react';
import type { TripActivity } from '@/services/planner.types';
import { safe } from '@/lib/safe';

function AIChip({ icon, text, type = 'default' }: { icon: string, text: string, type?: 'default' | 'warning' | 'tip' | 'weather' }) {
  const colors = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    warning: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    tip: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    weather: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${colors[type]}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </span>
  );
}

interface BaseCardProps {
  activity: TripActivity;
  isSelected?: boolean;
  onSelect?: () => void;
  isDraggable?: boolean;
}

export function HotelCard({ activity, isSelected, onSelect, isDraggable }: BaseCardProps) {
  const image = activity.metadata?.images?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80';
  const price = activity.estimated_cost ? `$${activity.estimated_cost}` : '₹12,500/night';
  const personality = activity.notes || "Elegant stay with panoramic views.";
  const area = activity.location_name?.split(',')[0] || 'City Center';

  const node = (
    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-950 flex items-center justify-center text-slate-500">
      <Hotel size={10} />
    </div>
  );

  return (
    <TimelineCard 
      id={activity.id} 
      category="hotel" 
      isSelected={isSelected} 
      onSelect={onSelect}
      isDraggable={isDraggable}
      timelineNode={node}
      className="p-0" // The child handles padding
    >
      <CardImage src={image} alt={activity.title} />
      <CardBody className="p-4">
        <div className="flex justify-between items-start mb-1">
          <CardTitle>{activity.title}</CardTitle>
          <span className="text-xs font-bold text-slate-900 dark:text-white shrink-0 ml-2">{price}</span>
        </div>
        <CardSubtitle className="mb-2 flex items-center gap-2">
          <span className="text-amber-500">★ 4.8</span>
          <span>•</span>
          <span className="flex items-center gap-0.5"><MapPin size={10} /> {area}</span>
        </CardSubtitle>
        
        <p className="text-[11px] text-slate-600 dark:text-slate-400 italic line-clamp-1 border-l-2 border-indigo-200 dark:border-indigo-800 pl-2 mb-3">
          "{personality}"
        </p>

        {/* Progressive Disclosure details - visible if selected or we can always show small chips */}
        <div className="flex gap-2 mt-auto">
          <AIChip icon="🕒" text={`Check-in: ${activity.start_time || '15:00'}`} />
          {activity.metadata?.ai_tip && (
            <AIChip icon="💡" text={activity.metadata.ai_tip} type="tip" />
          )}
        </div>
      </CardBody>
    </TimelineCard>
  );
}

export function FlightCard({ activity, isSelected, onSelect, isDraggable }: BaseCardProps) {
  const node = (
    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 border-2 border-white dark:border-slate-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
      <Plane size={12} />
    </div>
  );

  return (
    <TimelineCard 
      id={activity.id} 
      category="flight"
      isSelected={isSelected} 
      onSelect={onSelect}
      isDraggable={isDraggable}
      timelineNode={node}
    >
      <CardBody className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              ✈️
            </div>
            <div>
              <CardTitle>{activity.title}</CardTitle>
              <CardSubtitle>{safe(activity.notes) || 'Economy'}</CardSubtitle>
            </div>
          </div>
          {activity.estimated_cost && (
             <span className="text-[11px] font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
               ${activity.estimated_cost}
             </span>
          )}
        </div>

        <div className="flex items-center justify-between px-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{activity.start_time || '10:00'}</h3>
            <p className="text-[10px] font-bold text-slate-500">{activity.location_name?.split(' to ')[0] || 'DEP'}</p>
          </div>
          
          <div className="flex-1 flex flex-col items-center px-4 relative">
             <div className="w-full h-px bg-slate-200 dark:bg-slate-700 relative">
                <Plane size={12} className="text-blue-500 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 bg-slate-50 dark:bg-slate-900/50 px-1" />
             </div>
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{activity.end_time || '14:20'}</h3>
            <p className="text-[10px] font-bold text-slate-500">{activity.location_name?.split(' to ')[1] || 'ARR'}</p>
          </div>
        </div>
      </CardBody>
    </TimelineCard>
  );
}

export function RestaurantCard({ activity, isSelected, onSelect, isDraggable }: BaseCardProps) {
  const image = activity.metadata?.images?.[0] || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80';
  
  const node = (
    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-950 flex items-center justify-center text-slate-500">
      <Utensils size={10} />
    </div>
  );

  return (
    <TimelineCard 
      id={activity.id} 
      category="restaurant"
      isSelected={isSelected} 
      onSelect={onSelect}
      isDraggable={isDraggable}
      timelineNode={node}
    >
      <div className="flex w-full p-3 gap-4">
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
          <img src={image} alt="Restaurant" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex justify-between items-start mb-1">
             <CardTitle>{activity.title}</CardTitle>
             {activity.start_time && (
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md shrink-0">
                  {activity.start_time}
                </span>
             )}
          </div>
          <CardSubtitle className="flex items-center gap-1 mb-2">
            <Utensils size={10} /> Japanese • {activity.estimated_cost ? `$${activity.estimated_cost}` : '$$'}
          </CardSubtitle>
          
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 px-2 py-0.5 rounded-full">
              Must try: {activity.notes || "Signature Dish"}
            </span>
            {activity.metadata?.ai_tip && (
               <AIChip icon="💡" text={activity.metadata.ai_tip} type="tip" />
            )}
          </div>
        </div>
      </div>
    </TimelineCard>
  );
}

export function AttractionCard({ activity, isSelected, onSelect, isDraggable }: BaseCardProps) {
  const image = activity.metadata?.images?.[0] || 'https://images.unsplash.com/photo-1542931287-023b922fa89b?w=800&q=80';
  
  const node = (
    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-950 flex items-center justify-center text-slate-500">
      <Landmark size={10} />
    </div>
  );

  return (
    <TimelineCard 
      id={activity.id} 
      category="attraction"
      isSelected={isSelected} 
      onSelect={onSelect}
      isDraggable={isDraggable}
      timelineNode={node}
      className="p-0"
    >
      <div className="flex flex-col w-full">
        {/* Large Image Header if Selected, otherwise small thumbnail? Progressive disclosure!
            Let's use a nice banner if selected, otherwise standard. But for now, we'll use a consistent wide banner.
        */}
        <div className={`w-full relative transition-all duration-300 ${isSelected ? 'h-40' : 'h-24'}`}>
          <img src={image} className="w-full h-full object-cover" alt={activity.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
            <div>
              <CardTitle className="text-white">{activity.title}</CardTitle>
            </div>
            {activity.estimated_cost && (
              <span className="text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg">
                ${activity.estimated_cost}
              </span>
            )}
          </div>
        </div>
        
        <div className="p-3">
          <div className="flex flex-wrap gap-2 mb-2">
            <AIChip icon="⏳" text={`Est. ${activity.duration_minutes || 120}m`} />
            {activity.metadata?.ai_tip && (
               <AIChip icon="💡" text={activity.metadata.ai_tip} type="tip" />
            )}
          </div>
          <CardSubtitle className="line-clamp-2">
            {activity.notes || "Iconic cultural landmark."}
          </CardSubtitle>
        </div>
      </div>
    </TimelineCard>
  );
}

export function StandardActivityCard({ activity, isSelected, onSelect, isDraggable }: BaseCardProps) {
  const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    activity: <Activity size={10} />,
    note: <Sparkles size={10} />,
    general: <MapPin size={10} />,
  };

  const node = (
    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-950 flex items-center justify-center text-slate-500">
      {CATEGORY_ICONS[activity.category] || <MapPin size={10} />}
    </div>
  );

  return (
    <TimelineCard 
      id={activity.id} 
      category={activity.category}
      isSelected={isSelected} 
      onSelect={onSelect}
      isDraggable={isDraggable}
      timelineNode={node}
    >
      <div className="flex items-center gap-4 p-4 w-full">
        <div className="flex-1 min-w-0">
          <CardTitle>{activity.title}</CardTitle>
          {activity.location_name && (
             <CardSubtitle className="mt-0.5">{activity.location_name}</CardSubtitle>
          )}
          {activity.notes && isSelected && (
             <p className="text-xs text-slate-500 mt-2">{activity.notes}</p>
          )}
        </div>
      </div>
    </TimelineCard>
  );
}

`

### TimelineCard.tsx
src\features\planner\canvas\plan\components\TimelineCard.tsx

`	sx
import React, { useState } from 'react';
import { MoreVertical, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { safe } from '@/lib/safe';

interface TimelineCardProps {
  id: string;
  category: string;
  isDraggable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
  className?: string;
  timelineNode?: React.ReactNode; // The dot or icon that sits on the timeline
  isLast?: boolean; // Controls whether to show the line segment if we are doing segmented lines, though we might use a continuous line.
}

export function TimelineCard({
  id,
  category,
  isDraggable = true,
  isSelected = false,
  onSelect,
  children,
  className,
  timelineNode,
}: TimelineCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative group flex items-start mb-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      {/* 
        The Timeline Axis
        We assume a continuous line is drawn in the parent container.
        Here we only place the dot/icon exactly at left-10 (40px)
      */}
      {timelineNode && (
        <div className="absolute left-[39px] top-4 -translate-x-1/2 -translate-y-1/2 z-10">
          {timelineNode}
        </div>
      )}

      {/* The Card Container - strict grid starting at ml-[80px] */}
      <div 
        className={cn(
          "ml-[80px] flex-1 relative rounded-2xl border transition-all duration-200 overflow-hidden",
          "bg-white dark:bg-slate-900 shadow-sm",
          isSelected 
            ? "border-indigo-500 ring-1 ring-indigo-500 shadow-md"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
          className
        )}
      >
        {/* Hover / Select Controls Layer */}
        {(isHovered || isSelected) && (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isDraggable && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing">
                <GripVertical size={16} />
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>Add Note</DropdownMenuItem>
                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Move to Day...</DropdownMenuItem>
                <DropdownMenuItem>Move to City...</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500 focus:text-red-600">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Inner Content */}
        <div className="flex flex-col sm:flex-row h-full">
          {children}
        </div>
      </div>
    </div>
  );
}

// Subcomponents for consistent typography
export function CardTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <h4 className={cn("text-base font-bold text-slate-900 dark:text-white leading-tight", className)}>
      {children}
    </h4>
  );
}

export function CardSubtitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={cn("text-sm text-slate-500 font-medium", className)}>
      {children}
    </p>
  );
}

export function CardImage({ src, alt, className }: { src: string, alt: string, className?: string }) {
  return (
    <div className={cn("w-full sm:w-[140px] h-[120px] sm:h-auto flex-shrink-0 relative overflow-hidden", className)}>
      <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("p-4 flex-1 min-w-0 flex flex-col justify-center", className)}>
      {children}
    </div>
  );
}

`

### PlannerShell.tsx
src\features\planner\layout\PlannerShell.tsx

`	sx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import PlannerSidebar from './PlannerSidebar';
import ChatPanel from './ChatPanel';
import WorkspacePanel from './WorkspacePanel';
import PlannerHomepage from './PlannerHomepage';
import BookingWorkspace from '../booking/BookingWorkspace';
import { PanelLeftClose, PanelLeft, MessageSquare, MessageSquareOff } from 'lucide-react';
import { ScenarioSwitcher } from '../components/ScenarioSwitcher';

export default function PlannerShell() {
  const {
    isSidebarOpen,
    isChatOpen,
    toggleSidebar,
    toggleChat,
    activeWorkspaceId,
    showHomepage,
    isBooking,
  } = usePlannerStore();

  return (
    <div className="flex h-full w-full overflow-hidden relative bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      
      {/* ─── Dedicated Booking Workspace ─────── */}
      <AnimatePresence>
        {isBooking && activeWorkspaceId && (
          <BookingWorkspace key="booking" workspaceId={activeWorkspaceId} />
        )}
      </AnimatePresence>
      
      {/* ─── Global Floating Toggle Buttons ─── */}
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute top-4 left-4 z-[100] flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl"
          title="Open sidebar"
        >
          <PanelLeft size={20} />
        </button>
      )}

      {activeWorkspaceId && !isChatOpen && (
        <button
          onClick={toggleChat}
          className="absolute top-4 right-4 z-[100] flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl"
          title="Open chat"
        >
          <MessageSquare size={20} />
        </button>
      )}
      {/* ─── Sidebar ─────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 200, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0 border-r border-slate-200/60 dark:border-slate-800/60 overflow-hidden"
          >
            <PlannerSidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Area ───────────────────────────── */}
      <div className="flex flex-1 min-w-0 relative">

        {/* ─── Show Homepage or Workspace ─────── */}
        {showHomepage || !activeWorkspaceId ? (
          <div className="flex-1">
            <PlannerHomepage />
          </div>
        ) : (
          <>
            {/* ─── Chat Panel ──────────────── */}
            <AnimatePresence mode="wait">
              {isChatOpen && (
                <motion.div
                  key="chat"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 340, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="flex-shrink-0 border-r border-slate-200/40 dark:border-slate-800/40 overflow-hidden"
                >
                  <ChatPanel workspaceId={activeWorkspaceId} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Workspace Panel ──────────── */}
            <motion.div
              className="flex-1 min-w-0"
              layout
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <WorkspacePanel workspaceId={activeWorkspaceId} />
            </motion.div>
          </>
        )}
      </div>
      
      {/* ─── Developer Controls ────────────────── */}
      <ScenarioSwitcher />
    </div>
  );
}

`

### WorkspacePanel.tsx
src\features\planner\layout\WorkspacePanel.tsx

`	sx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import PlanCanvas from '@/features/planner/canvas/plan/PlanCanvas';
import CanvasLayoutEngine from '@/features/planner/canvas/CanvasLayoutEngine';

interface WorkspacePanelProps {
  workspaceId: string;
}

export default function WorkspacePanel({ workspaceId }: WorkspacePanelProps) {
  const activeCanvases = usePlannerStore((s) => s.activeCanvases);

  // Filter out plan canvas (it's always primary)
  const executionCanvases = activeCanvases.filter((c) => c.type !== 'plan');
  const hasExecutionCanvas = executionCanvases.length > 0;

  return (
    <div className="flex h-full">
      {/* ─── Plan Canvas (always primary) ──── */}
      <motion.div
        className={`overflow-hidden ${hasExecutionCanvas ? 'w-1/2 border-r border-slate-200/40 dark:border-slate-800/40' : 'w-full'}`}
        layout
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <PlanCanvas workspaceId={workspaceId} />
      </motion.div>

      {/* ─── Execution Canvas (split view) ─── */}
      <AnimatePresence mode="wait">
        {hasExecutionCanvas && (
          <motion.div
            key="execution"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '50%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <CanvasLayoutEngine
              workspaceId={workspaceId}
              canvases={executionCanvases}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

`

### canvas.registry.ts
src\features\planner\canvas\canvas.registry.ts

`	sx
/**
 * Canvas plugin registry — lazy-loaded components.
 * Future canvases register here without touching the engine.
 */

import { lazy } from 'react';
import type { CanvasType } from '@/services/planner.types';

export interface CanvasDefinition {
  type: CanvasType;
  label: string;
  icon: string;
  component: React.LazyExoticComponent<React.ComponentType<{ workspaceId: string }>>;
  searchable: boolean;
  referenceTable?: string;
}

export const canvasRegistry: Record<string, CanvasDefinition> = {
  flight: {
    type: 'flight',
    label: 'Flights',
    icon: 'Plane',
    component: lazy(() => import('./flight/FlightCanvas')),
    searchable: true,
    referenceTable: 'airport_routes',
  },
  hotel: {
    type: 'hotel',
    label: 'Hotels',
    icon: 'Hotel',
    component: lazy(() => import('./hotel/HotelCanvas')),
    searchable: true,
    referenceTable: 'hotel_master',
  },
  train: {
    type: 'train',
    label: 'Trains',
    icon: 'TrainFront',
    component: lazy(() => import('./train/TrainCanvas')),
    searchable: true,
    referenceTable: 'train_routes',
  },
  bus: {
    type: 'bus',
    label: 'Buses',
    icon: 'Bus',
    component: lazy(() => import('./bus/BusCanvas')),
    searchable: true,
    referenceTable: 'bus_routes',
  },
  cab: {
    type: 'cab',
    label: 'Cabs',
    icon: 'Car',
    component: lazy(() => import('./cab/CabCanvas')),
    searchable: true,
  },
  attraction: {
    type: 'attraction',
    label: 'Attractions',
    icon: 'Landmark',
    component: lazy(() => import('./attraction/AttractionCanvas')),
    searchable: true,
    referenceTable: 'attraction_master',
  },
  activity: {
    type: 'activity',
    label: 'Activities',
    icon: 'Activity',
    component: lazy(() => import('./activity/ActivityCanvas')),
    searchable: true,
    referenceTable: 'activity_master',
  },
  restaurant: {
    type: 'restaurant',
    label: 'Restaurants',
    icon: 'UtensilsCrossed',
    component: lazy(() => import('./restaurant/RestaurantCanvas')),
    searchable: true,
    referenceTable: 'restaurant_master',
  },
  visa: {
    type: 'visa',
    label: 'Visa',
    icon: 'FileCheck',
    component: lazy(() => import('./visa/VisaCanvas')),
    searchable: false,
    referenceTable: 'visa_requirement',
  },
  forex: {
    type: 'forex',
    label: 'Forex',
    icon: 'Coins',
    component: lazy(() => import('./forex/ForexCanvas')),
    searchable: false,
  },
  booking: {
    type: 'booking',
    label: 'Booking',
    icon: 'ShoppingCart',
    component: lazy(() => import('./booking/BookingCanvas')),
    searchable: false,
  },
};

export function registerCanvas(definition: CanvasDefinition) {
  canvasRegistry[definition.type] = definition;
}

`

### planner.store.ts
src\features\planner\store\planner.store.ts

`	sx
/**
 * Planner Zustand store — UI chrome only.
 *
 * Manages panel visibility, active workspace, active canvases,
 * and chat UI state. Server state lives in React Query.
 */

import { create } from 'zustand';
import type { CanvasType, CanvasLifecycleState } from '@/services/planner.types';

interface ActiveCanvas {
  type: CanvasType;
  state: CanvasLifecycleState;
}

interface PlannerStore {
  // ─── Active Workspace ────────────────────────────
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;

  // ─── Panel Visibility ────────────────────────────
  isSidebarOpen: boolean;
  isChatOpen: boolean;
  toggleSidebar: () => void;
  toggleChat: () => void;
  setSidebarOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;

  // ─── Canvas Management ───────────────────────────
  activeCanvases: ActiveCanvas[];
  openCanvas: (type: CanvasType, state?: CanvasLifecycleState) => void;
  closeCanvas: (type: CanvasType) => void;
  setCanvasState: (type: CanvasType, state: CanvasLifecycleState) => void;
  focusCanvas: (type: CanvasType) => void;

  // ─── Chat State ──────────────────────────────────
  isSending: boolean;
  setIsSending: (v: boolean) => void;

  // ─── Homepage State ──────────────────────────────
  showHomepage: boolean;
  setShowHomepage: (v: boolean) => void;

  // ─── Booking State ───────────────────────────────
  isBooking: boolean;
  setIsBooking: (v: boolean) => void;
}

export const usePlannerStore = create<PlannerStore>()((set) => ({
  // Active workspace
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id, showHomepage: !id }),

  // Panels
  isSidebarOpen: true,
  isChatOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setChatOpen: (open) => set({ isChatOpen: open }),

  // Canvas management
  activeCanvases: [],

  openCanvas: (type, state = 'expanded') =>
    set((s) => {
      const exists = s.activeCanvases.find((c) => c.type === type);
      if (exists) {
        return {
          activeCanvases: s.activeCanvases.map((c) =>
            c.type === type ? { ...c, state } : c
          ),
        };
      }
      return { activeCanvases: [...s.activeCanvases, { type, state }] };
    }),

  closeCanvas: (type) =>
    set((s) => ({
      activeCanvases: s.activeCanvases.filter((c) => c.type !== type),
    })),

  setCanvasState: (type, state) =>
    set((s) => ({
      activeCanvases: s.activeCanvases.map((c) =>
        c.type === type ? { ...c, state } : c
      ),
    })),

  focusCanvas: (type) =>
    set((s) => ({
      activeCanvases: s.activeCanvases.map((c) =>
        c.type === type ? { ...c, state: 'focused' as const } : c
      ),
    })),

  // Chat
  isSending: false,
  setIsSending: (v) => set({ isSending: v }),

  // Homepage
  showHomepage: true,
  setShowHomepage: (v) => set({ showHomepage: v }),

  // Booking
  isBooking: false,
  setIsBooking: (v) => set({ isBooking: v }),
}));

`

### use-planner.ts
src\hooks\use-planner.ts

`	sx
/**
 * usePlanner — React Query hooks for planner server state.
 *
 * All data fetching and mutations live here.
 * The Zustand store (planner.store.ts) manages only UI chrome.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plannerService } from '@/services/planner.service';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import type { ChatResponse, PlannerWorkspace } from '@/services/planner.types';

// ─── Query Keys ─────────────────────────────────────

const keys = {
  workspaces: ['planner', 'workspaces'] as const,
  workspace: (id: string) => ['planner', 'workspace', id] as const,
  messages: (id: string) => ['planner', 'messages', id] as const,
  plan: (id: string) => ['planner', 'plan', id] as const,
  context: (id: string) => ['planner', 'context', id] as const,
  recommendations: (id: string) => ['planner', 'recommendations', id] as const,
  canvases: (id: string) => ['planner', 'canvases', id] as const,
  cart: (id: string) => ['planner', 'cart', id] as const,
};

// ─── Workspaces ─────────────────────────────────────

export function useWorkspaces() {
  return useQuery({
    queryKey: keys.workspaces,
    queryFn: plannerService.listWorkspaces,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const setActiveWorkspaceId = usePlannerStore((s) => s.setActiveWorkspaceId);

  return useMutation({
    mutationFn: (title?: string) => plannerService.createWorkspace(title),
    onSuccess: (workspace: PlannerWorkspace) => {
      qc.invalidateQueries({ queryKey: keys.workspaces });
      setActiveWorkspaceId(workspace.id);
    },
  });
}

// ─── Chat ───────────────────────────────────────────

export function useMessages(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.messages(workspaceId ?? ''),
    queryFn: () => plannerService.listMessages(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useSendMessage(workspaceId: string | null) {
  const qc = useQueryClient();
  const setIsSending = usePlannerStore((s) => s.setIsSending);

  return useMutation({
    mutationFn: (message: string) => {
      setIsSending(true);
      return plannerService.sendMessage(workspaceId!, message);
    },
    onSuccess: (_data: ChatResponse) => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: keys.messages(workspaceId) });
        qc.invalidateQueries({ queryKey: keys.plan(workspaceId) });
        qc.invalidateQueries({ queryKey: keys.context(workspaceId) });
        qc.invalidateQueries({ queryKey: keys.recommendations(workspaceId) });
      }
    },
    onSettled: () => {
      setIsSending(false);
    },
  });
}

// ─── Plan ───────────────────────────────────────────

export function usePlan(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.plan(workspaceId ?? ''),
    queryFn: () => plannerService.getPlan(workspaceId!),
    enabled: !!workspaceId,
  });
}

// ─── Context ────────────────────────────────────────

export function useContext(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.context(workspaceId ?? ''),
    queryFn: () => plannerService.getContext(workspaceId!),
    enabled: !!workspaceId,
  });
}

// ─── Recommendations ────────────────────────────────

export function useRecommendations(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.recommendations(workspaceId ?? ''),
    queryFn: () => plannerService.getRecommendations(workspaceId!),
    enabled: !!workspaceId,
  });
}

// ─── Cart ───────────────────────────────────────────

export function useCart(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.cart(workspaceId ?? ''),
    queryFn: () => plannerService.listCart(workspaceId!),
    enabled: !!workspaceId,
  });
}

`

### planner.service.ts
src\services\planner.service.ts

`	sx
/**
 * Planner API service — all REST calls for the planner workspace.
 * Uses the existing ApiClient with JWT auth.
 */

import { apiClient } from './api';
import type {
  PlannerWorkspace,
  PlannerMemory,
  WorkspaceContext,
  ChatMessage,
  ChatResponse,
  PlannerTrip,
  Recommendation,
  CanvasInstance,
  BookingOrder,
  SavedPlace,
  PaginatedResponse,
} from './planner.types';

const BASE = '/planner/workspaces';

export const plannerService = {
  // ─── Workspaces ────────────────────────────────────

  listWorkspaces: () =>
    apiClient.get<PlannerWorkspace[]>(`${BASE}/`),

  createWorkspace: (title: string = 'New Trip') =>
    apiClient.post<PlannerWorkspace>(`${BASE}/`, { title }),

  getWorkspace: (id: string) =>
    apiClient.get<PlannerWorkspace>(`${BASE}/${id}/`),

  updateWorkspace: (id: string, data: Partial<PlannerWorkspace>) =>
    apiClient.patch<PlannerWorkspace>(`${BASE}/${id}/`, data),

  deleteWorkspace: (id: string) =>
    apiClient.delete(`${BASE}/${id}/`),

  getWorkspaceSummary: (id: string) =>
    apiClient.get<Record<string, unknown>>(`${BASE}/${id}/summary/`),

  // ─── Memory ────────────────────────────────────────

  getMemory: (workspaceId: string) =>
    apiClient.get<PlannerMemory>(`${BASE}/${workspaceId}/memory/`),

  updateMemory: (workspaceId: string, data: Partial<PlannerMemory>) =>
    apiClient.patch<PlannerMemory>(`${BASE}/${workspaceId}/memory/`, data),

  // ─── Context ───────────────────────────────────────

  getContext: (workspaceId: string) =>
    apiClient.get<WorkspaceContext>(`${BASE}/${workspaceId}/context/`),

  updateContext: (workspaceId: string, data: Partial<WorkspaceContext>) =>
    apiClient.patch<WorkspaceContext>(`${BASE}/${workspaceId}/context/`, data),

  // ─── Chat ──────────────────────────────────────────

  listMessages: (workspaceId: string) =>
    apiClient.get<ChatMessage[]>(`${BASE}/${workspaceId}/chat/`),

  sendMessage: (workspaceId: string, message: string) =>
    apiClient.post<ChatResponse>(`${BASE}/${workspaceId}/chat/`, { message }),

  // ─── Plan ──────────────────────────────────────────

  getPlan: (workspaceId: string) => {
    if (typeof window !== 'undefined') {
      const mockScenario = localStorage.getItem('DEV_mockScenario');
      if (mockScenario && mockScenario !== 'none') {
        return apiClient.get<PlannerTrip>(`/planner/debug/scenario/${mockScenario}/`);
      }
    }
    return apiClient.get<PlannerTrip>(`${BASE}/${workspaceId}/plan/`);
  },

  updatePlan: (workspaceId: string, data: Partial<PlannerTrip>) =>
    apiClient.patch<PlannerTrip>(`${BASE}/${workspaceId}/plan/`, data),

  // ─── Recommendations ──────────────────────────────

  getRecommendations: (workspaceId: string) =>
    apiClient.get<Recommendation[]>(`${BASE}/${workspaceId}/recommendations/`),

  // ─── Canvases ──────────────────────────────────────

  listCanvases: (workspaceId: string) =>
    apiClient.get<CanvasInstance[]>(`${BASE}/${workspaceId}/canvases/`),

  createCanvas: (workspaceId: string, data: Partial<CanvasInstance>) =>
    apiClient.post<CanvasInstance>(`${BASE}/${workspaceId}/canvases/`, data),

  // ─── Cart ──────────────────────────────────────────

  listCart: (workspaceId: string) =>
    apiClient.get<BookingOrder[]>(`${BASE}/${workspaceId}/cart/`),

  addToCart: (workspaceId: string, data: Partial<BookingOrder>) =>
    apiClient.post<BookingOrder>(`${BASE}/${workspaceId}/cart/`, data),

  // ─── Saved Places ─────────────────────────────────

  listPlaces: (workspaceId: string) =>
    apiClient.get<SavedPlace[]>(`${BASE}/${workspaceId}/places/`),

  savePlace: (workspaceId: string, data: Partial<SavedPlace>) =>
    apiClient.post<SavedPlace>(`${BASE}/${workspaceId}/places/`, data),
};

`

### planner.types.ts
src\services\planner.types.ts

`	sx
/**
 * Planner type definitions — all TypeScript types for the planner feature.
 * These map directly to the backend models and API responses.
 */

// ─── Enums & Constants ─────────────────────────────

export type WorkspaceStatus = 'draft' | 'active' | 'completed' | 'archived' | 'booked';
export type WorkspaceMode = 'planning' | 'exploring' | 'booking' | 'review' | 'traveling' | 'completed';
export type ChatRole = 'user' | 'assistant' | 'system';
export type CanvasType = 'plan' | 'flight' | 'hotel' | 'train' | 'bus' | 'cab' | 'attraction' | 'activity' | 'restaurant' | 'visa' | 'forex' | 'booking';
export type CanvasLifecycleState = 'preview' | 'expanded' | 'focused';
export type DayType = 'preparation' | 'travel' | 'exploration' | 'return' | 'rest';
export type ActivityStatus = 'planned' | 'booked' | 'completed' | 'cancelled';

// ─── Workspace ─────────────────────────────────────

export interface PlannerWorkspace {
  id: string;
  title: string;
  status: WorkspaceStatus;
  mode: WorkspaceMode;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  chat_count: number;
  active_canvases: CanvasType[];
}

// ─── Memory ────────────────────────────────────────

export interface PlannerMemory {
  destination: Record<string, string>;
  origin: Record<string, string>;
  dates: Record<string, string>;
  travelers: Record<string, number>;
  budget: Record<string, string | number>;
  transportation_preference: string[];
  hotel_preference: Record<string, unknown>;
  interests: string[];
  food_preference: Record<string, string>;
  accessibility: Record<string, unknown>;
  visa_status: Record<string, string>;
  booking_summary: Record<string, number>;
  current_phase: string;
  conversation_summary: string;
  last_ai_action: Record<string, unknown>;
}

// ─── Context ───────────────────────────────────────

export interface WorkspaceContext {
  origin_location: string;
  destination_location: string;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  budget: number | null;
  budget_currency: string;
  travel_style: string;
  interests: string[];
  metadata: Record<string, unknown>;
}

// ─── Chat ──────────────────────────────────────────

export interface WidgetData {
  type: string;
  data: Record<string, unknown>;
}

export interface CommandData {
  type: string;
  payload: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  message: string;
  widgets: WidgetData[];
  commands: CommandData[];
  created_at: string;
}

export interface ChatResponse {
  user_message: {
    id: string;
    role: 'user';
    message: string;
    created_at: string;
  };
  assistant_message: {
    id: string;
    role: 'assistant';
    message: string;
    widgets: WidgetData[];
    commands: CommandData[];
    created_at: string;
  };
  command_results: Array<{
    type: string;
    status: string;
    result?: Record<string, unknown>;
    error?: string;
  }>;
}

// ─── Trip / Plan ───────────────────────────────────

export interface TripActivity {
  id: string;
  title: string;
  category: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  distance_km: number | null;
  travel_time_minutes: number | null;
  transport_mode: string;
  estimated_cost: number;
  currency_code: string;
  status: ActivityStatus;
  order: number;
  notes: string;
  weather_info: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface TripDay {
  id: string;
  day_number: number;
  date: string | null;
  title: string;
  day_type: DayType;
  activities: TripActivity[];
}

export interface TripCity {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  order: number;
  nights: number;
  arrival_date: string | null;
  departure_date: string | null;
}

export interface PlannerTrip {
  id: string;
  title: string;
  summary: string;
  total_budget: number;
  spent_budget: number;
  currency_code: string;
  metadata: Record<string, unknown>;
  cities: TripCity[];
  days: TripDay[];
}

// ─── Recommendation ────────────────────────────────

export interface Recommendation {
  id: string;
  type: string;
  canvas_type: CanvasType;
  title: string;
  description: string;
  confidence: number;
  priority: number;
  reason: string;
  estimated_cost: number | null;
  estimated_time: number | null;
  impact: string;
  dependencies: string[];
  actions: Array<{
    label: string;
    command_type: string;
    payload: Record<string, unknown>;
  }>;
  data: Record<string, unknown>;
  is_dismissed: boolean;
  is_accepted: boolean;
}

// ─── Canvas ────────────────────────────────────────

export interface CanvasInstance {
  id: string;
  canvas_type: CanvasType;
  lifecycle_state: CanvasLifecycleState;
  is_active: boolean;
  display_order: number;
}

// ─── Booking / Cart ────────────────────────────────

export interface BookingOrder {
  id: string;
  item_type: string;
  source_canvas: string;
  title: string;
  provider: string;
  price: number;
  currency_code: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Saved Places ──────────────────────────────────

export interface SavedPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Reference Data ────────────────────────────────

export interface Country {
  id: string;
  name: string;
  iso_code: string;
  currency_code: string;
  continent: string;
}

export interface City {
  id: string;
  name: string;
  state_name?: string;
  country_name?: string;
  latitude: number;
  longitude: number;
  is_major: boolean;
}

export interface Airport {
  id: string;
  iata_code: string;
  name: string;
  display_name: string;
  city_name?: string;
  is_international: boolean;
}

export interface TrainStation {
  id: string;
  code: string;
  name: string;
  city_name?: string;
  station_type: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

// ─── Paginated Response ────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Canvas Color Theme ────────────────────────────

export const CANVAS_COLORS: Record<CanvasType, { accent: string; bg: string; text: string }> = {
  plan:       { accent: 'hsl(200, 80%, 55%)', bg: 'hsl(200, 80%, 97%)', text: 'hsl(200, 80%, 25%)' },
  flight:     { accent: 'hsl(220, 75%, 50%)', bg: 'hsl(220, 75%, 97%)', text: 'hsl(220, 75%, 25%)' },
  hotel:      { accent: 'hsl(280, 60%, 55%)', bg: 'hsl(280, 60%, 97%)', text: 'hsl(280, 60%, 25%)' },
  train:      { accent: 'hsl(25, 85%, 50%)',  bg: 'hsl(25, 85%, 97%)',  text: 'hsl(25, 85%, 25%)' },
  bus:        { accent: 'hsl(40, 90%, 50%)',  bg: 'hsl(40, 90%, 97%)',  text: 'hsl(40, 90%, 25%)' },
  cab:        { accent: 'hsl(150, 60%, 40%)', bg: 'hsl(150, 60%, 97%)', text: 'hsl(150, 60%, 20%)' },
  attraction: { accent: 'hsl(15, 80%, 55%)',  bg: 'hsl(15, 80%, 97%)',  text: 'hsl(15, 80%, 25%)' },
  activity:   { accent: 'hsl(175, 60%, 40%)', bg: 'hsl(175, 60%, 97%)', text: 'hsl(175, 60%, 20%)' },
  restaurant: { accent: 'hsl(340, 65%, 55%)', bg: 'hsl(340, 65%, 97%)', text: 'hsl(340, 65%, 25%)' },
  visa:       { accent: 'hsl(245, 60%, 50%)', bg: 'hsl(245, 60%, 97%)', text: 'hsl(245, 60%, 25%)' },
  forex:      { accent: 'hsl(160, 55%, 45%)', bg: 'hsl(160, 55%, 97%)', text: 'hsl(160, 55%, 20%)' },
  booking:    { accent: 'hsl(250, 70%, 55%)', bg: 'hsl(250, 70%, 97%)', text: 'hsl(250, 70%, 25%)' },
};

export const CANVAS_ICONS: Record<CanvasType, string> = {
  plan: 'Map',
  flight: 'Plane',
  hotel: 'Hotel',
  train: 'TrainFront',
  bus: 'Bus',
  cab: 'Car',
  attraction: 'Landmark',
  activity: 'Activity',
  restaurant: 'UtensilsCrossed',
  visa: 'FileCheck',
  forex: 'Coins',
  booking: 'ShoppingCart',
};

`

