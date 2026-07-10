import { MoreVertical, CloudSun, ChevronDown } from 'lucide-react';
import { ItineraryCity } from '../types';

interface CityHeaderNodeProps {
  city: ItineraryCity;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function CityHeaderNode({ city, isCollapsed, onToggle }: CityHeaderNodeProps) {
  return (
    <div className="relative mt-8 mb-2 py-2 pl-[70px]">
      {/* Thick Main Spine connecting downwards */}
      <div className="absolute bottom-[-20%] left-[38px] top-1/2 w-1 rounded-full bg-slate-800" />

      {/* City Badge on timeline */}
      <div
        className={`absolute left-[24px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ${city.iconBgColor}`}
      >
        {city.icon}
      </div>

      <div className="relative z-10 flex items-center justify-between pr-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold uppercase tracking-widest text-slate-900">{city.cityName}</h2>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{city.nights} Nights</span>
            <span className="text-slate-300">•</span>
            <span>{city.dateRange}</span>
            {city.weather && (
              <>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1"><CloudSun size={12} /> {city.weather}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={onToggle}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            {isCollapsed ? 'Expand' : 'Collapse'}
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronDown size={14} className="rotate-180" />}
          </button>
          <button className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
