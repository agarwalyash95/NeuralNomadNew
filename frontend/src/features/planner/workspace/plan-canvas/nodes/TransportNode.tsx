import React from 'react';
import { Trash2, Plane, Train, Bus, Car, Eye, GripVertical } from 'lucide-react';
import { ItineraryItem } from '../types';
import NodeWrapper from './NodeWrapper';
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
  /** Starts a standing price watch — findings arrive later as proposals */
  onWatchPrice?: (itemId: string) => void;
  onTimeChange?: (field: 'start' | 'end', value: string) => void;
  moveDayOptions?: DayOption[];
  currentDayId?: string;
  onMoveToDay?: (dayId: string) => void;
}

/**
 * TransportNode — specialized node for in-day transport items.
 * Handles: flight | train | bus | cab
 * Renders a departure/arrival pill layout with an icon that switches by type.
 *
 * (Previously FlightNode — merged so all transit types share one premium layout)
 */
function TransportNode({ item, isLast, onClick, onRemove, onHover, onVerifyLivePrice, onWatchPrice, onTimeChange, moveDayOptions, currentDayId, onMoveToDay }: TransportNodeProps) {
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
        className="relative rounded-[20px] border-2 border-dashed border-slate-300 bg-slate-100/30 min-h-[141px] w-full mb-3"
      />
    );
  }

  // ── Icon + Color scheme by type ────────────────────────────
  const typeConfig = {
    flight: {
      icon: <Plane size={16} fill="currentColor" />,
      gradient: 'from-violet-50/80 to-violet-100/40 border-violet-200',
      iconBg: 'bg-violet-100 text-violet-600',
      lineColor: 'border-violet-200',
      iconOverlay: <Plane size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-400" />,
      label: 'Flight',
      accentText: 'text-violet-600',
    },
    train: {
      icon: <Train size={16} fill="currentColor" />,
      gradient: 'from-blue-50/80 to-blue-100/40 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-600',
      lineColor: 'border-blue-200',
      iconOverlay: <Train size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400" />,
      label: 'Train',
      accentText: 'text-blue-600',
    },
    bus: {
      icon: <Bus size={16} fill="currentColor" />,
      gradient: 'from-sky-50/80 to-sky-100/40 border-sky-200',
      iconBg: 'bg-sky-100 text-sky-600',
      lineColor: 'border-sky-200',
      iconOverlay: <Bus size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sky-400" />,
      label: 'Bus',
      accentText: 'text-sky-600',
    },
    cab: {
      icon: <Car size={16} fill="currentColor" />,
      gradient: 'from-amber-50/80 to-amber-100/40 border-amber-200',
      iconBg: 'bg-amber-100 text-amber-600',
      lineColor: 'border-amber-200',
      iconOverlay: <Car size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400" />,
      label: 'Cab',
      accentText: 'text-amber-600',
    },
  };

  const config = typeConfig[item.type as keyof typeof typeConfig] ?? typeConfig.flight;

  // Real codes only for flight/train, and only when the block actually
  // carries them — a truncated city name is not an airport/station code
  // (this used to render "Manali" as "MAN", Manchester's IATA code).
  // Bus/cab never had codes to begin with; always shown as city names.
  const hasRealCodes = (item.type === 'flight' || item.type === 'train') && Boolean(item.originCode && item.destinationCode);
  const titleParts = (item.subtitle || item.title || '').split(' to ');
  const originCity = titleParts[0]?.trim() || 'Origin';
  const destCity = titleParts[1]?.trim() || 'Destination';
  const origin = hasRealCodes ? item.originCode! : originCity;
  const dest = hasRealCodes ? item.destinationCode! : destCity;

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <NodeWrapper type={item.type as any} time={item.startTime} endTime={item.endTime} isLast={isLast} onTimeChange={onTimeChange}>
        <div 
          className="relative group"
          onMouseEnter={() => onHover?.(true)}
          onMouseLeave={() => onHover?.(false)}
        >
          <div
            className={`group flex flex-col rounded-[20px] border bg-gradient-to-br ${config.gradient} ${bookedAccentClass(item.blockStatus)} shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden`}
          >
            {/* Dedicated drag handle strip — see GenericNode for why this
                moved off the whole-card listeners. */}
            <div
              {...attributes}
              {...listeners}
              className="flex h-4 w-full shrink-0 cursor-grab touch-none items-center justify-center text-slate-400/60 opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 active:cursor-grabbing export-hidden"
              title="Drag to reorder"
            >
              <GripVertical size={12} className="rotate-90" />
            </div>

            <div onClick={onClick} {...clickableDivProps(onClick)} className={`flex cursor-pointer flex-col gap-4 rounded-b-[16px] p-4 px-5 pt-1 ${FOCUS_RING_CLASS}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${config.iconBg}`}>
                  {config.icon}
                </div>
                <div>
                  <p className={`text-[11px] font-extrabold uppercase tracking-[0.25em] ${config.accentText}`}>
                    {item.subtitle || config.label}
                  </p>
                  <h4 className="mt-0.5 text-lg font-bold text-slate-900 tracking-tight">{item.title}</h4>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 export-hidden">
                {moveDayOptions && currentDayId && onMoveToDay && (
                  <MoveToDaySelect options={moveDayOptions} currentDayId={currentDayId} onMove={onMoveToDay} />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                  className="rounded-xl bg-rose-50 p-2 text-rose-500 border border-rose-100/80 shadow-xs hover:bg-rose-100 hover:text-rose-600 active:scale-95 transition-all cursor-pointer"
                  title={`Delete ${config.label}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Departure → Arrival pill */}
            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3 px-4 shadow-sm backdrop-blur-sm border border-white">
              <div className="text-center max-w-[90px]">
                <p className={hasRealCodes ? 'text-lg font-bold text-slate-900' : 'text-xs font-bold text-slate-900 truncate'} title={origin}>{origin}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.startTime || 'TBD'}</p>
              </div>

              <div className="flex flex-1 flex-col items-center px-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Direct</p>
                <div className={`relative my-1.5 w-full border-t-[1.5px] border-dashed ${config.lineColor}`}>
                  {config.iconOverlay}
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {item.status === 'Confirmed' ? (item.price || 'Check Price') : (item.price ? `approx. ${item.price}` : 'Check Price')}
                  {(() => {
                    const conv = formatConvertedPrice(item.price);
                    return conv ? (item.status === 'Confirmed' ? ` (${conv})` : ` approx. (${conv})`) : '';
                  })()}
                </p>
              </div>

              <div className="text-center max-w-[90px]">
                <p className={hasRealCodes ? 'text-lg font-bold text-slate-900' : 'text-xs font-bold text-slate-900 truncate'} title={dest}>{dest}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.endTime || 'TBD'}</p>
              </div>
            </div>

            {/* Details footer & Live Price Verification */}
            <div className="flex items-center justify-between gap-4 mt-1">
              {item.details ? (
                <p className="text-[11px] font-medium text-slate-600 truncate flex-1">{item.details}</p>
              ) : <div className="flex-1" />}
              
              <div className="shrink-0 export-hidden flex items-center gap-1.5">
                <BookingStateChip status={item.blockStatus} />
                <ProvenanceBadge provenance={item.cost?.provenance} />
                {item.cost?.provenance?.tier !== 'verified' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onVerifyLivePrice) {
                        onVerifyLivePrice(item.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 shadow-xs cursor-pointer"
                  >
                    Verify Live Price
                  </button>
                )}
                {onWatchPrice && item.blockStatus !== 'booked' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWatchPrice(item.id);
                    }}
                    title="I'll re-check this price daily and tell you if it drops"
                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 hover:bg-violet-100 active:scale-95 transition-all px-2.5 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-100 shadow-xs cursor-pointer"
                  >
                    <Eye size={10} />
                    Watch
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

// See GenericNode.tsx for why this ignores callback-prop identity: the
// parent recreates every closure each render, so a plain memo never bails.
function areEqual(prev: TransportNodeProps, next: TransportNodeProps): boolean {
  return (
    prev.item === next.item &&
    prev.isLast === next.isLast &&
    prev.currentDayId === next.currentDayId &&
    prev.moveDayOptions === next.moveDayOptions
  );
}

export default React.memo(TransportNode, areEqual);
