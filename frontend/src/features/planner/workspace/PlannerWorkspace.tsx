'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FlightCanvas, HotelCanvas, TrainCanvas, BusCanvas, CabCanvas } from './helpers/booking/canvas';
import { AttractionsCanvas } from './helpers/attractions/canvas';
import { ForexCanvas, VisaCanvas } from './helpers/travel-prep/canvas';

type ContextPanelType = 'none' | 'flight' | 'hotel' | 'train' | 'bus' | 'cab' | 'attractions' | 'forex' | 'visa';

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
              if (type === 'visa') {
                setActivePanel('visa');
              } else if (type === 'forex') {
                setActivePanel('forex');
              }
            }}
          />
          <ItineraryTimeline
            onItemClick={(type) => {
              switch (type) {
                case 'flight':
                  setActivePanel('flight');
                  break;
                case 'hotel':
                  setActivePanel('hotel');
                  break;
                case 'train':
                  setActivePanel('train');
                  break;
                case 'bus':
                  setActivePanel('bus');
                  break;
                case 'taxi':
                case 'cab':
                  setActivePanel('cab');
                  break;
                case 'activity':
                case 'food':
                  setActivePanel('attractions');
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
