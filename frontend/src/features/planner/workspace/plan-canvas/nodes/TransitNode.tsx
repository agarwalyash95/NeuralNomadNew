import React from 'react';
import { Train, Plane, Bus, Trash2, ArrowLeftRight } from 'lucide-react';
import { ItineraryItem } from '../types';
import Image from 'next/image';
import { formatConvertedPrice } from '../utils/routeOptimizer';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import { BookingStateChip, bookedAccentClass } from '@/features/planner/components/BookingStateChip';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface TransitNodeProps {
  item: ItineraryItem;
  onClick?: () => void;
  onHover?: (isHovered: boolean) => void;
  onRemove?: () => void;
  onVerifyLivePrice?: (itemId: string) => void;
  /** Opens the flight/train/bus/cab mode comparison for this leg */
  onCompare?: () => void;
}

// Previously the thinnest card in the app — image, title, subtitle only, no
// price or trust signal on the single most expensive block type in a trip
// (inter-city flights/trains/buses). See docs/travel-intelligence-implementation-roadmap.md §2.4.
function TransitNode({ item, onClick, onHover, onRemove, onVerifyLivePrice, onCompare }: TransitNodeProps) {
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
    <div className="relative mb-2 mt-2 py-4 pl-[70px] pr-4">
      <div className="absolute left-[38px] top-0 h-1/2 w-1 bg-ink-900" />
      <div className="absolute bottom-0 left-[38px] h-1/2 w-1 bg-ink-900" />

      <div className="absolute left-[24px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink-900 text-white shadow-md">
        {getIcon()}
      </div>

      <div
        onClick={onClick}
        {...clickableDivProps(onClick)}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        className={`flex group cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-sky-200 bg-gradient-to-br from-sky-50/80 to-sky-100/40 ${bookedAccentClass(item.blockStatus)} p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${FOCUS_RING_CLASS}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {item.image ? (
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl shadow-sm border border-white/50">
              <Image src={item.image} alt={item.title} fill className="object-cover" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-sky-600">Transit</p>
            <h4 className="mt-1 text-lg font-bold text-ink-900 tracking-tight">{item.title}</h4>
            <p className="mt-0.5 text-xs font-medium text-ink-600">{item.subtitle}</p>
            {item.details ? <p className="mt-1.5 text-xs font-semibold text-sky-700">{item.details}</p> : null}
          </div>
        </div>

        <div className="flex flex-col items-end justify-between shrink-0 gap-2">
          <div className="text-right">
            {item.price && (
              <>
                <p className="text-sm font-bold text-ink-900">
                  {item.status === 'Confirmed' ? item.price : `approx. ${item.price}`}
                </p>
                {(() => {
                  const conv = formatConvertedPrice(item.price);
                  return conv ? (
                    <p className="text-[10px] font-bold text-ink-400 mt-0.5">
                      {item.status === 'Confirmed' ? `(${conv})` : `approx. (${conv})`}
                    </p>
                  ) : null;
                })()}
              </>
            )}
            <div className="mt-1.5 export-hidden flex flex-col items-end gap-1">
              <BookingStateChip status={item.blockStatus} />
              {item.price && <ProvenanceBadge provenance={item.cost?.provenance} />}
              {item.price && item.cost?.provenance?.tier !== 'verified' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyLivePrice?.(item.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-100 shadow-xs cursor-pointer"
                >
                  Verify Price
                </button>
              )}
              {onCompare && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCompare(); }}
                  title="Compare flight/train/bus/cab for this leg"
                  className="inline-flex items-center gap-1 rounded-full bg-paper-0 hover:bg-paper-1 active:scale-95 transition-all px-2 py-0.5 text-[9px] font-bold text-ink-700 border border-line shadow-xs cursor-pointer"
                >
                  <ArrowLeftRight size={9} />
                  Compare
                </button>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
            className="rounded-xl bg-rose-50 p-2 text-rose-500 border border-rose-100/80 shadow-xs hover:bg-rose-100 hover:text-rose-600 active:scale-95 transition-all cursor-pointer export-hidden opacity-0 group-hover:opacity-100 focus:opacity-100 focus-within:opacity-100 duration-200"
            title="Delete Transit"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// See GenericNode.tsx for why this ignores callback-prop identity: the
// parent recreates every closure each render, so a plain memo never bails.
function areEqual(prev: TransitNodeProps, next: TransitNodeProps): boolean {
  return prev.item === next.item && Boolean(prev.onCompare) === Boolean(next.onCompare);
}

export default React.memo(TransitNode, areEqual);
