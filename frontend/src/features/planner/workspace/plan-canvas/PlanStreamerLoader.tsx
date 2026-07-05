'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Compass, CheckCircle2, Navigation } from 'lucide-react';

interface PlanStreamerLoaderProps {
  destination?: string;
}


const GENERATION_STEPS = [
  { id: 1, label: 'Fetching optimal flight & transit routes', icon: '✈️' },
  { id: 2, label: 'Scouting top-rated stays & boutique hotels', icon: '🏨' },
  { id: 3, label: 'Calculating travel distance matrix & maps', icon: '🗺️' },
  { id: 4, label: 'Balancing daily activity pacing & time slots', icon: '⚡' },
  { id: 5, label: 'Assembling your NeuralNomad itinerary', icon: '✨' },
];

const DESTINATION_IMAGES = [
  'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80',
];

export default function PlanStreamerLoader({ destination = 'Manali' }: PlanStreamerLoaderProps) {

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < GENERATION_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 1200);

    const imgInterval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % DESTINATION_IMAGES.length);
    }, 2400);

    return () => {
      clearInterval(stepInterval);
      clearInterval(imgInterval);
    };
  }, []);

  const progressPercent = Math.round(((currentStepIndex + 1) / GENERATION_STEPS.length) * 100);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white select-none">
      {/* Floating Animated Background Photo Canvas */}
      <div className="absolute inset-0 z-0 opacity-25 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeImageIndex}
            src={DESTINATION_IMAGES[activeImageIndex]}
            alt="Travel landmark"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5 }}
            className="h-full w-full object-cover filter blur-xs"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
      </div>

      {/* Floating Sparkles & Compass particles */}
      <motion.div
        animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute top-12 left-16 text-indigo-400/40 pointer-events-none"
      >
        <Compass size={64} />
      </motion.div>

      <motion.div
        animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className="absolute bottom-16 right-16 text-blue-400/30 pointer-events-none"
      >
        <Navigation size={72} />
      </motion.div>

      {/* Main Glassmorphic Loading Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Destination Header Tag */}
        <div className="flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/20 px-3.5 py-1 text-xs font-bold text-blue-200 uppercase tracking-widest backdrop-blur-md">
          <MapPin size={13} className="text-blue-400 animate-bounce" />
          Crafting Trip to {destination}
        </div>

        {/* Central Pulse Icon */}
        <div className="relative my-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30">
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-full bg-blue-400"
          />
          <Sparkles size={36} className="relative z-10 text-white animate-spin-slow" />
        </div>

        <h3 className="text-xl font-black tracking-tight text-white text-center">
          Building Your Perfect Itinerary
        </h3>
        <p className="mt-1 text-xs text-slate-300 text-center">
          AI is assembling smart routes, distance matrix & curated spots...
        </p>

        {/* Dynamic Progress Bar */}
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-800/80 p-0.5 border border-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-1.5 flex w-full justify-between text-[10px] font-bold text-slate-400">
          <span>Processing Data</span>
          <span className="text-blue-400">{progressPercent}%</span>
        </div>

        {/* Animated Flying Text Milestones */}
        <div className="mt-6 flex w-full flex-col gap-2.5">
          {GENERATION_STEPS.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: idx <= currentStepIndex ? 1 : 0.4, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2 border transition-all ${
                  isCurrent
                    ? 'border-blue-400/50 bg-blue-500/20 text-white shadow-md shadow-blue-500/10 font-bold'
                    : isDone
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/5 bg-white/5 text-slate-400'
                }`}
              >
                <span className="text-sm">{step.icon}</span>
                <span className="flex-1 text-xs">{step.label}</span>
                {isDone ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="h-3.5 w-3.5 rounded-full border-2 border-blue-400 border-t-transparent shrink-0"
                  />
                ) : null}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
