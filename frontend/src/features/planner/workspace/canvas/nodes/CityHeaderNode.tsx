import React from 'react';
import { MoreVertical } from 'lucide-react';
import { ItineraryCity } from '../mockData';

interface CityHeaderNodeProps {
  city: ItineraryCity;
}

export default function CityHeaderNode({ city }: CityHeaderNodeProps) {
  return (
    <div className="relative mt-2 py-2 pl-24 md:pl-28">
      <div className="absolute bottom-[-50%] left-[81px] top-1/2 w-px bg-[#ddd7ca] md:left-[89px]" />

      <div
        className={`absolute left-[65px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[12px] text-xs font-bold text-white shadow-md md:left-[73px] ${city.iconBgColor}`}
      >
        {city.icon}
      </div>

      <div className="flex flex-col gap-3 rounded-[16px] border border-[#e2ddd2] bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{city.cityName}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>{city.nights} nights</span>
            <span>•</span>
            <span>{city.dateRange}</span>
            <span>•</span>
            <span>{city.weather}</span>
          </div>
        </div>
        <button className="self-start rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#faf8f2] hover:text-slate-700 lg:self-auto">
          <MoreVertical size={16} />
        </button>
      </div>
    </div>
  );
}
