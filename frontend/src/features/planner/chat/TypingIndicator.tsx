import React from 'react';
import { Loader2 } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="mr-auto w-fit rounded-2xl border border-[#e5dfd2] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">NeuralNomad is thinking...</span>
      </div>
    </div>
  );
}
