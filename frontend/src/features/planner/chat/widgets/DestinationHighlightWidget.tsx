import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Cloud, CloudRain, Snowflake, Sparkles } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';

/**
 * One-time hero card fired the turn the destination first becomes known —
 * a GIVE, not an ask (no Done/Skip — display only). Full-bleed photos from
 * the enriched Places catalog when available; a themed gradient otherwise,
 * never a broken image (backend/services/intelligence/recommendations.py
 * destination_highlight_payload degrades honestly on an empty catalog).
 */

interface Weather {
  temp_c?: number | null;
  condition?: string | null;
  note?: string | null;
  provenance?: string | null;
}

interface DestinationHighlightWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

function WeatherIcon({ condition }: { condition?: string | null }) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('drizzle') || c.includes('thunder')) return <CloudRain size={13} />;
  if (c.includes('snow')) return <Snowflake size={13} />;
  if (c.includes('cloud') || c.includes('overcast') || c.includes('fog')) return <Cloud size={13} />;
  return <Sun size={13} />;
}

export function DestinationHighlightWidget({ widget }: DestinationHighlightWidgetProps) {
  const data = (widget.data || {}) as any;
  const destination = (data.destination as string) || '';
  const photos: string[] = Array.isArray(data.photos) ? data.photos.filter(Boolean) : [];
  const weather: Weather = data.weather || {};
  const bestTime = data.best_time as string | undefined;
  const vibeTags: string[] = Array.isArray(data.vibe_tags) ? data.vibe_tags : [];
  const oneLiner = (data.one_liner as string) || destination;
  const hasPhoto = photos.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="mr-auto mt-1.5 w-full max-w-[360px] overflow-hidden rounded-2xl shadow-surface"
    >
      <div
        className={`relative flex h-32 flex-col justify-end p-3.5 ${
          hasPhoto ? '' : 'bg-gradient-to-br from-[rgb(var(--color-ai))] via-violet-600 to-fuchsia-600'
        }`}
        style={hasPhoto ? { backgroundImage: `url(${photos[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {hasPhoto && <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />}
        <div className="relative flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
          <Sparkles size={10} />
          <span>Destination</span>
        </div>
        <h3 className="relative text-lg font-extrabold text-white drop-shadow-sm">{destination}</h3>
      </div>

      <div className="flex flex-col gap-2 bg-paper-2 p-3">
        <p className="text-xs leading-relaxed text-ink-600">{oneLiner}</p>
        <div className="flex flex-wrap gap-1.5">
          {(weather.temp_c !== null && weather.temp_c !== undefined) && (
            <span className="flex items-center gap-1 rounded-full bg-paper-1 px-2 py-1 text-[10px] font-semibold text-ink-600">
              <WeatherIcon condition={weather.condition} />
              {Math.round(weather.temp_c)}°C{weather.condition ? ` · ${weather.condition}` : ''}
            </span>
          )}
          {bestTime && (
            <span className="rounded-full bg-paper-1 px-2 py-1 text-[10px] font-semibold text-ink-600">
              Best: {bestTime}
            </span>
          )}
          {vibeTags.slice(0, 3).map(tag => (
            <span key={tag} className="rounded-full border border-line px-2 py-1 text-[10px] font-medium capitalize text-ink-500">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
