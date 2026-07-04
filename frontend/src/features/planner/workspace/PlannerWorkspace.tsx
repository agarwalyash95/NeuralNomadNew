'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Loader2 } from 'lucide-react';
import { FlightCanvas, HotelCanvas, TrainCanvas, BusCanvas, CabCanvas } from './helpers/booking/canvas';
import { AttractionsCanvas } from './helpers/attractions/canvas';
import { ForexCanvas, VisaCanvas } from './helpers/travel-prep/canvas';
import { plannerService } from '@/services/planner.service';
import type { PlannerTrip } from '@/services/planner.types';
import { mockTripData, MockTripData, ItineraryCity, ItineraryItem } from './canvas/mockData';
import PlannerMap from './canvas/PlannerMap';
import AIInsightsPanel from './canvas/AIInsightsPanel';

type ContextPanelType = 'none' | 'flight' | 'hotel' | 'train' | 'bus' | 'cab' | 'attractions' | 'forex' | 'visa';

import PlannerHeader from './canvas/PlannerHeader';
import PreJourneyChecklist from './canvas/PreJourneyChecklist';
import ItineraryTimeline from './canvas/ItineraryTimeline';

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
  
  // Resizable split-screen state
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Synchronize initial active city and day
  useEffect(() => {
    if (planData?.cities?.[0]) {
      setActiveCityId(planData.cities[0].id);
      if (planData.cities[0].days?.[0]) {
        setFocusedDayId(planData.cities[0].days[0].id);
      }
    }
  }, [planData]);

  // Synchronize sidebar open/closed state
  useEffect(() => {
    const handleToggle = (e: Event) => {
      setIsSidebarOpen((e as CustomEvent).detail);
    };
    window.addEventListener('planner:toggle-sidebar', handleToggle);
    return () => window.removeEventListener('planner:toggle-sidebar', handleToggle);
  }, []);

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
      // Boundaries: 30% to 70% width
      if (newWidth >= 30 && newWidth <= 70) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    
    const fetchPlan = async () => {
      try {
        const trip = await plannerService.getPlan(workspaceId);
        
        if (!isMounted) return;

        const transformedData = transformTripData(trip);
        setPlanData(transformedData);
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

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    try {
      const originalHeight = exportRef.current.style.height;
      exportRef.current.style.height = 'max-content';

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fbfaf7',
      });

      exportRef.current.style.height = originalHeight;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
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

    try {
      // Reconstruct the days array for the backend API
      const backendDays = newData.cities.flatMap(city => 
        city.days.map(day => {
          const activities = day.items.map(item => {
            const raw = { ...(item._rawActivity || {}) };
            raw.is_active = !item.isInactive;
            raw.status = item.isInactive ? 'inactive' : (item.status === 'Confirmed' ? 'booked' : 'pending');
            return raw;
          });
          return {
            id: day.id,
            day_number: day.dayNumber,
            date: day.dateStr,
            title: day.title,
            city: city.cityName,
            activities: activities,
          };
        })
      );

      // Reconstruct the cities array for the backend API
      const backendCities = newData.cities.map(city => {
        let transit = null;
        if (city.transitToNext) {
          transit = {
            ...(city.transitToNext._rawActivity || {}),
            id: city.transitToNext.id,
            type: city.transitToNext.type,
            title: city.transitToNext.title,
            subtitle: city.transitToNext.subtitle,
            details: city.transitToNext.details,
            price: city.transitToNext.price,
            is_active: !city.transitToNext.isInactive,
            status: city.transitToNext.isInactive ? 'inactive' : 'booked',
          };
        }
        return {
          id: city.id,
          name: city.cityName,
          nights: city.nights,
          arrival_date: city.dateRange?.split(' to ')[0] || '',
          departure_date: city.dateRange?.split(' to ')[1] || '',
          transitToNext: transit,
        };
      });

      // Call the patched backend API to save state in background
      await plannerService.updatePlan(workspaceId, {
        days: backendDays as any,
        cities: backendCities as any,
      });
    } catch (err) {
      console.error('Failed to save updated plan to backend:', err);
    }
  };

  if (isLoading || !planData) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#f6f4ef]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-slate-500"
        >
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm font-medium tracking-wide uppercase">Generating your itinerary...</p>
        </motion.div>
      </div>
    );
  }

  const defaultItem = planData?.cities?.[0]?.days?.[0]?.items?.[0] || null;

  return (
    <div ref={containerRef} className="relative flex h-full w-full overflow-hidden bg-[#f6f4ef]">
      {/* Left Panel: Sticky Top Nav + Timeline & Checklist */}
      <div 
        className="custom-scrollbar relative h-full overflow-y-auto border-r border-[#e2ddd2] bg-[#fbfaf7] flex flex-col"
        style={{ width: `${leftWidth}%` }}
      >
        {/* Dynamic Sticky Top Navigation Bar (Days and Cities - Single Row Inline) */}
        <div className={`sticky top-0 z-50 flex w-full items-center border-b border-[#e2ddd2] bg-[#fbfaf7]/90 py-2 backdrop-blur-md shadow-xs ${
          isSidebarOpen ? 'px-4' : 'pl-20 pr-4'
        }`}>
          <div className="flex w-full items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {/* Cities First */}
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

            {/* Vertical Divider */}
            {planData.cities.length > 0 && (
              <div className="h-4 w-[1.5px] bg-slate-300/80 shrink-0 mx-1" />
            )}

            {/* Days Second */}
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
            onItemHover={(item) => {
              // Persistent hover state - only update if non-null
              if (item) setHoveredItem(item);
            }}
            onCityEnter={(cityId) => setActiveCityId(cityId)}
            onDayEnter={(dayId) => setFocusedDayId(dayId)}
            onDataChange={handlePlanDataChange}
            onItemClick={(type) => {
              switch (type) {
                case 'flight': setActivePanel('flight'); break;
                case 'hotel': setActivePanel('hotel'); break;
                case 'train': setActivePanel('train'); break;
                case 'bus': setActivePanel('bus'); break;
                case 'taxi': case 'cab': setActivePanel('cab'); break;
                case 'activity': case 'food': setActivePanel('attractions'); break;
              }
            }}
          />
        </div>
      </div>

      {/* Resizable Split-Screen Handle Bar (Claude-style) */}
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
              {/* Top half: Map Canvas (with day level focus zoom) */}
              <div className="h-[58%] w-full overflow-hidden border-b border-[#e2ddd2]">
                <PlannerMap 
                  planData={planData} 
                  hoveredItem={hoveredItem} 
                  focusedDayId={focusedDayId} 
                  onPinClick={(item) => setHoveredItem(item)}
                />
              </div>
              {/* Bottom half: Instant AI Insights */}
              <div className="h-[42%] w-full overflow-hidden">
                <AIInsightsPanel item={hoveredItem || defaultItem} />
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
              {activePanel === 'flight' && <FlightCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'hotel' && <HotelCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'train' && <TrainCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'bus' && <BusCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'cab' && <CabCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'attractions' && <AttractionsCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'forex' && <ForexCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'visa' && <VisaCanvas onClose={() => setActivePanel('none')} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Data Transformer - Dynamic Sequential City Grouping
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
    // Check day.city or fallback sequentially based on city nights sum
    let targetCityName = (day as any).city || (day as any).cityName;
    
    if (!targetCityName) {
      let nightSum = 0;
      let foundCityName = '';
      for (const city of trip.cities) {
        nightSum += city.nights;
        if (day.day_number <= nightSum) {
          foundCityName = city.name;
          break;
        }
      }
      targetCityName = foundCityName || trip.cities[trip.cities.length - 1]?.name || 'Itinerary';
    }

    let targetCity = cityMap.get(targetCityName);
    
    if (!targetCity) {
      const lowerName = targetCityName.toLowerCase();
      targetCity = Array.from(cityMap.values()).find(c => c.cityName.toLowerCase() === lowerName);
    }
    
    // Dynamic city creation so we never lose days
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
        latitude: a.latitude !== null && a.latitude !== undefined ? a.latitude : (metadata.latitude as number | undefined),
        longitude: a.longitude !== null && a.longitude !== undefined ? a.longitude : (metadata.longitude as number | undefined),
        aiTip: (a as any).aiTip || (a as any).ai_tip || (metadata.aiTip as string | undefined) || (metadata.ai_tip as string | undefined),
        rating: (a as any).rating || (metadata.rating as number | undefined),
        image: (a as any).image || (a as any).image_url || (a as any).imageUrl || (metadata.image as string | undefined) || (metadata.image_url as string | undefined) || (metadata.imageUrl as string | undefined),
        geoTag: (a as any).geoTag || (a as any).geo_tag || (metadata.geoTag as string | undefined) || (metadata.geo_tag as string | undefined) || targetCityName,
        isInactive: isInactive,
        _rawActivity: a,
      };
    }) || [];

    targetCity.days.push({
      id: day.id || `day-${day.day_number}`,
      dayNumber: day.day_number,
      dateStr: day.date || `Day ${day.day_number}`,
      title: day.title || `Exploring ${targetCity.cityName}`,
      items: items,
    });
  });

  return {
    title: trip.title || 'Your Generated Trip',
    stats: stats,
    checklist: [
      { id: 'hotels', label: 'Hotel Bookings', status: 'Pending', type: 'accommodation' },
      { id: 'transport', label: 'Local Transport', status: 'Pending', type: 'transport' },
      { id: 'cash', label: 'Travel Funds/Forex', status: 'Pending', type: 'forex' },
    ],
    cities: Array.from(cityMap.values()).filter(c => c.days.length > 0),
  };
}
