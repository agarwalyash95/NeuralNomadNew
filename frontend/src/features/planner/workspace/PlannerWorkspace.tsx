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
import { mockTripData, MockTripData, ItineraryCity, ItineraryDay, ItineraryItem } from './canvas/mockData';

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
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    
    // Polling mechanism in case plan is still generating
    const fetchPlan = async () => {
      try {
        const trip = await plannerService.getPlan(workspaceId);
        
        if (!isMounted) return;

        // Transform real data to our UI format
        const transformedData = transformTripData(trip);
        setPlanData(transformedData);
        setIsLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to fetch plan:', err);
        // Fallback to mock data for error
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

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#f6f4ef]">
      <div className="custom-scrollbar relative h-full flex-1 overflow-y-auto border-r border-[#e2ddd2] bg-[#fbfaf7]">
        <div className="mx-auto max-w-5xl px-2 py-2 lg:px-4" ref={exportRef}>
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

      <AnimatePresence>
        {activePanel !== 'none' && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 600, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[#e2ddd2]"
          >
            <div className="flex h-full w-[600px] flex-col overflow-hidden">
              {activePanel === 'flight' && <FlightCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'hotel' && <HotelCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'train' && <TrainCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'bus' && <BusCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'cab' && <CabCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'attractions' && <AttractionsCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'forex' && <ForexCanvas onClose={() => setActivePanel('none')} />}
              {activePanel === 'visa' && <VisaCanvas onClose={() => setActivePanel('none')} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Data Transformer
function transformTripData(trip: PlannerTrip): MockTripData {
  const travelers = (trip.metadata?.travelers as number) || 1;
  const stats = `${trip.days.length} days • ${trip.cities.length} locations • ${trip.currency_code} ${trip.total_budget} budget • ${travelers} travellers`;

  const cityMap = new Map<string, ItineraryCity>();
  
  trip.cities.forEach((city, index) => {
    cityMap.set(city.name, {
      id: city.id || `city-${index}`,
      cityName: city.name,
      nights: city.nights,
      dateRange: city.arrival_date ? `${city.arrival_date} to ${city.departure_date}` : '',
      weather: '20°C • Pleasant', // Mocked until weather API integration
      iconBgColor: index === 0 ? 'bg-indigo-500' : 'bg-emerald-500',
      icon: city.name.substring(0, 2).toUpperCase(),
      days: [],
    });
  });

  // Default grouping of days if they don't explicitly belong to a city
  let currentCityIndex = 0;
  
  trip.days.forEach((day, index) => {
    // Basic logic to split days evenly among cities for now if no specific date mapping
    const cityCount = trip.cities.length || 1;
    const daysPerCity = Math.ceil(trip.days.length / cityCount);
    currentCityIndex = Math.min(Math.floor(index / daysPerCity), trip.cities.length - 1);
    
    const cityGroup = trip.cities[currentCityIndex];
    const targetCity = cityMap.get(cityGroup?.name || '');
    
    if (targetCity) {
      const items: ItineraryItem[] = day.activities?.map(a => ({
        id: a.id,
        type: (a.category?.toLowerCase() || 'activity') as any,
        startTime: a.start_time || '',
        endTime: a.end_time || '',
        title: a.title,
        subtitle: a.location_name || '',
        price: a.estimated_cost ? `${a.currency_code} ${a.estimated_cost}` : undefined,
        status: a.status === 'booked' ? 'Confirmed' : 'Pending',
        details: a.notes,
      })) || [];

      targetCity.days.push({
        id: day.id || `day-${day.day_number}`,
        dayNumber: day.day_number,
        dateStr: day.date || `Day ${day.day_number}`,
        title: day.title || `Exploring ${targetCity.cityName}`,
        items: items,
      });
    }
  });

  return {
    title: trip.title || 'Your Generated Trip',
    stats: stats,
    checklist: [
      { id: 'hotels', label: 'Hotel Bookings', status: 'Pending', type: 'accommodation' },
      { id: 'transport', label: 'Local Transport', status: 'Pending', type: 'transport' },
      { id: 'cash', label: 'Travel Funds/Forex', status: 'Pending', type: 'forex' },
    ],
    cities: Array.from(cityMap.values()),
  };
}
