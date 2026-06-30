'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import BookingHelper from './BookingHelper';
import AttractionsHelper from './AttractionsHelper';
import TravelPrepHelper from './TravelPrepHelper';

type ContextPanelType = 'none' | 'flights' | 'hotels' | 'activities' | 'prep' | 'trains' | 'cabs';

import PlannerHeader from './canvas/PlannerHeader';
import PreJourneyChecklist from './canvas/PreJourneyChecklist';
import ItineraryTimeline from './canvas/ItineraryTimeline';

export default function PlannerWorkspace() {
  const [activePanel, setActivePanel] = useState<ContextPanelType>('none');
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    try {
      // Temporarily expand height to ensure everything is captured
      const originalHeight = exportRef.current.style.height;
      exportRef.current.style.height = 'max-content';

      const canvas = await html2canvas(exportRef.current, {
        scale: 2, // 2x resolution for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#fbfaf7', // Match the container background
      });

      // Restore original height
      exportRef.current.style.height = originalHeight;

      const imgData = canvas.toDataURL('image/png');
      
      // Create a single continuous PDF page matching the exact canvas dimensions
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

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#f6f4ef]">
      <div className="custom-scrollbar relative h-full flex-1 overflow-y-auto border-r border-[#e2ddd2] bg-[#fbfaf7]">
        <div className="mx-auto max-w-5xl px-2 py-2 lg:px-4" ref={exportRef}>
          <PlannerHeader onExport={handleExport} isExporting={isExporting} />
          <PreJourneyChecklist
            onChecklistClick={(type) => {
              if (type === 'visa' || type === 'forex') {
                setActivePanel('prep');
              }
            }}
          />
          <ItineraryTimeline
            onItemClick={(type) => {
              switch (type) {
                case 'flight':
                  setActivePanel('flights');
                  break;
                case 'hotel':
                  setActivePanel('hotels');
                  break;
                case 'train':
                  setActivePanel('trains');
                  break;
                case 'taxi':
                case 'cab':
                  setActivePanel('cabs');
                  break;
                case 'activity':
                case 'food':
                  setActivePanel('activities');
                  break;
                case 'bus':
                  setActivePanel('trains');
                  break;
              }
            }}
          />
        </div>
      </div>

      <AnimatePresence>
        {activePanel !== 'none' && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 440, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[#e2ddd2] bg-[#f7f4ed]"
          >
            <div className="flex h-full w-[440px] flex-col overflow-hidden">
              <div className="z-20 flex items-center justify-between border-b border-[#e2ddd2] bg-white/85 px-5 py-4 shadow-sm backdrop-blur-sm">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Context panel
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-800">
                    {activePanel === 'activities'
                      ? 'Explore'
                      : activePanel === 'prep'
                        ? 'Travel prep'
                        : 'Booking assistant'}
                  </h2>
                </div>
                <button
                  onClick={() => setActivePanel('none')}
                  className="rounded-full bg-[#f6f4ef] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition-colors hover:bg-[#ece7dc] hover:text-slate-900"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activePanel === 'flights' && <BookingHelper initialService="flight" />}
                {activePanel === 'hotels' && <BookingHelper initialService="hotel" />}
                {activePanel === 'trains' && <BookingHelper initialService="train" />}
                {activePanel === 'cabs' && <BookingHelper initialService="cab" />}
                {activePanel === 'activities' && <AttractionsHelper />}
                {activePanel === 'prep' && <TravelPrepHelper />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
