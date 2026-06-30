import React from 'react';
import { ItineraryDay } from '../mockData';

interface DayHeaderNodeProps {
  day: ItineraryDay;
}

export default function DayHeaderNode({ day }: DayHeaderNodeProps) {
  return (
    <div className="relative py-2 pl-24 md:pl-28">
      <div className="absolute bottom-0 left-[81px] top-0 w-px bg-[#ddd7ca] md:left-[89px]" />
      <div className="absolute left-[78px] top-[16px] z-10 h-2 w-2 rounded-full border-2 border-white bg-slate-500 ring-4 ring-[#f6f4ef] md:left-[86px]" />

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Day {day.dayNumber}</h3>
        <span className="rounded-full bg-[#f6f4ef] px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {day.dateStr}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{day.title}</p>
    </div>
  );
}
