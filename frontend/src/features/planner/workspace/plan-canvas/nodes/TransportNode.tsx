import React from 'react';
import { Trash2, Plane, Train, Bus, Car, Eye, GripVertical } from 'lucide-react';
import { ItineraryItem } from '../types';
import NodeWrapper, { formatDuration } from './NodeWrapper';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatConvertedPrice } from '../utils/routeOptimizer';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import { BookingStateChip, bookedAccentClass } from '@/features/planner/components/BookingStateChip';
import MoveToDaySelect, { DayOption } from './MoveToDaySelect';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface TransportNodeProps {
  item: ItineraryItem;
  isLast?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  onHover?: (isHovered: boolean) => void;
  onVerifyLivePrice?: (itemId: string) => void;
  onWatchPrice?: (itemId: string) => void;
  onTimeChange?: (field: 'start' | 'end', value: string) => void;
  moveDayOptions?: DayOption[];
  currentDayId?: string;
  onMoveToDay?: (dayId: string) => void;
  distanceKm?: number;
  fallbackOriginCity?: string;
  fallbackDestCity?: string;
  computedOrigin?: string;
  computedDestination?: string;
}

/**
 * TransportNode — boarding-pass layout for flight | train | bus | cab.
 * Visual hierarchy: departure city → mode icon → destination city.
 * No photography — pure premium iconography only.
 */
function TransportNode({
  item, isLast, onClick, onRemove, onHover, onVerifyLivePrice,
  onWatchPrice, onTimeChange, moveDayOptions, currentDayId, onMoveToDay,
  computedOrigin, computedDestination, distanceKm,
  fallbackOriginCity, fallbackDestCity
}: TransportNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, opacity: 0.3 }}
        className="relative rounded-2xl border-2 border-dashed border-line bg-paper-0 min-h-[120px] w-full mb-3"
      />
    );
  }

  // Mode-specific styles — No photography: iconography only
  const typeConfig = {
    flight: {
      icon: <Plane size={18} className="text-violet-600" />,
      label: 'Flight',
      accentBg: 'rgb(139 92 246 / 0.06)',
      accentBorder: 'rgb(139 92 246 / 0.15)',
      accentText: 'rgb(109 40 217)',
      connectorColor: 'rgb(139 92 246 / 0.3)',
    },
    train: {
      icon: <Train size={18} className="text-blue-600" />,
      label: 'Train',
      accentBg: 'rgb(37 99 235 / 0.05)',
      accentBorder: 'rgb(37 99 235 / 0.12)',
      accentText: 'rgb(29 78 216)',
      connectorColor: 'rgb(37 99 235 / 0.25)',
    },
    bus: {
      icon: <Bus size={18} className="text-sky-600" />,
      label: 'Bus',
      accentBg: 'rgb(2 132 199 / 0.05)',
      accentBorder: 'rgb(2 132 199 / 0.12)',
      accentText: 'rgb(3 105 161)',
      connectorColor: 'rgb(2 132 199 / 0.25)',
    },
    cab: {
      icon: <Car size={18} className="text-amber-600" />,
      label: 'Cab',
      accentBg: 'rgb(217 119 6 / 0.05)',
      accentBorder: 'rgb(217 119 6 / 0.12)',
      accentText: 'rgb(180 83 9)',
      connectorColor: 'rgb(217 119 6 / 0.3)',
    },
    self_drive: {
      icon: <Car size={18} className="text-emerald-700" />,
      label: 'Self drive',
      accentBg: 'rgb(5 150 105 / 0.05)',
      accentBorder: 'rgb(5 150 105 / 0.14)',
      accentText: 'rgb(4 120 87)',
      connectorColor: 'rgb(5 150 105 / 0.3)',
    },
  };

  const config = typeConfig[item.type as keyof typeof typeConfig] ?? typeConfig.flight;
  const legDuration = formatDuration(item.startTime, item.endTime);

  const hasRealCodes =
    (item.type === 'flight' || item.type === 'train') &&
    Boolean(item.originCode && item.destinationCode);

  const isCab = item.type === 'cab' || item.type === 'taxi';
  
  // Use resolved hub names from metadata if available (backend backfill)
  const transportMeta = item._rawActivity?.metadata?.transport || {};
  const metaSource = transportMeta.resolved_source;
  const metaDest = transportMeta.resolved_destination;
  const hubLabel = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      const hub = value as { name?: string; code?: string };
      return hub.code ? `${hub.name || hub.code} (${hub.code})` : hub.name;
    }
    return String(value);
  };

  // PROV-01 (docs/planner-complete-current-audit-and-repair-plan.md §19
  // R13): the route's OWN provenance/confidence (transportMeta.provenance,
  // e.g. backend "estimated"/"hub_geometry" at confidence 0.35 vs
  // "verified_database"/"live_provider") is a different signal from the
  // PRICE provenance ProvenanceBadge already renders below (item.cost?.
  // provenance) — before this, a purely geometric, unverified route
  // estimate and a real database-backed route rendered with identical
  // plain text ("Requires verification"), no visual distinction at all.
  // Reuses the exact same trust-grammar badge the rest of the app already
  // uses, mapped onto the backend's route-provenance vocabulary, rather
  // than inventing a second visual language.
  const routeProvenanceTier: 'verified' | 'estimated' | null =
    transportMeta.provenance === 'live_provider' ||
    transportMeta.provenance === 'cached_provider' ||
    transportMeta.provenance === 'verified_database'
      ? 'verified'
      : transportMeta.provenance === 'estimated'
        ? 'estimated'
        : null;

  // Fallback title parsing
  const rawTitle = (item.subtitle || item.title || '').replace('â†’', 'to').replace('→', 'to');
  const titleParts = rawTitle.includes(' to ') 
    ? rawTitle.split(' to ') 
    : [rawTitle];

  // If title was "Flight: Kolkata to Delhi", titleParts[0] is "Flight: Kolkata"
  let parsedOrigin = titleParts.length > 1 ? titleParts[0]?.replace(/^.*:\s*/, '').trim() : undefined;
  let parsedDest = titleParts.length > 1 ? titleParts[1]?.trim() : undefined;

  const originCity = hubLabel(metaSource) || parsedOrigin || (isCab && computedOrigin ? computedOrigin : (fallbackOriginCity || 'Origin'));
  const destCity = hubLabel(metaDest) || parsedDest || (isCab && computedDestination ? computedDestination : (fallbackDestCity || 'Destination'));
  
  const extractCode = (name: string) => {
    const match = name.match(/\(([^)]+)\)$/);
    return match ? match[1] : name;
  };
  
  const origin = hasRealCodes ? item.originCode! : extractCode(originCity);
  const dest = hasRealCodes ? item.destinationCode! : extractCode(destCity);
  
  // Clean up title display to remove encoding glitches
  const displayTitle = (item.title || '').replace('â†’', 'to').replace('→', 'to');

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <NodeWrapper
        type={item.type as any}
        time={item.startTime}
        endTime={item.endTime}
        isLast={isLast}
        onTimeChange={onTimeChange}
        itemId={item.id}
      >
        <div
          className="relative group"
          onMouseEnter={() => onHover?.(true)}
          onMouseLeave={() => onHover?.(false)}
        >
          {/* Hover Action overlay — absolutely positioned at top-right */}
          <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-paper-2/95 backdrop-blur-xs border border-line shadow-modal rounded-xl p-1 px-1.5 export-hidden">
            {moveDayOptions && currentDayId && onMoveToDay && (
              <MoveToDaySelect options={moveDayOptions} currentDayId={currentDayId} onMove={onMoveToDay} />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500 active:scale-95 cursor-pointer flex items-center justify-center"
              style={{ transition: `all var(--motion-hover) var(--ease-out)`, minWidth: 28, minHeight: 28 }}
              title={`Delete ${config.label}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
          {/* ── Boarding-pass card ────────────────────────────────────────── */}
          <div
            className={`flex items-stretch rounded-2xl overflow-hidden ${bookedAccentClass(item.blockStatus)}`}
            style={{
              background: config.accentBg,
              border: `1px solid ${config.accentBorder}`,
              boxShadow: 'var(--shadow-surface)',
              transition: `box-shadow var(--motion-card) var(--ease-out), transform var(--motion-card) var(--ease-out)`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-hover)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-surface)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {/* M8: Drag handle — left side, 44px min touch target (unified layout with GenericNode) */}
            <div
              {...attributes}
              {...listeners}
              className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center text-ink-400/30 transition-opacity hover:bg-black/5 hover:text-ink-500 hover:opacity-100 active:cursor-grabbing export-hidden"
              style={{ transition: `all var(--motion-hover) var(--ease-out)`, minHeight: 44 }}
              title="Drag to reorder"
            >
              <GripVertical size={13} />
            </div>

            {/* Clickable content */}
            <div
              onClick={onClick}
              {...clickableDivProps(onClick)}
              className={`flex flex-1 cursor-pointer flex-col gap-3 p-3.5 pl-1 ${FOCUS_RING_CLASS}`}
            >
              {/* Header row: label + transport type + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Mode icon — no background, pure icon for clean boarding-pass feel */}
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: config.accentBorder }}
                  >
                    {config.icon}
                  </div>
                  <div>
                    <p
                      className="text-[9px] font-bold uppercase tracking-[0.2em]"
                      style={{ color: config.accentText }}
                    >
                      {config.label}
                    </p>
                    <h4 className="text-[13px] font-semibold text-ink-900 tracking-tight leading-snug mt-0.5">
                      {displayTitle}
                    </h4>
                  </div>
                </div>


              </div>

              {/* ── Boarding pass departure → arrival ──────────────────── */}
              {/* H8: Solid white card with light semantic border for high contrast and luxury finish */}
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 border border-line/60">

                {/* Origin */}
                <div className="text-center min-w-[70px]">
                  <p
                    className={`font-bold text-ink-900 ${hasRealCodes ? 'text-[20px] tabular-nums tracking-tight' : 'text-[11px] leading-tight'}`}
                    title={origin}
                  >
                    {origin}
                  </p>
                  <p className="text-[10px] font-semibold tabular-nums text-ink-500 mt-0.5">
                    {item.startTime || 'TBD'}
                  </p>
                </div>

                {/* Animated route connector — the visual journey */}
                <div className="flex flex-1 flex-col items-center px-3 gap-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                    {distanceKm ? `${distanceKm.toFixed(1)} km · ` : ''}{legDuration ? `${legDuration}` : 'Direct'}
                  </p>
                  <div
                    className="relative w-full flex items-center justify-center"
                    style={{ height: 24 }}
                  >
                    {/* Dashed connector line */}
                    <div
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px"
                      style={{
                        backgroundImage: `repeating-linear-gradient(90deg, ${config.connectorColor} 0, ${config.connectorColor} 6px, transparent 6px, transparent 12px)`,
                      }}
                    />
                    {/* Mode icon centered on connector */}
                    <div
                      className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-surface"
                      style={{ border: `1px solid ${config.accentBorder}` }}
                    >
                      <div style={{ transform: 'scale(0.7)', color: config.accentText }}>
                        {config.icon}
                      </div>
                    </div>
                  </div>

                  {/* Price on connector */}
                  <p className="text-[10px] font-semibold tabular-nums text-ink-500">
                    {item.status === 'Confirmed'
                      ? (item.price || 'Price confirmed')
                      : (item.price ? `~${item.price}` : 'Check price')}
                    {(() => {
                      const conv = formatConvertedPrice(item.price);
                      return conv ? ` (${conv})` : '';
                    })()}
                  </p>
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    {routeProvenanceTier && (
                      <ProvenanceBadge provenance={{ tier: routeProvenanceTier, source: transportMeta.source_name, basis: transportMeta.provenance === 'estimated' ? 'geometric estimate, no confirmed schedule' : undefined }} />
                    )}
                    <p className="text-[8px] font-bold uppercase tracking-wide text-ink-400">
                      {transportMeta.booking_availability === 'available'
                        ? 'Availability verified'
                        : transportMeta.freshness === 'stale'
                          ? 'Stale reference — verify'
                          : 'Requires verification'}
                    </p>
                  </div>
                </div>

                {/* Destination */}
                <div className="text-center min-w-[70px]">
                  <p
                    className={`font-bold text-ink-900 ${hasRealCodes ? 'text-[20px] tabular-nums tracking-tight' : 'text-[11px] leading-tight'}`}
                    title={dest}
                  >
                    {dest}
                  </p>
                  <p className="text-[10px] font-semibold tabular-nums text-ink-500 mt-0.5">
                    {item.endTime || 'TBD'}
                  </p>
                </div>
              </div>

              {/* Footer: details + status */}
              <div className="flex items-center justify-between gap-4">
                {item.details ? (
                  <p className="text-[11px] font-medium text-ink-500 line-clamp-2 flex-1 leading-relaxed">
                    {item.details}
                  </p>
                ) : <div className="flex-1" />}

                <div className="shrink-0 export-hidden flex items-center gap-1.5">
                  <BookingStateChip status={item.blockStatus} />
                  <ProvenanceBadge provenance={item.cost?.provenance} />
                  {item.cost?.provenance?.tier !== 'verified' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onVerifyLivePrice?.(item.id); }}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold text-ink-600 border border-line bg-white hover:bg-paper-0 active:scale-95 cursor-pointer"
                      style={{ transition: `all var(--motion-hover) var(--ease-out)`, minHeight: 28 }}
                    >
                      Verify Price
                    </button>
                  )}
                  {onWatchPrice && item.blockStatus !== 'booked' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onWatchPrice(item.id); }}
                      title="Watch this price — I'll alert you if it drops"
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold text-violet-700 border border-violet-100 bg-violet-50 hover:bg-violet-100 active:scale-95 cursor-pointer"
                      style={{ transition: `all var(--motion-hover) var(--ease-out)`, minHeight: 28 }}
                    >
                      <Eye size={9} /> Watch
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </NodeWrapper>
    </div>
  );
}

function areEqual(prev: TransportNodeProps, next: TransportNodeProps): boolean {
  return (
    prev.item === next.item &&
    prev.isLast === next.isLast &&
    prev.currentDayId === next.currentDayId &&
    prev.moveDayOptions === next.moveDayOptions
  );
}

export default React.memo(TransportNode, areEqual);
