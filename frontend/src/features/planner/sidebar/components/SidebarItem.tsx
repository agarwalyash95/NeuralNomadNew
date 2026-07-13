import React from 'react';
import { Trash2 } from 'lucide-react';
import { cn, clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  dateStr?: string;
  status: string;
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

  const getStatusBadge = () => {
    if (!showStatusBadge) return null;

    if (isModified) {
      return (
        <span className="text-[8px] font-bold tracking-wider uppercase text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
          Modified
        </span>
      );
    }

    switch (status) {
      case 'booked':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 rounded-md">
            Booked
          </span>
        );
      case 'saved':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase text-emerald-600 bg-emerald-50/70 border border-emerald-200/40 px-1.5 py-0.5 rounded-md">
            Saved
          </span>
        );
      case 'draft':
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase text-ink-400 bg-paper-1 border border-line/60 px-1.5 py-0.5 rounded-md">
            Draft
          </span>
        );
      case 'active':
      default:
        return (
          <span className="text-[8px] font-bold tracking-wider uppercase text-amber-700 bg-amber-50/80 border border-amber-200/40 px-1.5 py-0.5 rounded-md">
            In Progress
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
        "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left cursor-pointer",
        "transition-all",
        FOCUS_RING_CLASS,
        isActive
          ? "bg-white shadow-surface before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[2.5px] before:rounded-r-full before:bg-[rgb(var(--color-journey))]"
          : "hover:bg-paper-1/80"
      )}
      style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
          isActive
            ? 'bg-[rgb(var(--color-journey)/0.18)] text-ink-700'
            : 'text-ink-400 group-hover:text-ink-700'
        )}
      >
        {icon}
      </div>

      {/* Content — one denser metadata line (badge · date · hint) instead of
          three stacked rows, so the row reads at a glance without stacking
          height on a narrow 256px column. */}
      <div className="min-w-0 flex-1 pr-6">
        <p
          className={cn(
            'truncate text-[12px] leading-tight',
            isActive
              ? 'text-ink-900 font-semibold'
              : 'text-ink-600 font-medium group-hover:text-ink-900'
          )}
        >
          {label}
        </p>

        <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
          {getStatusBadge()}
          {dateStr && (
            <span className="shrink-0 text-[9px] text-ink-400 font-medium">
              {dateStr}
            </span>
          )}
          {hint && (
            <>
              {(dateStr || getStatusBadge()) && <span className="shrink-0 text-ink-300">·</span>}
              <span className="truncate text-[9px] font-medium text-ink-400">{hint}</span>
            </>
          )}
        </div>
      </div>

      {/* Delete — low-emphasis but always present, not hover-only (hover-only
          affordances are unreachable on touch devices) */}
      {onDelete && (
        <button
          onClick={onDelete}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'flex h-6 w-6 items-center justify-center rounded-lg',
            'text-ink-400 opacity-40 group-hover:opacity-100 focus-visible:opacity-100',
            'hover:bg-red-50 hover:text-red-500',
            'transition-opacity'
          )}
          style={{ transition: `opacity var(--motion-hover) var(--ease-out)` }}
          title="Delete Plan"
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
