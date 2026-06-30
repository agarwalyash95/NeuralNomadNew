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
          {/* Drag Handle on the left outside the main box */}
          <div 
            {...attributes} 
            {...listeners}
            className="absolute -left-6 top-1/2 -translate-y-1/2 cursor-grab text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-500"
          >
            <GripVertical size={16} />
          </div>

          <div
            onClick={onClick}
            className="grid cursor-pointer gap-3 rounded-[16px] border border-indigo-100 bg-[linear-gradient(180deg,#f9f8ff_0%,#eef2ff_100%)] p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md lg:grid-cols-[1.3fr_auto]"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-500">Flight</p>
              <h4 className="mt-1 text-sm font-semibold text-slate-900">{item.title}</h4>
              <p className="mt-0.5 text-xs text-slate-600">{item.subtitle}</p>
              {item.aiTip ? <p className="mt-1 text-xs font-medium text-emerald-700">{item.aiTip}</p> : null}
            </div>
            <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-end">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{item.price}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">{item.status}</p>
              </div>
              <button className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-800">
                <MoreVertical size={14} />
              </button>
            </div>
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
