'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plane, Sparkles, MapPin, CalendarDays, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlannerChatProps {
  onModeChange?: (mode: 'chat' | 'plan') => void;
}

export default function PlannerChat({ onModeChange }: PlannerChatProps) {
  const [query, setQuery] = useState('');

  const handleSuggestClick = (title: string) => {
    setQuery(title);
    if (onModeChange) onModeChange('plan');
  };

  const handleSubmit = () => {
    if (query.trim().length > 0 && onModeChange) {
      onModeChange('plan');
    }
  };

  const suggestions = [
    { icon: <MapPin size={18} />, title: 'Plan a weekend in Kyoto', desc: 'Temples, tea houses, and easy rail routes' },
    { icon: <CalendarDays size={18} />, title: '7-day itinerary for Switzerland', desc: 'Scenic Alps, trains, and hotel ideas' },
    { icon: <Plane size={18} />, title: 'Find flights to Bali', desc: 'Under Rs 30,000 next month' },
    { icon: <Sparkles size={18} />, title: 'Romantic getaway near me', desc: 'Quiet, premium, and low-friction' },
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(26,86,219,0.08),_transparent_32%),linear-gradient(180deg,#fbfaf7_0%,#f6f4ef_100%)]">
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-36 pt-16">
        <div className="mb-12 mt-10 flex w-full max-w-4xl flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#cfe0ff] bg-white text-blue-600 shadow-sm">
            <Plane size={32} strokeWidth={2} />
          </div>
          <h1 className="mb-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Build your next trip with intent
          </h1>
          <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
            Start with a destination, a mood, or a budget and shape it into a real itinerary.
          </p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
          {suggestions.map((item, idx) => (
            <motion.button
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleSuggestClick(item.title)}
              className="group flex items-start gap-4 rounded-2xl border border-[#ddd7ca] bg-white px-5 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#c7c0b1] hover:shadow-md"
            >
              <div className="mt-0.5 rounded-xl bg-[#f6f4ef] p-2 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                {item.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#f6f4ef] via-[#f6f4ef]/95 to-transparent px-6 pb-8 pt-12">
        <div className="group relative mx-auto w-full max-w-4xl">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask NeuralNomad to shape a trip, compare options, or map a route"
            className="custom-scrollbar min-h-[72px] max-h-[200px] w-full resize-none rounded-[28px] border border-[#d9d4c7] bg-white py-5 pl-6 pr-16 text-base text-slate-900 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)] transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
          <button
            onClick={handleSubmit}
            className={cn(
              'absolute bottom-4 right-4 rounded-2xl p-2.5 transition-all',
              query.trim().length > 0
                ? 'bg-slate-900 text-white shadow-md hover:bg-slate-800'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            )}
            disabled={query.trim().length === 0}
          >
            <ArrowUp size={20} strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          NeuralNomad can make mistakes. Please verify important travel details.
        </p>
      </div>
    </div>
  );
}
