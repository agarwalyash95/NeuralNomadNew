import React, { useState } from 'react';
import { Star, MapPin, Trash2, GripVertical } from 'lucide-react';
import { ItineraryItem } from '../types';
import { getCategoryStyle } from '../utils/categoryStyle';
import NodeWrapper from './NodeWrapper';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatConvertedPrice } from '../utils/routeOptimizer';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import { BookingStateChip, bookedAccentClass } from '@/features/planner/components/BookingStateChip';
import MoveToDaySelect, { DayOption } from './MoveToDaySelect';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface GenericNodeProps {
  item: ItineraryItem;
  isLast?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  onHover?: (isHovered: boolean) => void;
  onVerifyLivePrice?: (itemId: string) => void;
  onTimeChange?: (field: 'start' | 'end', value: string) => void;
  moveDayOptions?: DayOption[];
  currentDayId?: string;
  onMoveToDay?: (dayId: string) => void;
}

/** Category image sizes — photography hierarchy:
 *  Hotels/attractions: 28% (hero)
 *  Food: 22% (thumbnail)
 *  Others: no image panel override
 */
function getImagePanelWidth(type: string): string {
  if (type === 'hotel' || type === 'attraction') return 'w-[28%]';
  if (type === 'food') return 'w-[22%]';
  return 'w-1/4';
}

function GenericNode({ item, isLast, onClick, onRemove, onHover, onVerifyLivePrice, onTimeChange, moveDayOptions, currentDayId, onMoveToDay }: GenericNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const imgWidth = getImagePanelWidth(item.type);

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
        className="relative rounded-2xl border-2 border-dashed border-line bg-paper-0 min-h-[100px] w-full mb-3"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <NodeWrapper type={item.type} time={item.startTime} endTime={item.endTime} isLast={isLast} onTimeChange={onTimeChange} itemId={item.id}>
        <div
          className="relative group"
          onMouseEnter={() => {
            setIsHovered(true);
            onHover?.(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
            onHover?.(false);
          }}
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
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
          {/* ── Travel card — one canonical style ───────────────────── */}
          <div
            className={`travel-card flex items-stretch overflow-hidden ${bookedAccentClass(item.blockStatus)}`}
            style={{
              boxShadow: isHovered ? 'var(--shadow-hover)' : 'var(--shadow-surface)',
              transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
              transition: `box-shadow var(--motion-card) var(--ease-out), transform var(--motion-card) var(--ease-out)`,
            }}
          >
            {/* Drag handle — 44px min touch target */}
            <div
              {...attributes}
              {...listeners}
              className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center text-ink-400/40 transition-opacity hover:bg-paper-0 hover:text-ink-500 hover:opacity-100 active:cursor-grabbing export-hidden"
              style={{ transition: `all var(--motion-hover) var(--ease-out)`, minHeight: 44 }}
              title="Drag to reorder"
            >
              <GripVertical size={13} />
            </div>

            {/* ── Clickable content ─────────────────────────────────── */}
            <div
              onClick={onClick}
              {...clickableDivProps(onClick)}
              className={`flex flex-1 min-w-0 cursor-pointer items-stretch justify-between gap-3 p-3 pl-1 ${FOCUS_RING_CLASS}`}
            >
              <div className="flex flex-1 min-w-0 gap-3 items-stretch">

                {/* ── Hero image — photography hierarchy ─────────── */}
                {Boolean(item.image || ['hotel', 'attraction', 'food'].includes(item.type)) && (
                  <div
                    className={`${imgWidth} shrink-0 relative overflow-hidden rounded-xl min-h-[88px]`}
                    style={{ background: 'rgb(var(--paper-0))' }}
                  >
                    {item.image ? (
                      <>
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 25vw, 15vw"
                        />
                        {/* Atmosphere gradient overlay — subtle destination tint */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                      </>
                    ) : (
                      /* Atmospheric fallback — category gradient, not generic grey */
                      <div
                        className="flex items-center justify-center h-full w-full"
                        style={{
                          background: `linear-gradient(135deg, rgb(var(--dest-accent) / 0.08) 0%, rgb(var(--dest-accent) / 0.04) 100%)`,
                        }}
                      >
                        {(() => {
                          const style = getCategoryStyle(item.type);
                          const CategoryIcon = style.icon;
                          return <CategoryIcon size={24} className={`${style.text} opacity-50`} />;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Info — right side ─────────────────────────── */}
                <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[14px] font-semibold text-ink-900 tracking-tight truncate leading-snug">
                        {item.title}
                      </h4>
                      {item.rating ? (
                        <div className="flex items-center shrink-0 gap-0.5">
                          <Star size={10} className="text-amber-400" fill="currentColor" />
                          <span className="text-[10px] font-semibold text-ink-600 tabular-nums">
                            {item.rating}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-500 font-medium">
                      {item.geoTag && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} className="text-ink-400/70 shrink-0" />
                          {item.geoTag}
                        </span>
                      )}
                      {item.geoTag && item.subtitle && (
                        <span className="text-line-strong">·</span>
                      )}
                      {item.subtitle && (
                        <span className="text-ink-400">{item.subtitle}</span>
                      )}
                    </div>

                    {item.details ? (
                      <p className="mt-1.5 text-[11px] text-ink-500 line-clamp-2 leading-relaxed">
                        {item.details}
                      </p>
                    ) : null}

                    {/* AI Tip — violet semantic, not blue */}
                    {item.aiTip && (
                      <div
                        className="mt-2 flex items-start gap-1.5 rounded-xl p-2 text-[10px] font-medium leading-relaxed border"
                        style={{
                          background: 'rgb(139 92 246 / 0.05)',
                          borderColor: 'rgb(139 92 246 / 0.15)',
                          color: 'rgb(109 40 217)',
                        }}
                      >
                        <span className="shrink-0 mt-0.5">✦</span>
                        <p>{item.aiTip}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Price + actions — right side ─────────────────────── */}
              <div className={`flex flex-col items-end justify-between shrink-0 pl-1 ${item.price ? 'min-w-[60px]' : ''}`}>
                {item.price ? (
                  <div className="text-right">
                    <p className="text-[13px] font-semibold tabular-nums text-ink-900">
                      {item.status === 'Confirmed' ? item.price : `~${item.price}`}
                    </p>
                    {(() => {
                      const conv = formatConvertedPrice(item.price);
                      return conv ? (
                        <p className="text-[10px] font-medium tabular-nums text-ink-400 mt-0.5">
                          {item.status === 'Confirmed' ? `(${conv})` : `~(${conv})`}
                        </p>
                      ) : null;
                    })()}

                    {(() => {
                      const showChip = item.blockStatus && ['priced', 'booked'].includes(item.blockStatus);
                      const showProvenance = item.cost?.provenance?.tier;
                      const showVerify = ['hotel', 'flight', 'train', 'bus', 'taxi'].includes(item.type) &&
                        item.cost?.provenance?.tier !== 'verified';
                      
                      if (!showChip && !showProvenance && !showVerify) return null;
                      return (
                        <div className="mt-2 export-hidden flex flex-col items-end gap-1">
                          <BookingStateChip status={item.blockStatus} />
                          <ProvenanceBadge provenance={item.cost?.provenance} />
                          {showVerify && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onVerifyLivePrice?.(item.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold border cursor-pointer active:scale-95"
                              style={{
                                transition: `all var(--motion-hover) var(--ease-out)`, minHeight: 28,
                                color: 'rgb(var(--color-booking))',
                                borderColor: 'rgb(var(--color-booking) / 0.35)',
                                background: 'rgb(var(--color-booking) / 0.06)',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgb(var(--color-booking) / 0.12)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgb(var(--color-booking) / 0.06)'; }}
                            >
                              Verify Price
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {(item.type === 'attraction' || item.type === 'activity') && (
                      <div className="mt-1.5 export-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClick?.();
                          }}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold border cursor-pointer active:scale-95"
                          style={{
                            transition: `all var(--motion-hover) var(--ease-out)`,
                            color: 'rgb(var(--color-ai))',
                            borderColor: 'rgb(var(--color-ai) / 0.3)',
                            background: 'rgb(var(--color-ai) / 0.06)',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgb(var(--color-ai) / 0.12)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgb(var(--color-ai) / 0.06)'; }}
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                ) : <div />}

                {/* Spacer */}
                <div className="mt-auto" />
              </div>
            </div>
          </div>
        </div>
      </NodeWrapper>
    </div>
  );
}

function areEqual(prev: GenericNodeProps, next: GenericNodeProps): boolean {
  return (
    prev.item === next.item &&
    prev.isLast === next.isLast &&
    prev.currentDayId === next.currentDayId &&
    prev.moveDayOptions === next.moveDayOptions
  );
}

export default React.memo(GenericNode, areEqual);
