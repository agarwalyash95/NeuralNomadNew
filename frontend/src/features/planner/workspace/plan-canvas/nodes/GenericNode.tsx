import React, { useState } from 'react';
import { Star, MapPin, Trash2, Compass, Zap, Utensils, BedDouble, Camera } from 'lucide-react';
import { ItineraryItem } from '../types';
import NodeWrapper from './NodeWrapper';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatConvertedPrice } from '../utils/routeOptimizer';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';

interface GenericNodeProps {
  item: ItineraryItem;
  isLast?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  onHover?: (isHovered: boolean) => void;
  onVerifyLivePrice?: (itemId: string) => void;
}

export default function GenericNode({ item, isLast, onClick, onRemove, onHover, onVerifyLivePrice }: GenericNodeProps) {
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
      gradientClass = isHovered ? 'bg-gradient-to-br from-rose-50/80 to-rose-100/60 border-rose-200' : 'bg-gradient-to-br from-rose-50/40 to-rose-50/80 border-rose-100';
      iconTint = 'text-rose-400';
      break;
    case 'attraction':
      gradientClass = isHovered ? 'bg-gradient-to-br from-emerald-50/80 to-emerald-100/60 border-emerald-200' : 'bg-gradient-to-br from-emerald-50/40 to-emerald-50/80 border-emerald-100';
      iconTint = 'text-emerald-500';
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
    zIndex: isDragging ? 10 : 1,
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={{ ...style, opacity: 0.3 }} 
        className="relative rounded-[16px] border-2 border-dashed border-slate-300 bg-slate-100/30 min-h-[109px] w-full mb-3"
      />
    );
  }

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
            className={`flex cursor-pointer items-stretch justify-between gap-3 rounded-[16px] border ${gradientClass} p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md touch-none overflow-hidden`}
          >
            <div className="flex flex-1 min-w-0 gap-3 items-stretch">
              {/* 25% Hero Image panel on side */}
              <div className="w-1/4 shrink-0 relative bg-slate-100/80 rounded-xl overflow-hidden min-h-[85px] border border-white/60 shadow-xs">
                {item.image ? (
                  <Image src={item.image} alt={item.title} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full w-full bg-slate-50 text-slate-400">
                    {item.type === 'attraction' ? <Compass size={22} className="text-emerald-500" /> :
                     item.type === 'activity' ? <Zap size={22} className="text-rose-500" /> :
                     item.type === 'food' ? <Utensils size={22} className="text-orange-400" /> :
                     item.type === 'hotel' ? <BedDouble size={22} className="text-indigo-400" /> :
                     <Camera size={22} />}
                  </div>
                )}
              </div>

              {/* Info - Right side */}
              <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900 tracking-tight truncate">{item.title}</h4>
                    {item.rating ? (
                      <div className="flex items-center text-amber-400 shrink-0">
                        <Star size={11} fill="currentColor" />
                        <span className="text-[11px] font-semibold text-slate-700 ml-0.5">{item.rating}</span>
                      </div>
                    ) : null}
                  </div>
                  
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 font-medium">
                    {item.geoTag ? (
                      <span className="flex items-center gap-1 truncate"><MapPin size={11} className={iconTint} /> {item.geoTag}</span>
                    ) : null}
                    {item.geoTag && item.subtitle && <span className="text-slate-300">•</span>}
                    {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                  </div>
                  
                  {item.details ? <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{item.details}</p> : null}
                  {item.aiTip && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-blue-50/50 p-2 border border-blue-100/50 text-[11px] text-blue-800 font-medium">
                      <span className="shrink-0 text-xs mt-0.5">💡</span>
                      <p className="leading-normal">{item.aiTip}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between shrink-0 pl-1">
              {item.price ? (
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-950">
                    {item.status === 'Confirmed' ? item.price : `approx. ${item.price}`}
                  </p>
                  {(() => {
                    const conv = formatConvertedPrice(item.price);
                    return conv ? (
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {item.status === 'Confirmed' ? `(${conv})` : `approx. (${conv})`}
                      </p>
                    ) : null;
                  })()}
                  
                  {/* Provenance: where this price actually came from */}
                  <div className="mt-2 export-hidden flex flex-col items-end gap-1">
                    <ProvenanceBadge provenance={item.cost?.provenance} />
                    {['hotel', 'flight', 'train', 'bus', 'taxi'].includes(item.type) &&
                      item.cost?.provenance?.tier !== 'verified' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onVerifyLivePrice) {
                              onVerifyLivePrice(item.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-100 shadow-xs cursor-pointer"
                        >
                          Verify Price
                        </button>
                      )}
                  </div>

                  {(item.type === 'attraction' || item.type === 'activity') && (
                    <div className="mt-2 export-hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onClick) {
                            onClick();
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold active:scale-95 transition-all border shadow-xs cursor-pointer ${
                          item.type === 'attraction'
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-250'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-250'
                        }`}
                      >
                        {item.type === 'attraction' ? '🔄 Change Attraction' : '🔄 Change Activity'}
                      </button>
                    </div>
                  )}
                </div>
              ) : <div />}
              
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                className="mt-auto rounded-xl bg-rose-50 p-2 text-rose-500 border border-rose-100/80 shadow-xs hover:bg-rose-100 hover:text-rose-600 active:scale-95 transition-all cursor-pointer export-hidden"
                title="Delete Item"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {item.distanceToNext && (
          <div className="absolute -bottom-5 left-[71px] md:left-[79px] z-10 flex -translate-x-1/2 -translate-y-1/2 items-center bg-paper-1 py-1 px-1">
            <div className="rounded-full border border-line-strong bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-500 shadow-sm">
              {item.distanceToNext}
            </div>
          </div>
        )}
      </NodeWrapper>
    </div>
  );
}
