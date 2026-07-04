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
  ArrowRight, 
  Plane, 
  Home, 
  Utensils, 
  Camera, 
  Car, 
  Train, 
  Bus
} from 'lucide-react';
import { ItineraryItem } from './mockData';

interface AIInsightsPanelProps {
  item: ItineraryItem | null;
}

export default function AIInsightsPanel({ item }: AIInsightsPanelProps) {
  if (!item) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-[#fbfaf7]">
        <Compass size={40} className="text-slate-300 animate-pulse mb-3" />
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">No Item Selected</h4>
        <p className="mt-1 max-w-xs text-xs text-slate-400">Hover over any itinerary item on the left to instantly reveal smart AI insights and coordinates details.</p>
      </div>
    );
  }

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
    <div className="flex h-full w-full flex-col bg-[#fbfaf7] overflow-y-auto custom-scrollbar border-t border-[#e2ddd2] lg:border-t-0 p-4 lg:p-6 select-none">
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

              <p className="mt-1 text-xs font-bold text-slate-500 flex items-center gap-1">
                <MapPin size={12} className={theme.focusColor} />
                {item.geoTag || item.subtitle}
              </p>
            </div>

            {/* Ratings & Price Badge */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {item.price && (
                <div className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-extrabold text-white shadow-sm border border-slate-800">
                  {item.price}
                </div>
              )}
              
              {item.rating && (
                <div className="flex items-center gap-0.5 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={12} 
                      fill={i < item.rating! ? '#f59e0b' : 'none'} 
                      className={i < item.rating! ? 'text-amber-500' : 'text-slate-200'} 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* B. Large Image or Aesthetic Cover Card */}
          {item.image ? (
            <div className="relative h-44 w-full overflow-hidden rounded-[24px] border border-white/60 shadow-md">
              <img 
                src={item.image} 
                alt={item.title} 
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
            </div>
          ) : (
            <div className={`relative h-28 w-full overflow-hidden rounded-[20px] border ${theme.cardBorder} bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-4`}>
              <Sparkles className={`w-8 h-8 ${theme.focusColor} opacity-20`} />
            </div>
          )}

          {/* C. AI Insights Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {/* 1. Main AI Recommendation/Tip */}
            <div className={`col-span-1 md:col-span-2 rounded-[20px] border p-4 bg-white/70 shadow-sm backdrop-blur-sm ${theme.cardBorder}`}>
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles size={16} className="text-indigo-500 fill-indigo-200 animate-pulse" />
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-950">AI Smart Recommendation</h4>
              </div>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-800 italic">
                &quot;{item.aiTip || `Excellent plan to kickstart your travel phase! We suggest coordinating your timings with local daylight hours and keeping weather conditions in mind.`}&quot;
              </p>
            </div>

            {/* 2. Indian Context Travel Tip */}
            <div className="rounded-[20px] border border-slate-100 p-4 bg-white/50 shadow-sm">
              <div className="flex items-center gap-2 text-slate-800">
                <AlertCircle size={16} className="text-amber-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Local Indian Context</h4>
              </div>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
                {theme.localTip}
              </p>
            </div>

            {/* 3. Details & Logistics */}
            <div className="rounded-[20px] border border-slate-100 p-4 bg-white/50 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-800">
                  <Clock size={16} className="text-slate-500" />
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Logistics & Details</h4>
                </div>
                
                <div className="mt-2 flex flex-col gap-1 text-xs font-semibold text-slate-600">
                  {item.startTime && (
                    <p className="flex justify-between">
                      <span className="text-slate-400">Timings:</span> 
                      <span className="text-slate-800">{item.startTime} {item.endTime ? `to ${item.endTime}` : ''}</span>
                    </p>
                  )}
                  {item.details && (
                    <p className="mt-1 border-t border-slate-50 pt-1 leading-normal text-slate-500 font-medium">
                      {item.details}
                    </p>
                  )}
                  {item.distanceToNext && (
                    <p className="flex justify-between border-t border-slate-50 pt-1">
                      <span className="text-slate-400">Distance to next:</span>
                      <span className="text-slate-800">{item.distanceToNext}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Status Action Indicator */}
              {item.status === 'Pending' && (
                <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3">
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Awaiting Booking</span>
                  <button className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-slate-800 transition-colors">
                    Book Now <ArrowRight size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
