import React from 'react';
import { MoreVertical, Train, Plane, Bus } from 'lucide-react';
import { ItineraryItem } from '../mockData';
import Image from 'next/image';

interface TransitNodeProps {
  item: ItineraryItem;
  onClick?: () => void;
}

export default function TransitNode({ item, onClick }: TransitNodeProps) {
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
        <button className="rounded-full p-2 text-sky-400 transition-colors hover:bg-white/70 hover:text-sky-700">
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
}
