'use client';

import React from 'react';
import { X, MapPin } from 'lucide-react';
import { TripContext } from '../../types';

interface CanvasHeaderProps {
  /** Icon element (e.g. <Plane size={18} />) */
  icon: React.ReactNode;
  /** Accent color class for the icon bg (e.g. "bg-blue-600") */
  iconColor: string;
  /** Small label above title (e.g. "Flights") */
  label: string;
  /** Main title (e.g. "Delhi → Manali") */
  title: string;
  /** Trip context — used to render the trip badge */
  tripContext?: TripContext;
  onClose?: () => void;
}

/**
 * Shared header used by every Helper Canvas.
 * Shows: icon, label, title, optional trip context badge, close button.
 */
export default function CanvasHeader({
  icon,
  iconColor,
  label,
  title,
  tripContext,
  onClose,
}: CanvasHeaderProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-line bg-paper-2 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: icon + label share one line, title directly below —
            same information as before, one stacked row saved. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${iconColor} text-white [&>svg]:h-3.5 [&>svg]:w-3.5`}>
              {icon}
            </div>
            <p className="truncate text-micro">{label}</p>
          </div>
          <h2 className="mt-0.5 truncate text-title">{title}</h2>
        </div>

        {/* Right: Trip context badge + close */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {tripContext?.destination && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-line bg-paper-1 px-2.5 py-1 text-caption font-semibold">
              <MapPin size={11} />
              <span>{tripContext.destination}</span>
              {tripContext.travellers > 1 && (
                <>
                  <span className="text-ink-400">•</span>
                  <span>{tripContext.travellers} pax</span>
                </>
              )}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-ink-400 transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)] hover:bg-paper-1 hover:text-ink-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
