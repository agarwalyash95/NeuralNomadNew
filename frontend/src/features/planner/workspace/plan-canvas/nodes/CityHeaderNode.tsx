import { useState } from 'react';
import { MoreVertical, ChevronDown, CloudSun, Newspaper, Thermometer, Sparkles, Info } from 'lucide-react';
import { ItineraryCity } from '../types';
import { useCityBriefing } from '@/features/planner/hooks/usePlannerQueries';

interface CityHeaderNodeProps {
  city: ItineraryCity;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

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
    <div className="relative z-10 mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold text-ink-500 transition-colors hover:bg-paper-1/80 hover:text-ink-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-booking))] focus-visible:ring-offset-1"
        style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
      >
        <Newspaper size={11} className="text-ink-400" />
        City Briefing
        <ChevronDown
          size={11}
          className={`text-ink-400 transition-transform duration-[var(--motion-panel)] ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-line/60 bg-white p-4 text-xs max-w-2xl shadow-surface ml-3 border-l-2 border-l-[rgb(var(--color-journey)/0.6)]"
        >
          {isLoading && (
            <div className="flex flex-col gap-2">
              <div className="h-3 w-2/3 rounded-full bg-line/40 animate-shimmer" />
              <div className="h-3 w-1/2 rounded-full bg-line/30 animate-shimmer" />
            </div>
          )}

          {!isLoading && !hasContent && (
            <p className="text-ink-500 font-medium italic">Nothing on file yet for {city.cityName}.</p>
          )}

          {!isLoading && briefing?.weather && (
            <div className="flex items-start gap-2.5">
              <Thermometer size={13} className="mt-0.5 shrink-0 text-sky-500" />
              <p className="text-ink-700 font-medium leading-relaxed">
                {briefing.weather.avg_temp_c != null && <>{briefing.weather.avg_temp_c}°C average. </>}
                {briefing.weather.packing_note}
              </p>
            </div>
          )}

          {!isLoading && briefing?.season && (
            <div className="flex items-start gap-2.5">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-ink-700 font-medium leading-relaxed">
                {briefing.season.season_type} season.
                {briefing.season.natural_phenomena?.map((p) => (
                  <span key={p.name}> {p.name} typically {p.typical_window[0]}–{p.typical_window[1]} (±{p.year_variability_days}d).</span>
                ))}
              </p>
            </div>
          )}

          {!isLoading && briefing?.local_tips?.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Info size={13} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-ink-700 font-medium leading-relaxed">
                <span className="text-ink-400 uppercase text-[8px] tracking-wider font-bold mr-1.5">
                  {tip.category.replace('_', ' ')}
                </span>
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
    <div className="relative mt-6 mb-1 py-2 pl-[48px]">
      {/* Main spine — soft, continues down */}
      <div className="absolute bottom-[-8px] left-[20px] top-0 w-px bg-line/60" />

      {/* City chapter badge on spine — solid dark ink for perfect contrast (H6) */}
      <div
        className="absolute left-[4px] top-1/2 z-10 flex h-[32px] w-[32px] -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold shadow-surface border border-line-strong"
        style={{
          background: 'rgb(var(--ink-900))',
          boxShadow: '0 0 0 3px rgb(var(--paper-0)), var(--shadow-surface)',
          color: 'rgb(var(--paper-1))',
        }}
        title={city.cityName}
      >
        {city.icon}
      </div>

      {/* City header content */}
      <div className="relative z-10 flex items-start justify-between gap-4 pr-4 max-w-3xl">
        <div className="flex-1 min-w-0">

          {/* City name — chapter heading */}
          <h2 className="text-[24px] font-bold tracking-tight text-ink-900 leading-tight">
            {city.cityName}
          </h2>

          {/* Metadata row — nights, dates, weather */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-ink-500">
              {city.nights} {city.nights === 1 ? 'night' : 'nights'}
            </span>
            <span className="text-line-strong">·</span>
            <span className="text-[11px] font-medium text-ink-500">
              {city.dateRange}
            </span>

            {/* Weather chip — visual first, emoji + temp */}
            {city.weather && (
              <>
                <span className="text-line-strong">·</span>
                <span
                  className="flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-[10px] font-semibold text-sky-700"
                  title="Seasonal average — not a live forecast"
                >
                  <CloudSun size={10} className="text-sky-500" />
                  {city.weather} Avg
                </span>
              </>
            )}
          </div>

          {/* City Briefing accordion */}
          <CityBriefingSection city={city} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 mt-1 shrink-0">
          <button
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand ${city.cityName}` : `Collapse ${city.cityName}`}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 transition-all hover:bg-paper-0 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-booking))] focus-visible:ring-offset-1"
            style={{ transition: `all var(--motion-card) var(--ease-out)` }}
          >
            {isCollapsed ? 'Expand' : 'Collapse'}
            <ChevronDown
              size={13}
              className={`transition-transform duration-[var(--motion-panel)] ${isCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
          <button
            className="rounded-xl p-2 text-ink-400 transition-colors hover:bg-paper-1 hover:text-ink-700"
            style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
