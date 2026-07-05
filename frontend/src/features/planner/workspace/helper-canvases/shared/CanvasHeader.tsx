'use client';

import React from 'react';
import { X } from 'lucide-react';
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
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Icon + Label + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColor} text-white`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <h2 className="text-sm font-semibold text-slate-900 truncate">{title}</h2>
          </div>
        </div>

        {/* Right: Trip context badge + close */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {tripContext?.destination && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              <span>📍</span>
              <span>{tripContext.destination}</span>
              {tripContext.travellers > 1 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{tripContext.travellers} pax</span>
                </>
              )}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
