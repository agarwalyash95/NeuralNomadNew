import React from 'react';
import { Cloud, MapPin, ArrowRightLeft, Ruler, AlertCircle, Star, ListChecks, BellRing, Pin, PinOff, Check } from 'lucide-react';

/**
 * Conversation Capabilities — browse/live results shown inline in chat
 * (docs/conversation-capability-layer.md). Unlike input widgets, these never
 * collect an answer: no onSubmit, read-only, additive alongside whatever
 * cluster widget the turn also shows. Degraded capabilities (no wired live
 * source) render an honest inline notice rather than a fabricated value.
 *
 * Pinning (docs/conversation-capability-layer.md §2.5): the user can pin a
 * card to keep it visible across turns (a monitored price, the trip-so-far
 * summary, a weather check during a foreign trip). Pin state is provided by
 * the caller (usePinnedCapabilities) — CapabilityRenderer itself stays a
 * pure, stateless renderer.
 */

export interface CapabilityData {
  cap: string;
  data: Record<string, any>;
  freshness?: string;
  degraded?: boolean;
  degraded_reason?: string;
}

/** Stable identity for a capability instance — used for dedup + pin tracking. */
export function capabilityKey(capability: CapabilityData): string {
  return `${capability.cap}:${JSON.stringify(capability.data)}`;
}

function DegradedNote({ reason }: { reason?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-ink-400">
      <AlertCircle size={12} />
      <span>{reason || "Live data isn't available for this yet."}</span>
    </div>
  );
}

function CapabilityShell({
  icon,
  title,
  children,
  pinned,
  onTogglePin,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  return (
    <div className="mr-auto mt-1 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-line bg-paper-1 p-3 shadow-surface animate-fade-in">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {icon}
          <span>{title}</span>
        </div>
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            aria-label={pinned ? 'Unpin' : 'Pin to keep visible'}
            title={pinned ? 'Unpin' : 'Pin to keep visible'}
            className={`rounded-md p-1 transition-colors ${
              pinned ? 'text-[rgb(var(--color-ai))]' : 'text-ink-300 hover:text-ink-500'
            }`}
          >
            {pinned ? <Pin size={12} className="fill-current" /> : <PinOff size={12} />}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface CardProps {
  capability: CapabilityData;
  pinned?: boolean;
  onTogglePin?: () => void;
}

function SearchResultsCard({ capability, pinned, onTogglePin }: CardProps) {
  const { data, degraded, degraded_reason } = capability;
  const results = (data.results as any[]) || [];
  const titleMap: Record<string, string> = {
    search_hotels: 'Hotels',
    search_restaurants: 'Restaurants',
    search_attractions: 'Attractions',
    nearby_search: 'Nearby',
  };
  const title = `${titleMap[capability.cap] || 'Places'}${data.destination ? ` in ${data.destination}` : ''}`;

  return (
    <CapabilityShell icon={<MapPin size={13} className="text-[rgb(var(--color-ai))]" />} title={title} pinned={pinned} onTogglePin={onTogglePin}>
      {degraded || results.length === 0 ? (
        <DegradedNote reason={degraded_reason || 'No results found yet.'} />
      ) : (
        <div className="flex flex-col gap-1.5">
          {results.slice(0, 5).map(r => (
            <div key={r.id ?? r.name} className="flex items-center justify-between gap-2 rounded-lg bg-paper-0 px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-ink-800">{r.name}</div>
                {r.address && <div className="truncate text-[10px] text-ink-400">{r.address}</div>}
              </div>
              {r.rating != null && (
                <div className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-ink-600">
                  <Star size={10} className="fill-amber-400 text-amber-400" /> {r.rating.toFixed(1)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CapabilityShell>
  );
}

function WeatherCard({ capability, pinned, onTogglePin }: CardProps) {
  const { data, degraded, degraded_reason } = capability;
  return (
    <CapabilityShell
      icon={<Cloud size={13} className="text-[rgb(var(--color-ai))]" />}
      title={`Weather${data.destination ? ` — ${data.destination}` : ''}`}
      pinned={pinned}
      onTogglePin={onTogglePin}
    >
      {degraded ? (
        <DegradedNote reason={degraded_reason} />
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-ink-800">
            {data.avg_temp_c != null ? `${Math.round(data.avg_temp_c)}°C` : '—'}
          </span>
          <span className="text-xs capitalize text-ink-500">{data.feels_like_bucket || ''}</span>
        </div>
      )}
      {data.note && !degraded && <p className="text-[10px] text-ink-400">{data.note}</p>}
    </CapabilityShell>
  );
}

function ForexCard({ capability, pinned, onTogglePin }: CardProps) {
  const { data, degraded, degraded_reason } = capability;
  const isCalculator = capability.cap === 'exchange_calculator';
  return (
    <CapabilityShell
      icon={<ArrowRightLeft size={13} className="text-[rgb(var(--color-ai))]" />}
      title={isCalculator ? 'Currency conversion' : 'Exchange rate'}
      pinned={pinned}
      onTogglePin={onTogglePin}
    >
      {degraded ? (
        <DegradedNote reason={degraded_reason} />
      ) : (
        <div className="text-sm font-bold text-ink-800">
          {data.amount} {data.from_currency} = {data.converted_amount} {data.to_currency}
          <span className="ml-2 text-[10px] font-normal text-ink-400">rate {data.rate}</span>
        </div>
      )}
    </CapabilityShell>
  );
}

function LiveStatusCard({ capability, pinned, onTogglePin }: CardProps) {
  const isTrain = capability.cap === 'train_running_status';
  return (
    <CapabilityShell
      icon={<AlertCircle size={13} className="text-[rgb(var(--color-ai))]" />}
      title={isTrain ? 'Train status' : 'Flight status'}
      pinned={pinned}
      onTogglePin={onTogglePin}
    >
      <DegradedNote reason={capability.degraded_reason} />
    </CapabilityShell>
  );
}

function MonitorPriceCard({ capability, pinned, onTogglePin }: CardProps) {
  const { data, degraded, degraded_reason } = capability;
  return (
    <CapabilityShell
      icon={<BellRing size={13} className="text-[rgb(var(--color-ai))]" />}
      title="Price watch"
      pinned={pinned}
      onTogglePin={onTogglePin}
    >
      {degraded ? (
        <DegradedNote reason={degraded_reason} />
      ) : (
        <p className="text-sm text-ink-800">
          Watching <span className="font-semibold">{data.block_title}</span> — I&apos;ll flag it here if the price drops.
        </p>
      )}
    </CapabilityShell>
  );
}

const KNOWN_LABELS: Record<string, string> = {
  destination: 'Destination',
  dates: 'Dates',
  travelers: 'Travelers',
  budget: 'Budget',
  purpose: 'Purpose',
  origin: 'Origin',
};

function TripProgressCard({ capability, pinned, onTogglePin }: CardProps) {
  const { data } = capability;
  const known = (data.known as Record<string, any>) || {};
  const entries = Object.entries(known);
  const score = typeof data.confidence_score === 'number' ? data.confidence_score : null;

  return (
    <CapabilityShell icon={<ListChecks size={13} className="text-[rgb(var(--color-ai))]" />} title="Your trip so far" pinned={pinned} onTogglePin={onTogglePin}>
      {entries.length === 0 ? (
        <DegradedNote reason="Nothing captured yet." />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([key, value]) => (
            <span
              key={key}
              className="rounded-full border border-line bg-paper-0 px-2 py-1 text-[10px] font-semibold text-ink-700"
            >
              <span className="text-ink-400">{KNOWN_LABELS[key] || key}: </span>
              {String(value)}
            </span>
          ))}
        </div>
      )}
      {score != null && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-paper-0">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-[rgb(var(--color-ai))] to-violet-700 transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      {data.ready_for_plan && (
        <p className="text-[10px] font-semibold text-emerald-600">Ready — create the plan whenever you like.</p>
      )}
    </CapabilityShell>
  );
}

function DistanceCard({ capability, pinned, onTogglePin }: CardProps) {
  const { data, degraded, degraded_reason } = capability;
  return (
    <CapabilityShell icon={<Ruler size={13} className="text-[rgb(var(--color-ai))]" />} title="Distance" pinned={pinned} onTogglePin={onTogglePin}>
      {degraded ? (
        <DegradedNote reason={degraded_reason} />
      ) : (
        <div className="text-sm font-bold text-ink-800">
          {data.origin} → {data.destination}: {data.distance_km} km
        </div>
      )}
    </CapabilityShell>
  );
}

function RegeneratePlanCard({ capability }: CardProps) {
  const { data } = capability;
  return (
    <CapabilityShell icon={<AlertCircle size={13} className="text-[rgb(var(--color-ai))]" />} title="Plan Generation">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-800">{data.message}</p>
      </div>
    </CapabilityShell>
  );
}

function EditPlanCard({ capability }: CardProps) {
  const { data, degraded, degraded_reason } = capability;
  return (
    <CapabilityShell icon={<ListChecks size={13} className="text-[rgb(var(--color-ai))]" />} title="Plan Edit">
      {degraded ? (
        <DegradedNote reason={degraded_reason} />
      ) : (
        <div className="flex items-center gap-2">
          <Check size={16} className="text-emerald-600" />
          <p className="text-sm font-bold text-emerald-800">{data.message}</p>
        </div>
      )}
    </CapabilityShell>
  );
}

const CAPABILITY_REGISTRY: Record<string, React.ComponentType<CardProps>> = {
  search_hotels: SearchResultsCard,
  search_restaurants: SearchResultsCard,
  search_attractions: SearchResultsCard,
  nearby_search: SearchResultsCard,
  weather: WeatherCard,
  forex: ForexCard,
  exchange_calculator: ForexCard,
  flight_status: LiveStatusCard,
  train_running_status: LiveStatusCard,
  distance: DistanceCard,
  trip_progress: TripProgressCard,
  monitor_price: MonitorPriceCard,
  regenerate_plan: RegeneratePlanCard,
  edit_plan: EditPlanCard,
};

export interface CapabilityRendererProps {
  capabilities: CapabilityData[];
  /** Keys (capabilityKey(cap)) currently pinned — omit to disable pin controls entirely. */
  pinnedKeys?: Set<string>;
  onTogglePin?: (capability: CapabilityData) => void;
}

export function CapabilityRenderer({ capabilities, pinnedKeys, onTogglePin }: CapabilityRendererProps) {
  if (!capabilities || capabilities.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {capabilities.slice(0, 2).map((capability, idx) => {
        const Component = CAPABILITY_REGISTRY[capability.cap];
        if (!Component) return null;
        const key = capabilityKey(capability);
        return (
          <Component
            key={`${capability.cap}-${idx}`}
            capability={capability}
            pinned={pinnedKeys?.has(key)}
            onTogglePin={onTogglePin ? () => onTogglePin(capability) : undefined}
          />
        );
      })}
    </div>
  );
}
