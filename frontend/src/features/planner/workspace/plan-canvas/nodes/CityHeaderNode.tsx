import { useState } from 'react';
import { MoreVertical, CloudSun, ChevronDown, Newspaper, Thermometer, Sparkles, Info } from 'lucide-react';
import { ItineraryCity } from '../types';
import { useCityBriefing } from '@/features/planner/hooks/usePlannerQueries';

interface CityHeaderNodeProps {
  city: ItineraryCity;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

/** First month found in `dateRange` ("2026-08-10 to 2026-08-14") — the month
 *  weather normals / travel season are looked up for. Absent rather than
 *  guessed if the string doesn't parse. */
function arrivalMonth(dateRange: string): number | undefined {
  const isoDate = dateRange.split(' to ')[0]?.trim();
  const month = isoDate ? new Date(isoDate).getMonth() + 1 : NaN;
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : undefined;
}

function CityBriefingSection({ city }: { city: ItineraryCity }) {
  const [open, setOpen] = useState(false);
  const month = arrivalMonth(city.dateRange);
  const { data: briefing, isLoading } = useCityBriefing(city.cityName, month, open);

  const hasContent = Boolean(briefing?.weather || briefing?.season || (briefing?.local_tips?.length ?? 0) > 0);

  return (
    <div className="relative z-10 mt-2 pr-4">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
      >
        <Newspaper size={11} />
        City Briefing
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div role="status" aria-live="polite" className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-paper-2 p-3 text-xs max-w-lg">
          {isLoading && (
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-2/3 motion-safe:animate-pulse rounded bg-line" />
              <div className="h-3 w-1/2 motion-safe:animate-pulse rounded bg-line/70" />
            </div>
          )}

          {!isLoading && !hasContent && (
            <p className="text-ink-500 font-medium">Nothing on file yet for {city.cityName}.</p>
          )}

          {!isLoading && briefing?.weather && (
            <div className="flex items-start gap-2">
              <Thermometer size={13} className="mt-0.5 shrink-0 text-sky-500" />
              <p className="text-ink-700 font-medium">
                {briefing.weather.avg_temp_c != null && <>Averages {briefing.weather.avg_temp_c}°C this month. </>}
                {briefing.weather.packing_note}
              </p>
            </div>
          )}

          {!isLoading && briefing?.season && (
            <div className="flex items-start gap-2">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-ink-700 font-medium">
                {briefing.season.season_type} season.
                {briefing.season.natural_phenomena?.map((p) => (
                  <span key={p.name}> {p.name} typically {p.typical_window[0]}–{p.typical_window[1]} (±{p.year_variability_days}d).</span>
                ))}
              </p>
            </div>
          )}

          {!isLoading && briefing?.local_tips?.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <Info size={13} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-ink-700 font-medium">
                <span className="text-ink-500 uppercase text-[9px] tracking-wider font-bold mr-1">{tip.category.replace('_', ' ')}</span>
                {tip.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand ${city.cityName}` : `Collapse ${city.cityName}`}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            {isCollapsed ? 'Expand' : 'Collapse'}
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronDown size={14} className="rotate-180" />}
          </button>
          <button className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <CityBriefingSection city={city} />
    </div>
  );
}
