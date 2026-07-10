import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { ItineraryItem } from '../types';

interface DeletingNodeProps {
  item: ItineraryItem;
  onUndo: () => void;
  onExpire: () => void;
}

export default function DeletingNode({ item, onUndo, onExpire }: DeletingNodeProps) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire();
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft, onExpire]);

  return (
    <div className="relative my-2 pl-[70px] pr-4">
      {/* Connector lines to keep timeline flow */}
      <div className="absolute left-[38px] top-0 h-1/2 w-1 bg-slate-200/50" />
      <div className="absolute bottom-0 left-[38px] h-1/2 w-1 bg-slate-200/50" />
      <div className="absolute left-[32px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-rose-300 bg-white shadow-xs flex items-center justify-center">
        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[16px] border border-dashed border-rose-200 bg-rose-50/10 p-3.5 backdrop-blur-xs transition-all hover:bg-rose-50/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-500">
            <RotateCcw size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div className="min-w-0">
            <h5 className="text-sm font-bold text-slate-800 truncate">Removed &quot;{item.title}&quot;</h5>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Disappearing in {secondsLeft}s...</p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUndo();
          }}
          className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 shadow-xs hover:bg-rose-50 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        >
          <RotateCcw size={12} />
          Undo
        </button>
      </div>
    </div>
  );
}
