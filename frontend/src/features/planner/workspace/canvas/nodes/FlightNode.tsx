import React, { useState } from 'react';
import { MoreVertical, GripVertical, Repeat, Map, Edit3, Trash2 } from 'lucide-react';
import { ItineraryItem } from '../mockData';
import NodeWrapper from './NodeWrapper';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';

interface FlightNodeProps {
  item: ItineraryItem;
  isLast?: boolean;
  onClick?: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
}

export default function FlightNode({ item, isLast, onClick, onReplace, onRemove }: FlightNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <NodeWrapper type="flight" time={item.startTime} endTime={item.endTime} isLast={isLast}>
        <div 
          className="relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
          {...attributes}
          {...listeners}
          onClick={onClick}
          className="group flex cursor-pointer flex-col gap-4 rounded-[20px] border border-violet-200 bg-gradient-to-br from-violet-50/80 to-violet-100/40 p-4 px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md touch-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-violet-100 text-violet-600">
                <Plane size={16} fill="currentColor" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-violet-600">
                  {item.subtitle}
                </p>
                <h4 className="mt-0.5 text-lg font-bold text-slate-900 tracking-tight">{item.title}</h4>
              </div>
            </div>
            <button className="rounded-full p-2 text-violet-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/70 hover:text-violet-700">
              <MoreVertical size={18} />
            </button>
          </div>

          {/* Flight Details Box */}
          <div className="flex items-center justify-between rounded-xl bg-white/60 p-3 px-4 shadow-sm backdrop-blur-sm border border-white">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">DEL</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">20:30</p>
            </div>
            
            <div className="flex flex-1 flex-col items-center px-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">1h 30m</p>
              <div className="relative my-1.5 w-full border-t-[1.5px] border-dashed border-violet-200">
                <Plane 
                  size={14} 
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-400 bg-transparent" 
                />
              </div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Direct</p>
            </div>

            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">KUU</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">22:00</p>
            </div>
          </div>

          {/* Details Footer */}
          {item.details && (
             <div className="flex items-center gap-2">
                <div className="flex h-5 items-center rounded bg-emerald-100/80 px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {item.status}
                </div>
                <p className="text-[11px] font-medium text-slate-600">{item.details}</p>
             </div>
          )}
          
          {item.aiTip && (
             <p className="text-xs font-semibold text-violet-700 flex items-center gap-1.5 bg-violet-100/50 p-2 rounded-lg">
                <Plane size={12} className="text-violet-500" fill="currentColor"/> 
                {item.aiTip}
             </p>
          )} 
          </div>

          {/* Floating Action Bar on Hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.15 }}
                className="absolute left-1/2 -bottom-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 shadow-lg"
              >
                <button onClick={(e) => { e.stopPropagation(); onReplace?.(); }} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 transition-colors">
                  <Repeat size={12} /> Replace
                </button>
                <div className="w-px h-3 bg-indigo-400/50" />
                <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 transition-colors">
                  <Map size={12} /> Compare
                </button>
                <div className="w-px h-3 bg-indigo-400/50" />
                <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 transition-colors">
                  <Edit3 size={12} /> Notes
                </button>
                <div className="w-px h-3 bg-indigo-400/50" />
                <button onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 transition-colors">
                  <Trash2 size={12} /> Remove
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </NodeWrapper>
    </div>
  );
}
