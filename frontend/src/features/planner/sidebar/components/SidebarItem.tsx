import React from 'react';
import { Trash2 } from 'lucide-react';
import { cn, clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  dateStr?: string;
  status: string;
  /** One-line hint: what this trip needs from the user next */
  hint?: string;
  isModified?: boolean;
  isActive?: boolean;
  showStatusBadge?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

export function SidebarItem({
  icon,
  label,
  dateStr,
  status,
  hint,
  isModified = false,
  isActive = false,
  showStatusBadge = true,
  onClick,
  onDelete,
}: SidebarItemProps) {

  // Render luxury-style pill badges
  const getStatusBadge = () => {
    if (!showStatusBadge) return null;

    if (isModified) {
      return (
        <span className="text-[8px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800 border border-amber-300/40 px-1.5 py-0.5 rounded-md shadow-3xs motion-safe:animate-pulse">
          Modified
        </span>
      );
    }

    switch (status) {
      case 'booked':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/40 px-1.5 py-0.5 rounded-md">
            Booked
          </span>
        );
      case 'saved':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/40 px-1.5 py-0.5 rounded-md">
            Saved
          </span>
        );
      case 'draft':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-slate-100/90 text-slate-600 border border-slate-200/40 px-1.5 py-0.5 rounded-md">
            Draft
          </span>
        );
      case 'active':
      default:
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase bg-amber-50 text-amber-700 border border-amber-200/40 px-1.5 py-0.5 rounded-md">
            Plan Ready
          </span>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      {...clickableDivProps(onClick)}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left cursor-pointer transition-all duration-300",
        FOCUS_RING_CLASS,
        isActive
          ? "bg-white border border-[#d3cbbe] shadow-[0_6px_16px_-4px_rgba(139,124,103,0.12)] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:rounded-r-md before:bg-[#bfa780]"
          : "bg-white/45 border border-[#e8e3d5]/30 hover:bg-white/85 hover:border-line-strong hover:shadow-[0_4px_12px_rgba(139,124,103,0.04)]"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 shadow-sm shrink-0",
          isActive
            ? "bg-[#bfa780] text-white shadow-[0_2px_8px_rgba(191,167,128,0.25)] border border-[#bfa780]"
            : "bg-white border border-[#e8e3d5]/60 text-ink-500 group-hover:text-slate-800 group-hover:bg-white group-hover:border-line-strong"
        )}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1 pr-6">
        <p
          className={cn(
            "truncate text-xs leading-tight transition-colors duration-200",
            isActive ? "text-slate-900 font-bold" : "text-slate-600 font-semibold group-hover:text-slate-900"
          )}
        >
          {label}
        </p>

        <div className="mt-1 flex items-center gap-1.5">
          {getStatusBadge()}
          {dateStr && (
            <span className="text-[9px] text-[#9c958a] font-medium">
              • {dateStr}
            </span>
          )}
        </div>

        {hint && (
          <p className="mt-0.5 truncate text-[10px] font-medium text-[#9c958a]">
            {hint}
          </p>
        )}
      </div>

      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-600 rounded-lg group-hover:opacity-100 focus:opacity-100"
          title="Delete Plan"
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
