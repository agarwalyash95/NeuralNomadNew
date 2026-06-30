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
    <div className="relative mb-2 mt-2 py-3 pl-24 md:pl-28">
      <div className="absolute left-[81px] top-0 h-1/2 w-px bg-[#ddd7ca] md:left-[89px]" />
      <div className="absolute bottom-0 left-[81px] h-1/2 w-px bg-[#ddd7ca] md:left-[89px]" />

      <div className="absolute left-[65px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[12px] bg-blue-500 text-white shadow-md md:left-[73px]">
        {getIcon()}
      </div>

      <div
        onClick={onClick}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[#d7e5ff] bg-[linear-gradient(180deg,#f7fbff_0%,#eef5ff_100%)] p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex min-w-0 items-center gap-3">
          {item.image ? (
            <div className="relative h-[40px] w-[80px] shrink-0 overflow-hidden rounded-xl">
              <Image src={item.image} alt={item.title} fill className="object-cover" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500">Transit</p>
            <h4 className="mt-0.5 text-sm font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
            {item.details ? <p className="mt-1 text-xs font-medium text-emerald-700">{item.details}</p> : null}
          </div>
        </div>
        <button className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-800">
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  );
}
