import React, { useState } from 'react';
import { Star, MapPin, Trash2 } from 'lucide-react';
import { ItineraryItem } from '../mockData';
import NodeWrapper from './NodeWrapper';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GenericNodeProps {
  item: ItineraryItem;
  isLast?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  onHover?: (isHovered: boolean) => void;
}

export default function GenericNode({ item, isLast, onClick, onRemove, onHover }: GenericNodeProps) {
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
          onMouseEnter={() => {
            setIsHovered(true);
            onHover?.(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
            onHover?.(false);
          }}
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
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between h-[80px] shrink-0">
              {item.price ? (
                <p className="text-sm font-bold text-slate-950">{item.price}</p>
              ) : <div />}
              
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                className="mt-auto rounded-xl bg-rose-50 p-2 text-rose-500 border border-rose-100/80 shadow-xs hover:bg-rose-100 hover:text-rose-600 active:scale-95 transition-all cursor-pointer"
                title="Delete Item"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
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
