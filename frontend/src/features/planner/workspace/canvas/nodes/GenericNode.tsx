import React, { useState } from 'react';
import { MoreVertical, GripVertical, Star, MapPin, Moon, Repeat, Map, Edit3, Trash2 } from 'lucide-react';
import { ItineraryItem } from '../mockData';
import NodeWrapper from './NodeWrapper';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';

interface GenericNodeProps {
  item: ItineraryItem;
  isLast?: boolean;
  onClick?: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
}

export default function GenericNode({ item, isLast, onClick, onReplace, onRemove }: GenericNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Derive gradient based on item type
  let gradientClass = 'bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200';
  let iconTint = 'text-slate-400';
  
  switch(item.type) {
    case 'hotel':
      gradientClass = isHovered ? 'bg-gradient-to-br from-indigo-50/80 to-indigo-100/60 border-indigo-200' : 'bg-gradient-to-br from-indigo-50/40 to-indigo-50/80 border-indigo-100';
      iconTint = 'text-indigo-400';
      break;
    case 'activity':
      gradientClass = isHovered ? 'bg-gradient-to-br from-emerald-50/80 to-emerald-100/60 border-emerald-200' : 'bg-gradient-to-br from-emerald-50/40 to-emerald-50/80 border-emerald-100';
      iconTint = 'text-emerald-400';
      break;
    case 'food':
      gradientClass = isHovered ? 'bg-gradient-to-br from-orange-50/80 to-orange-100/60 border-orange-200' : 'bg-gradient-to-br from-orange-50/40 to-orange-50/80 border-orange-100';
      iconTint = 'text-orange-400';
      break;
    case 'taxi':
      gradientClass = isHovered ? 'bg-gradient-to-br from-amber-50/80 to-amber-100/60 border-amber-200' : 'bg-gradient-to-br from-amber-50/40 to-amber-50/80 border-amber-100';
      iconTint = 'text-amber-400';
      break;
  }

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
      <NodeWrapper type={item.type} time={item.startTime} endTime={item.endTime} isLast={isLast}>
        <div 
          className="relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`flex cursor-pointer items-start justify-between gap-3 rounded-[16px] border ${gradientClass} px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md touch-none`}
          >
            <div className="flex min-w-0 gap-3">
              {item.image ? (
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl shadow-sm border border-white/50">
                  <Image src={item.image} alt={item.title} fill className="object-cover" />
                </div>
              ) : null}
              <div className="min-w-0 py-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-slate-900 tracking-tight">{item.title}</h4>
                    {item.rating && (
                      <div className="flex items-center text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} fill={i < item.rating! ? "currentColor" : "none"} className={i < item.rating! ? "" : "text-slate-300"} />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 font-medium">
                    {item.geoTag ? (
                      <span className="flex items-center gap-1"><MapPin size={12} className={iconTint} /> {item.geoTag}</span>
                    ) : null}
                    {item.geoTag && <span className="text-slate-300">•</span>}
                    <span>{item.subtitle}</span>
                  </div>
                  
                  {item.details ? <p className="mt-1.5 text-xs text-slate-500">{item.details}</p> : null}
                  {item.aiTip ? <p className="mt-1.5 text-xs font-semibold text-emerald-700 flex items-center gap-1"><Star size={10} className="text-emerald-500" fill="currentColor"/> {item.aiTip}</p> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between h-[80px]">
              <div className="flex items-center gap-2">
                {item.price ? (
                  <p className="text-sm font-semibold text-slate-900">{item.price}</p>
                ) : null}
                <button className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-[#faf8f2] hover:text-slate-800">
                  <MoreVertical size={16} />
                </button>
              </div>
              
              <div className="flex items-center gap-2 mt-auto">
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <MapPin size={14} />
                </button>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <Moon size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onReplace?.(); }}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
                >
                  <Repeat size={12} /> Replace
                </button>
              </div>
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

        {item.distanceToNext && (
          <div className="absolute -bottom-5 left-[71px] md:left-[79px] z-10 flex -translate-x-1/2 -translate-y-1/2 items-center bg-[#fbfaf7] py-1 px-1">
            <div className="rounded-full border border-[#ddd7ca] bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-500 shadow-sm">
              {item.distanceToNext}
            </div>
          </div>
        )}
      </NodeWrapper>
    </div>
  );
}
