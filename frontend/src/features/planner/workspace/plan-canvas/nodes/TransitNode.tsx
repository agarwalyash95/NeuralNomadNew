import React from 'react';
import { Train, Plane, Bus, Trash2 } from 'lucide-react';
import { ItineraryItem } from '../types';
import Image from 'next/image';

interface TransitNodeProps {
  item: ItineraryItem;
  onClick?: () => void;
  onHover?: (isHovered: boolean) => void;
  onRemove?: () => void;
}

export default function TransitNode({ item, onClick, onHover, onRemove }: TransitNodeProps) {
  const getIcon = () => {
    switch (item.type) {
      case 'train':
        return <Train size={16} className="text-white" fill="currentColor" />;
      case 'flight':
        return <Plane size={16} className="text-white" fill="currentColor" />;
      case 'bus':
        return <Bus size={16} className="text-white" fill="currentColor" />;
      default:
        return <Train size={16} className="text-white" fill="currentColor" />;
    }
  };

  return (
    <div className="relative mb-2 mt-2 py-4 pl-[70px] pr-4">
      <div className="absolute left-[38px] top-0 h-1/2 w-1 bg-slate-800" />
      <div className="absolute bottom-0 left-[38px] h-1/2 w-1 bg-slate-800" />

      <div className="absolute left-[24px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800 text-white shadow-md">
        {getIcon()}
      </div>

      <div
        onClick={onClick}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-sky-200 bg-gradient-to-br from-sky-50/80 to-sky-100/40 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex min-w-0 items-center gap-3">
          {item.image ? (
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl shadow-sm border border-white/50">
              <Image src={item.image} alt={item.title} fill className="object-cover" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-sky-600">Transit</p>
            <h4 className="mt-1 text-lg font-bold text-slate-900 tracking-tight">{item.title}</h4>
            <p className="mt-0.5 text-xs font-medium text-slate-600">{item.subtitle}</p>
            {item.details ? <p className="mt-1.5 text-xs font-semibold text-sky-700">{item.details}</p> : null}
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="rounded-xl bg-rose-50 p-2 text-rose-500 border border-rose-100/80 shadow-xs hover:bg-rose-100 hover:text-rose-600 active:scale-95 transition-all cursor-pointer shrink-0"
          title="Delete Transit"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
