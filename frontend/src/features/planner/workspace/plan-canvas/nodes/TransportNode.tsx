import React from 'react';
import { Trash2, Plane, Train, Bus, Car } from 'lucide-react';
import { ItineraryItem } from '../mockData';
import NodeWrapper from './NodeWrapper';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TransportNodeProps {
  item: ItineraryItem;
  isLast?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  onHover?: (isHovered: boolean) => void;
}

/**
 * TransportNode — specialized node for in-day transport items.
 * Handles: flight | train | bus | cab
 * Renders a departure/arrival pill layout with an icon that switches by type.
 *
 * (Previously FlightNode — merged so all transit types share one premium layout)
 */
export default function TransportNode({ item, isLast, onClick, onRemove, onHover }: TransportNodeProps) {
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
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 1,
  };

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

  // Parse "Origin to Destination" from subtitle or title
  let origin = 'DEP';
  let dest = 'ARR';
  const titleParts = (item.subtitle || item.title || '').split(' to ');
  if (titleParts.length >= 2 && titleParts[0] && titleParts[1]) {
    origin = titleParts[0].substring(0, 3).toUpperCase();
    dest = titleParts[1].substring(0, 3).toUpperCase();
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <NodeWrapper type={item.type as any} time={item.startTime} endTime={item.endTime} isLast={isLast}>
        <div
          className="relative group"
          onMouseEnter={() => onHover?.(true)}
          onMouseLeave={() => onHover?.(false)}
        >
          <div
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`group flex cursor-pointer flex-col gap-4 rounded-[20px] border bg-gradient-to-br ${config.gradient} p-4 px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md touch-none`}
          >
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
              <button
                onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                className="rounded-xl bg-rose-50 p-2 text-rose-500 border border-rose-100/80 shadow-xs hover:bg-rose-100 hover:text-rose-600 active:scale-95 transition-all cursor-pointer shrink-0"
                title={`Delete ${config.label}`}
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Departure → Arrival pill */}
            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3 px-4 shadow-sm backdrop-blur-sm border border-white">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900">{origin}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.startTime || 'TBD'}</p>
              </div>

              <div className="flex flex-1 flex-col items-center px-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Direct</p>
                <div className={`relative my-1.5 w-full border-t-[1.5px] border-dashed ${config.lineColor}`}>
                  {config.iconOverlay}
                </div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.price || 'Check Price'}</p>
              </div>

              <div className="text-center">
                <p className="text-lg font-bold text-slate-900">{dest}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.endTime || 'TBD'}</p>
              </div>
            </div>

            {/* Details footer */}
            {item.details && (
              <div className="flex items-center gap-2">
                <div className="flex h-5 items-center rounded bg-emerald-100/80 px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {item.status}
                </div>
                <p className="text-[11px] font-medium text-slate-600">{item.details}</p>
              </div>
            )}
          </div>
        </div>
      </NodeWrapper>
    </div>
  );
}
