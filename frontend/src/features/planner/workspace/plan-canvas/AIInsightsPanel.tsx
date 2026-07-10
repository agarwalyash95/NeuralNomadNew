'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Compass, 
  MapPin, 
  Star, 
  Sparkles, 
  AlertCircle, 
  Clock, 
  Plane, 
  Home, 
  Utensils, 
  Camera, 
  Car, 
  Train, 
  Bus
} from 'lucide-react';

import { ItineraryItem } from './types';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import RichHoverCard from './RichHoverCard';

interface AIInsightsPanelProps {
  item: ItineraryItem | null;
  onSwapItem?: (newItem: ItineraryItem) => void;
  /** Opens the matching Helper Canvas to search real alternatives */
  onExplore?: (item: ItineraryItem) => void;
}

export default function AIInsightsPanel({ item, onSwapItem, onExplore }: AIInsightsPanelProps) {
  if (!item) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-paper-1">
        <Compass size={40} className="text-slate-300 animate-pulse mb-3" />
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">No Item Selected</h4>
        <p className="mt-1 max-w-xs text-xs text-slate-400">Hover over any itinerary item on the left to instantly reveal smart AI insights and coordinates details.</p>
      </div>
    );
  }

  // Only real, pre-computed insights are shown — we never invent alternatives
  const cachedInsights = (item as any)?._aiInsights;

  const candidates: ItineraryItem[] = cachedInsights?.candidates
    ? cachedInsights.candidates.map((c: any) => ({
        id: c.id || `candidate-${c.title}-${item.id}`,
        type: item.type,
        title: c.title,
        subtitle: c.subtitle || '',
        price: c.price,
        rating: c.rating,
        status: 'Pending',
        aiTip: c.aiTip,
        latitude: c.latitude,
        longitude: c.longitude,
      }))
    : [];


  // Derive styles and icons based on item type
  const getCategoryTheme = () => {
    switch (item.type as string) {
      case 'flight':
        return {
          icon: <Plane size={18} className="text-indigo-600" />,
          badgeBg: 'bg-indigo-50 border-indigo-100 text-indigo-700',
          gradient: 'from-indigo-50/20 to-indigo-100/10',
          cardBorder: 'border-indigo-100',
          focusColor: 'text-indigo-600',
          localTip: 'Carry a printed copy of your ticket for easy entry at Indian airports. Bag drop lines can get extremely long during holiday weekends.'
        };
      case 'hotel':
        return {
          icon: <Home size={18} className="text-violet-600" />,
          badgeBg: 'bg-violet-50 border-violet-100 text-violet-700',
          gradient: 'from-violet-50/20 to-violet-100/10',
          cardBorder: 'border-violet-100',
          focusColor: 'text-violet-600',
          localTip: 'Physical Aadhaar card or Voter ID is highly recommended for check-ins in India. Ensure your stay has hot water and room heating, especially in northern regions.'
        };
      case 'food':
        return {
          icon: <Utensils size={18} className="text-orange-600" />,
          badgeBg: 'bg-orange-50 border-orange-100 text-orange-700',
          gradient: 'from-orange-50/20 to-orange-100/10',
          cardBorder: 'border-orange-100',
          focusColor: 'text-orange-600',
          localTip: 'Most riverside cafes accept GPay/UPI, but connection is highly unstable. Always check for network signals or have cash on hand.'
        };
      case 'activity':
        return {
          icon: <Camera size={18} className="text-emerald-600" />,
          badgeBg: 'bg-emerald-50 border-emerald-100 text-emerald-700',
          gradient: 'from-emerald-50/20 to-emerald-100/10',
          cardBorder: 'border-emerald-100',
          focusColor: 'text-emerald-600',
          localTip: 'Avoid peak visiting hours (11 AM - 3 PM) to miss the tourist buses. Carry small cash change (Rs 10/20/50 notes) for local guides or snacks.'
        };
      case 'taxi':
      case 'cab':
        return {
          icon: <Car size={18} className="text-amber-600" />,
          badgeBg: 'bg-amber-50 border-amber-100 text-amber-700',
          gradient: 'from-amber-50/20 to-amber-100/10',
          cardBorder: 'border-amber-100',
          focusColor: 'text-amber-600',
          localTip: 'Himalayan cab unions do not allow outside cabs (Ola/Uber) to operate for local sightseeing. Pre-book local drivers to prevent spot rate negotiation.'
        };
      case 'train':
        return {
          icon: <Train size={18} className="text-sky-600" />,
          badgeBg: 'bg-sky-50 border-sky-100 text-sky-700',
          gradient: 'from-sky-50/20 to-sky-100/10',
          cardBorder: 'border-sky-100',
          focusColor: 'text-sky-600',
          localTip: 'Double check your coach number and platform status on NTES app before arriving. Major Indian stations can be overwhelming.'
        };
      case 'bus':
        return {
          icon: <Bus size={18} className="text-teal-600" />,
          badgeBg: 'bg-teal-50 border-teal-100 text-teal-700',
          gradient: 'from-teal-50/20 to-teal-100/10',
          cardBorder: 'border-teal-100',
          focusColor: 'text-teal-600',
          localTip: 'The overnight winding highway curves to hilly locations can cause motion sickness. Avoid heavy meals right before boarding.'
        };
      default:
        return {
          icon: <Compass size={18} className="text-slate-600" />,
          badgeBg: 'bg-slate-50 border-slate-100 text-slate-700',
          gradient: 'from-slate-50/20 to-slate-100/10',
          cardBorder: 'border-slate-100',
          focusColor: 'text-slate-600',
          localTip: 'Keep offline Google Maps downloaded for the entire region. Mobile connectivity can drop significantly between cities.'
        };
    }
  };

  const theme = getCategoryTheme();

  return (
    <div className="flex h-full w-full flex-col bg-paper-1 overflow-y-auto custom-scrollbar border-t border-line lg:border-t-0 p-4 lg:p-6 select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col gap-5 h-full"
        >
          {/* A. Header Section */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${theme.badgeBg}`}>
                  {theme.icon}
                  {item.type}
                </span>
                
                {item.status && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    item.status === 'Confirmed' 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                      : 'bg-amber-50 border-amber-100 text-amber-700'
                  }`}>
                    {item.status}
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-xl lg:text-2xl font-black text-slate-900 leading-tight tracking-tight">
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400 shrink-0" />
                  {item.subtitle}
                </p>
              )}
            </div>

            {item.price && (
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  {item.cost?.provenance?.tier === 'verified' ? 'Cost' : 'Est. Cost'}
                </span>
                <span className="text-lg font-black text-slate-900">{item.price}</span>
                <ProvenanceBadge provenance={item.cost?.provenance} className="mt-1" />
              </div>
            )}
          </div>

          {/* B. Large Image or Aesthetic Cover Card */}
          {item.image ? (
            <div className="relative h-36 w-full overflow-hidden rounded-[20px] border border-white/60 shadow-sm shrink-0">
              <img 
                src={item.image} 
                alt={item.title} 
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
            </div>
          ) : (
            <div className={`relative h-24 w-full overflow-hidden rounded-[20px] border ${theme.cardBorder} bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-4 shrink-0`}>
              <Sparkles className={`w-8 h-8 ${theme.focusColor} opacity-20`} />
            </div>
          )}

          {/* B2. Rich place facts — photos/hours/phone/website from reference data */}
          <RichHoverCard item={item} />

          {/* C. AI Insights Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Main AI Recommendation/Tip — only rendered when a real tip exists */}
            {item.aiTip && (
              <div className={`col-span-1 md:col-span-2 rounded-[18px] border p-3.5 bg-white/70 shadow-2xs backdrop-blur-xs ${theme.cardBorder}`}>
                <div className="flex items-center gap-2 text-indigo-700">
                  <Sparkles size={15} className="text-indigo-500 fill-indigo-200" />
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-950">AI Smart Recommendation</h4>
                </div>
                <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-800 italic">
                  &quot;{item.aiTip}&quot;
                </p>
              </div>
            )}

            {/* 2. Local Indian Context */}
            <div className="rounded-[18px] border border-slate-200/80 p-3 bg-white/60 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-800">
                <AlertCircle size={15} className="text-amber-500" />
                <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-800">Local Travel Tip</h4>
              </div>
              <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-slate-600">
                {theme.localTip}
              </p>
            </div>

            {/* 3. Details & Logistics */}
            <div className="rounded-[18px] border border-slate-200/80 p-3 bg-white/60 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-800">
                  <Clock size={15} className="text-slate-500" />
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-800">Logistics</h4>
                </div>
                
                <div className="mt-1.5 flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  {item.startTime && (
                    <p className="flex justify-between">
                      <span className="text-slate-400">Timings:</span> 
                      <span className="text-slate-800">{item.startTime} {item.endTime ? `to ${item.endTime}` : ''}</span>
                    </p>
                  )}
                  {item.details && (
                    <p className="mt-1 border-t border-slate-100 pt-1 leading-normal text-slate-500 font-medium">
                      {item.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* D. Alternatives — real cached candidates, or an honest path to search */}
          <div className="mt-1 flex flex-col gap-2 border-t border-slate-200/80 pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                <Sparkles size={13} className="text-blue-600" />
                Alternatives
              </span>
              {candidates.length > 0 && (
                <span className="text-[10px] font-semibold text-slate-400">1-Click Swap</span>
              )}
            </div>

            {candidates.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-slate-900 truncate">{cand.title}</h5>
                        {cand.rating && (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700">
                            <Star size={10} className="fill-amber-400 text-amber-400" /> {cand.rating}
                          </span>
                        )}
                      </div>
                      {cand.aiTip && <p className="text-[10px] text-slate-500 truncate">{cand.aiTip}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cand.price && <span className="text-xs font-black text-slate-800">{cand.price}</span>}
                      <button
                        onClick={() => onSwapItem?.(cand)}
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Swap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white/50 p-3">
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                  I don&apos;t have verified alternatives for this yet. Want me to search
                  real options nearby?
                </p>
                <button
                  onClick={() => onExplore?.(item)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition-colors hover:bg-blue-700 cursor-pointer"
                >
                  Search real alternatives
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
