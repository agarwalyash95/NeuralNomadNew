'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plane, Hotel, Train, MapPin, Car, CloudSun, Check, Sparkles,
  Loader2, ShieldCheck, Calendar, Wallet, Smile
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanLoadingScreenProps {
  onComplete?: () => void;
  destination?: string;
  durationDays?: number;
  travelersCount?: number;
  budgetText?: string;
  isBackendReady?: boolean;
}

// Stepper steps configuration
const STEPS = [
  { id: 1, label: 'Understanding Your Preferences' },
  { id: 2, label: 'Finding Best Options' },
  { id: 3, label: 'Optimizing Route & Budget' },
  { id: 4, label: 'Personalizing Experiences' },
  { id: 5, label: 'Finalizing Itinerary' },
];

// Flying particle definition for elements going flying in middle screen
interface FlyingElement {
  id: number;
  icon: React.ReactNode;
  color: string;
  start: { x: number; y: number }; // Percentage relative coordinates
  mid: { x: number; y: number };
  duration: number;
  delay: number;
}

const FLYING_ELEMENTS: FlyingElement[] = [
  { id: 1, icon: <Plane size={16} />, color: '#6366f1', start: { x: -38, y: -22 }, mid: { x: -18, y: -10 }, duration: 2.8, delay: 0 },
  { id: 2, icon: <Hotel size={16} />, color: '#4f46e5', start: { x: -38, y: -8 }, mid: { x: -18, y: -4 }, duration: 3.2, delay: 0.4 },
  { id: 3, icon: <Train size={16} />, color: '#10b981', start: { x: -38, y: 6 }, mid: { x: -18, y: 2 }, duration: 2.6, delay: 0.8 },
  { id: 4, icon: <MapPin size={16} />, color: '#ec4899', start: { x: -38, y: 20 }, mid: { x: -18, y: 10 }, duration: 3.0, delay: 1.2 },
  { id: 5, icon: <Car size={16} />, color: '#f59e0b', start: { x: -38, y: 34 }, mid: { x: -18, y: 16 }, duration: 2.9, delay: 0.6 },
  
  { id: 6, icon: <Plane size={16} />, color: '#8b5cf6', start: { x: 38, y: -20 }, mid: { x: 18, y: -10 }, duration: 3.1, delay: 0.2 },
  { id: 7, icon: <Hotel size={16} />, color: '#3b82f6', start: { x: 38, y: -6 }, mid: { x: 18, y: -3 }, duration: 2.7, delay: 1.0 },
  { id: 8, icon: <Sparkles size={16} />, color: '#10b981', start: { x: 38, y: 8 }, mid: { x: 18, y: 4 }, duration: 2.9, delay: 0.5 },
  { id: 9, icon: <Car size={16} />, color: '#06b6d4', start: { x: 38, y: 22 }, mid: { x: 18, y: 11 }, duration: 3.3, delay: 1.4 },
];

function getDynamicDestinationDetails(destInput: any) {
  const normalized = (typeof destInput === 'string' ? destInput : String(destInput)).toLowerCase().trim();

  if (normalized.includes('kyoto') || normalized.includes('tokyo') || normalized.includes('japan') || normalized.includes('osaka')) {
    const isKyoto = normalized.includes('kyoto');
    const city = isKyoto ? 'Kyoto' : 'Tokyo';
    return {
      hotelScanText: `Checking 350+ hotels in ${city}`,
      hotelBrands: ['Hoshinoya', 'Aman', 'Ritz', '+6'],
      hotelTopPick: {
        name: isKyoto ? 'Hoshinoya Kyoto' : 'Aman Tokyo',
        location: isKyoto ? 'Arashiyama, Kyoto' : 'Otemachi, Tokyo',
        rating: '4.9',
        reviews: '1.4k',
        price: '¥48,000 / night',
        badge: 'Ryokan Top Pick'
      },
      flightDetails: {
        airline: 'JAL JL-708',
        originCode: 'DEL',
        destCode: isKyoto ? 'KIX' : 'HND',
        duration: '7h 15m',
        price: '₹42,500',
        airlinesList: ['JAL', 'ANA', 'SingaporeAir', '+5']
      },
      attractionDetails: {
        title: isKyoto ? 'Fushimi Inari & Bamboo Grove' : 'Senso-ji & Shibuya Sky Tour',
        type: 'Full Day Cultural Tour',
        rating: '4.9',
        reviews: '2.1k',
        price: '¥6,500 / person'
      },
      transportDetails: {
        title: isKyoto ? 'Haruka Kansai Express' : 'Tokyo Narita Skyliner',
        specs: 'Reserved • High Speed Rail',
        price: '¥2,200'
      },
      weatherDetails: {
        forecast: '18°C - 23°C 🌤️',
        badge: 'Pleasant'
      }
    };
  }

  if (normalized.includes('manali') || normalized.includes('himachal') || normalized.includes('kullu') || normalized.includes('kasol')) {
    return {
      hotelScanText: 'Checking 180+ resorts in Manali',
      hotelBrands: ['Span Resort', 'Baragarh', 'Club Mahindra', '+4'],
      hotelTopPick: {
        name: 'The Span Resort & Spa',
        location: 'Old Manali',
        rating: '4.8',
        reviews: '950',
        price: '₹8,500 / night',
        badge: 'Himalayan Top Pick'
      },
      flightDetails: {
        airline: 'AirIndia Express',
        originCode: 'DEL',
        destCode: 'KUU',
        duration: '1h 20m',
        price: '₹6,200',
        airlinesList: ['AirIndia', 'Alliance Air', 'Volvo Express', '+3']
      },
      attractionDetails: {
        title: 'Solang Valley & Rohtang Pass',
        type: 'Full Day Adventure Tour',
        rating: '4.9',
        reviews: '1.2k',
        price: '₹3,200 / person'
      },
      transportDetails: {
        title: 'Private Himalayan 4WD SUV',
        specs: 'Private • All Terrain • Snow Ready',
        price: '₹2,500'
      },
      weatherDetails: {
        forecast: '12°C - 18°C ⛰️',
        badge: 'Crisp & Cool'
      }
    };
  }

  if (normalized.includes('bali') || normalized.includes('ubud') || normalized.includes('indonesia')) {
    return {
      hotelScanText: 'Checking 420+ villas in Bali',
      hotelBrands: ['Maya Ubud', 'Alila', 'Four Seasons', '+6'],
      hotelTopPick: {
        name: 'Maya Ubud Resort & Spa',
        location: 'Ubud, Bali',
        rating: '4.9',
        reviews: '1.8k',
        price: '₹14,200 / night',
        badge: 'Luxury Villa'
      },
      flightDetails: {
        airline: 'Batik Air OD-305',
        originCode: 'DEL',
        destCode: 'DPS',
        duration: '6h 30m',
        price: '₹28,500',
        airlinesList: ['Garuda', 'Batik Air', 'AirAsia', '+5']
      },
      attractionDetails: {
        title: 'Tegallalang Rice Terrace & Swing',
        type: 'Nature & Jungle Experience',
        rating: '4.9',
        reviews: '1.6k',
        price: '₹1,800 / person'
      },
      transportDetails: {
        title: 'Private Airport Van Transfer',
        specs: 'Private • AC • Driver Included',
        price: '₹1,500'
      },
      weatherDetails: {
        forecast: '26°C - 30°C 🌴',
        badge: 'Tropical'
      }
    };
  }

  if (normalized.includes('paris') || normalized.includes('france') || normalized.includes('europe') || normalized.includes('switzerland') || normalized.includes('london')) {
    const isSwiss = normalized.includes('switzerland');
    const city = isSwiss ? 'Switzerland' : (normalized.includes('london') ? 'London' : 'Paris');
    return {
      hotelScanText: `Checking 500+ hotels in ${city}`,
      hotelBrands: ['Le Meurice', 'Shangri-La', 'Novotel', '+8'],
      hotelTopPick: {
        name: isSwiss ? 'The Chedi Andermatt' : 'Le Meurice Paris',
        location: isSwiss ? 'Andermatt, Swiss Alps' : '1st Arr., Paris',
        rating: '4.9',
        reviews: '2.4k',
        price: '€450 / night',
        badge: 'Palace Top Pick'
      },
      flightDetails: {
        airline: 'Air France AF-225',
        originCode: 'DEL',
        destCode: normalized.includes('london') ? 'LHR' : (isSwiss ? 'ZRH' : 'CDG'),
        duration: '8h 45m',
        price: '₹58,000',
        airlinesList: ['Air France', 'Emirates', 'Lufthansa', '+6']
      },
      attractionDetails: {
        title: isSwiss ? 'Jungfraujoch Top of Europe Tour' : 'Eiffel Tower Priority & Seine Cruise',
        type: 'Skip-The-Line Experience',
        rating: '4.9',
        reviews: '3.5k',
        price: '€65 / person'
      },
      transportDetails: {
        title: 'Private Airport Chauffeur',
        specs: 'Mercedes E-Class • Leather AC',
        price: '€85'
      },
      weatherDetails: {
        forecast: '16°C - 22°C ⛅',
        badge: 'Mild & Sunny'
      }
    };
  }

  // Dynamic Fallback for any other custom destination (Goa, Jaipur, Dubai, New York, Bareilly, etc.)
  const destStr = typeof destInput === 'string' ? destInput : (destInput?.name || destInput?.city_name || destInput?.destination_city || destInput?.destination_text || String(destInput));
  const cityCap = destStr.split(',')[0]?.trim() || destStr || 'Goa';
  const airportCode = cityCap.substring(0, 3).toUpperCase();
  return {
    hotelScanText: `Checking 350+ hotels in ${cityCap}`,
    hotelBrands: ['Taj', 'IHG', 'Marriott', '+6'],
    hotelTopPick: {
      name: `Grand ${cityCap} Resort & Spa`,
      location: `Central ${cityCap}`,
      rating: '4.8',
      reviews: '1.2k',
      price: '₹12,500 / night',
      badge: 'Top Pick'
    },
    flightDetails: {
      airline: 'IndiGo 6E-123',
      originCode: 'DEL',
      destCode: airportCode.length === 3 ? airportCode : 'DEST',
      duration: '2h 30m',
      price: '₹4,250',
      airlinesList: ['IndiGo', 'Vistara', 'AirIndia', '+5']
    },
    attractionDetails: {
      title: `Top ${cityCap} Highlights & Heritage Tour`,
      type: 'Full Day Experience',
      rating: '4.9',
      reviews: '890',
      price: '₹2,200 / person'
    },
    transportDetails: {
      title: 'Airport Transfer',
      specs: 'Private • AC • 4 Seater',
      price: '₹1,200'
    },
    weatherDetails: {
      forecast: '24°C - 29°C ☀️',
      badge: 'Pleasant'
    }
  };
}

export default function PlanLoadingScreen({
  onComplete,
  destination = 'Goa, India',
  durationDays = 4,
  travelersCount = 2,
  budgetText = '₹45,000',
  isBackendReady = false,
}: PlanLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const isBackendReadyRef = React.useRef(isBackendReady);

  useEffect(() => {
    isBackendReadyRef.current = isBackendReady;
  }, [isBackendReady]);

  // Safe helper to extract destination text and city name safely
  const formatDestination = (dest: any): { full: string; city: string } => {
    if (!dest) return { full: 'Goa, India', city: 'Goa' };
    let fullStr = 'Goa, India';
    if (typeof dest === 'string') {
      fullStr = dest;
    } else if (typeof dest === 'object') {
      fullStr = dest.name || dest.city_name || dest.destination_city || dest.destination_text || 'Goa, India';
    } else {
      fullStr = String(dest);
    }
    const parts = fullStr.split(',');
    const firstPart = parts[0];
    const city = firstPart ? firstPart.trim() : fullStr;
    return { full: fullStr, city: city || 'Goa' };
  };

  const { full: destFull, city: destCity } = formatDestination(destination);
  const dyn = getDynamicDestinationDetails(destCity);

  // Calculate current step based on progress (1 to 5)
  const currentStep = Math.min(
    5,
    Math.max(1, Math.floor((progress / 100) * 5) + 1)
  );

  // Smooth timer for rolling progress from 0% to 100%
  useEffect(() => {
    let animationFrame: number;
    let startTime: number | null = null;
    const totalDuration = 4500; // 4.5 seconds for complete rich animation sequence

    const stepProgress = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      let targetProgress = (elapsed / totalDuration) * 100;

      // Hold near 95% if backend is still working, then boost to 100% when backend is ready
      if (targetProgress > 94 && !isBackendReadyRef.current) {
        targetProgress = 94 + (Math.sin(elapsed / 200) * 1);
      } else if (targetProgress >= 100) {
        targetProgress = 100;
      }

      setProgress(targetProgress);

      if (targetProgress < 100) {
        animationFrame = requestAnimationFrame(stepProgress);
      } else {
        // Hold 100% briefly for visual satisfaction before completing
        setTimeout(() => {
          onComplete?.();
        }, 500);
      }
    };

    animationFrame = requestAnimationFrame(stepProgress);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.09),_transparent_45%),linear-gradient(180deg,#faf9f6_0%,#f3f0e8_100%)] p-4 sm:p-6 text-slate-900 select-none"
    >
      {/* ── Background SVG Particle Stream & Bezier Lines ──────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="h-full w-full opacity-60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="streamGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="streamGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Left curved streams to center */}
          <path d="M 120 180 Q 320 220 50% 340" fill="none" stroke="url(#streamGradLeft)" strokeWidth="2" strokeDasharray="6 6" />
          <path d="M 120 280 Q 340 300 50% 340" fill="none" stroke="url(#streamGradLeft)" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 120 380 Q 340 360 50% 340" fill="none" stroke="url(#streamGradLeft)" strokeWidth="2" strokeDasharray="6 6" />
          <path d="M 120 480 Q 320 420 50% 340" fill="none" stroke="url(#streamGradLeft)" strokeWidth="1.5" strokeDasharray="5 5" />
          <path d="M 120 580 Q 300 480 50% 340" fill="none" stroke="url(#streamGradLeft)" strokeWidth="2" strokeDasharray="6 6" />

          {/* Right curved streams to center */}
          <path d="M 88% 180 Q 68% 220 50% 340" fill="none" stroke="url(#streamGradRight)" strokeWidth="2" strokeDasharray="6 6" />
          <path d="M 88% 300 Q 68% 310 50% 340" fill="none" stroke="url(#streamGradRight)" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 88% 420 Q 68% 380 50% 340" fill="none" stroke="url(#streamGradRight)" strokeWidth="2" strokeDasharray="6 6" />
          <path d="M 88% 540 Q 68% 460 50% 340" fill="none" stroke="url(#streamGradRight)" strokeWidth="1.5" strokeDasharray="5 5" />
        </svg>
      </div>

      {/* ── Top Brand Header ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Brand Badge */}
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/80 px-4 py-1.5 shadow-sm border border-slate-200/70 backdrop-blur-md">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs">
            M
          </div>
          <span className="text-sm font-bold text-slate-800 tracking-tight">NeuralNomad</span>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          Your travel plan is getting ready
          <motion.span
            animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="inline-block text-amber-400"
          >
            ✨
          </motion.span>
        </h1>
        <p className="mt-1 text-sm sm:text-base font-medium text-slate-500">
          Our AI is crafting the perfect journey just for you
        </p>
      </div>

      {/* ── Main Interactive Layout Grid ───────────────────────────────────── */}
      <div className="relative z-10 my-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center max-w-7xl mx-auto w-full">
        
        {/* ── Left Side Cards (Scanner Status Cards) ───────────────────────── */}
        <div className="flex flex-col gap-3 lg:col-span-3">
          {/* Card 1: Flights */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex items-center justify-between rounded-2xl border border-indigo-100/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Plane size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Flights</h4>
                <p className="text-[11px] font-medium text-slate-500">Scanning 120+ flights</p>
                <div className="mt-1 flex items-center gap-1">
                  {dyn.flightDetails.airlinesList.map((al, idx) => (
                    <span key={idx} className="rounded bg-indigo-100/70 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">{al}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-10 w-14 rounded-lg bg-gradient-to-tr from-sky-400 to-indigo-500 p-0.5 shadow-inner flex items-center justify-center text-white text-[10px] font-bold">
              ✈ Express
            </div>
          </motion.div>

          {/* Card 2: Hotels */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex items-center justify-between rounded-2xl border border-indigo-100/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Hotel size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Hotels</h4>
                <p className="text-[11px] font-medium text-slate-500">{dyn.hotelScanText}</p>
                <div className="mt-1 flex items-center gap-1">
                  {dyn.hotelBrands.map((hb, idx) => (
                    <span key={idx} className="rounded bg-purple-100/70 px-1.5 py-0.5 text-[9px] font-bold text-purple-800">{hb}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-10 w-14 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 p-1 flex flex-col justify-center items-center text-white text-[9px] font-bold shadow-inner">
              🏨 4.9 ★
            </div>
          </motion.div>

          {/* Card 3: Trains */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex items-center justify-between rounded-2xl border border-indigo-100/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Train size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Trains & Transit</h4>
                <p className="text-[11px] font-medium text-slate-500">Searching best routes and availability</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="rounded bg-emerald-100/70 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">Express</span>
                  <span className="rounded bg-teal-100/70 px-1.5 py-0.5 text-[9px] font-bold text-teal-800">Rail</span>
                  <span className="text-[9px] font-medium text-slate-400">+3</span>
                </div>
              </div>
            </div>
            <div className="h-10 w-14 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-600 p-1 flex items-center justify-center text-white text-[10px] font-bold shadow-inner">
              🚆 HighSpeed
            </div>
          </motion.div>

          {/* Card 4: Attractions */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="flex items-center justify-between rounded-2xl border border-indigo-100/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
                <MapPin size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Attractions</h4>
                <p className="text-[11px] font-medium text-slate-500">Curating top experiences in {destCity}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="rounded bg-pink-100/70 px-1.5 py-0.5 text-[9px] font-bold text-pink-800">TripAdvisor</span>
                  <span className="rounded bg-purple-100/70 px-1.5 py-0.5 text-[9px] font-bold text-purple-800">Klook</span>
                  <span className="text-[9px] font-medium text-slate-400">+4</span>
                </div>
              </div>
            </div>
            <div className="h-10 w-14 rounded-lg bg-gradient-to-tr from-pink-500 to-rose-500 p-1 flex items-center justify-center text-white text-[10px] font-bold shadow-inner">
              🌴 Top 10
            </div>
          </motion.div>

          {/* Card 5: Transport */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="flex items-center justify-between rounded-2xl border border-indigo-100/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Car size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Transport</h4>
                <p className="text-[11px] font-medium text-slate-500">Finding best local rides and transfers</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="rounded bg-amber-100/70 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Cab</span>
                  <span className="rounded bg-yellow-100/70 px-1.5 py-0.5 text-[9px] font-bold text-yellow-800">Transfer</span>
                  <span className="text-[9px] font-medium text-slate-400">+3</span>
                </div>
              </div>
            </div>
            <div className="h-10 w-14 rounded-lg bg-gradient-to-tr from-amber-400 to-orange-500 p-1 flex items-center justify-center text-white text-[10px] font-bold shadow-inner">
              🚕 Cab
            </div>
          </motion.div>

          {/* Card 6: Weather */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="flex items-center justify-between rounded-2xl border border-indigo-100/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <CloudSun size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Weather</h4>
                <p className="text-[11px] font-medium text-slate-500">Checking {durationDays}-day forecast for {destCity}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-sky-700">{dyn.weatherDetails.forecast}</p>
              </div>
            </div>
            <div className="h-10 w-14 rounded-lg bg-gradient-to-tr from-sky-400 to-blue-500 p-1 flex items-center justify-center text-white text-[10px] font-bold shadow-inner">
              {dyn.weatherDetails.badge}
            </div>
          </motion.div>
        </div>

        {/* ── Central Column (Your Dream Trip Glowing Orb Card & Flying Elements) */}
        <div className="relative flex flex-col items-center justify-center lg:col-span-6 py-4">
          
          {/* Animated Flying Side Elements (Flying into middle screen) */}
          <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
            {FLYING_ELEMENTS.map((el) => (
              <motion.div
                key={el.id}
                initial={{
                  x: `${el.start.x}vw`,
                  y: `${el.start.y}vh`,
                  opacity: 0,
                  scale: 0.6,
                }}
                animate={{
                  x: [`${el.start.x}vw`, `${el.mid.x}vw`, '0vw'],
                  y: [`${el.start.y}vh`, `${el.mid.y}vh`, '0vh'],
                  opacity: [0, 1, 1, 0],
                  scale: [0.6, 1.2, 0.3],
                  rotate: [0, 15, -15, 0],
                }}
                transition={{
                  duration: el.duration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: el.delay,
                }}
                className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg border border-slate-100"
                style={{ color: el.color }}
              >
                {el.icon}
              </motion.div>
            ))}
          </div>

          {/* Central White Glass Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border border-indigo-100/90 bg-white/90 p-8 text-center shadow-[0_20px_60px_-15px_rgba(79,70,229,0.15)] backdrop-blur-xl"
          >
            {/* Tagline */}
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">
              Your Dream Trip
            </span>

            {/* Destination Name */}
            <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl flex items-center justify-center gap-2">
              {destFull}
            </h2>

            {/* Trip Specs Subtitle */}
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3.5 py-1 text-xs font-semibold text-slate-600 shadow-2xs">
              <span>{durationDays} Days</span>
              <span>•</span>
              <span>{travelersCount} Travelers</span>
              <span>•</span>
              <span className="text-indigo-600 font-bold">{budgetText} Budget</span>
            </div>

            {/* Glowing Central Orb with Animated Pulsing Rings */}
            <div className="relative my-8 flex h-36 w-36 items-center justify-center">
              {/* Outer pulsing translucent aura ring 1 */}
              <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.15, 0.4, 0.15] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-indigo-500/20 blur-md"
              />
              {/* Outer pulsing translucent aura ring 2 */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                className="absolute inset-2 rounded-full bg-purple-500/25 blur-sm"
              />

              {/* Core Glowing Orb */}
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-purple-500 to-sky-400 p-[3px] shadow-[0_0_35px_rgba(99,102,241,0.5)]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-b from-indigo-900/90 to-purple-950/90 backdrop-blur-md relative overflow-hidden">
                  
                  {/* Internal orb sparkles */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.4),_transparent_60%)]"
                  />

                  {/* Flight Icon in center */}
                  <motion.div
                    animate={{ y: [-3, 3, -3], scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative z-10 flex items-center justify-center text-white"
                  >
                    <Plane size={36} strokeWidth={2.2} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Progress Status Bar Section */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin text-indigo-600" />
                  Building your perfect itinerary...
                </span>
                <span className="text-indigo-600 font-bold tracking-tight">{Math.round(progress)}%</span>
              </div>

              {/* Progress bar track */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/60 shadow-inner">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-sm"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Right Side Cards (Found Options & Summary Pills) ───────────────── */}
        <div className="flex flex-col gap-3 lg:col-span-3">
          {/* Card 1: Flight Found */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-indigo-100/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                ✈ {dyn.flightDetails.airline}
              </span>
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">Best Price</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-700">
              <div>
                <p className="text-sm font-extrabold text-slate-900">08:15</p>
                <p className="text-[10px] text-slate-400 font-medium">{dyn.flightDetails.originCode}</p>
              </div>
              <div className="flex flex-col items-center px-2">
                <span className="text-[9px] text-slate-400 font-medium">{dyn.flightDetails.duration}</span>
                <div className="flex items-center gap-1 text-indigo-400">
                  <span className="h-[1px] w-6 bg-indigo-200"></span>
                  <Plane size={10} />
                  <span className="h-[1px] w-6 bg-indigo-200"></span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold text-slate-900">18:45</p>
                <p className="text-[10px] text-slate-400 font-medium">{dyn.flightDetails.destCode}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-xs font-extrabold text-indigo-600">{dyn.flightDetails.price}</span>
              <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">
                Selected <Check size={12} />
              </span>
            </div>
          </motion.div>

          {/* Card 2: Hotel Found */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex gap-3 rounded-2xl border border-indigo-100/80 bg-white/85 p-3 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="h-16 w-16 shrink-0 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-600 p-0.5 shadow-sm flex flex-col justify-between p-1.5 text-white">
              <span className="text-[9px] font-bold uppercase tracking-wider">Luxury</span>
              <Hotel size={20} className="self-end opacity-90" />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{dyn.hotelTopPick.name}</h4>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">{dyn.hotelTopPick.badge}</span>
                </div>
                <p className="text-[10px] font-medium text-amber-500 flex items-center gap-1 mt-0.5">
                  ★ {dyn.hotelTopPick.rating} <span className="text-slate-400 font-normal">({dyn.hotelTopPick.reviews} reviews)</span>
                </p>
                <p className="text-[10px] text-slate-400">{dyn.hotelTopPick.location}</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <span className="text-xs font-extrabold text-indigo-600">{dyn.hotelTopPick.price}</span>
                <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">
                  Selected <Check size={12} />
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Attraction Found */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex gap-3 rounded-2xl border border-indigo-100/80 bg-white/85 p-3 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="h-16 w-16 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-600 p-1 shadow-sm flex flex-col justify-between text-white">
              <span className="text-[9px] font-bold uppercase">Tour</span>
              <MapPin size={20} className="self-end opacity-90" />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 truncate max-w-[150px]">{dyn.attractionDetails.title}</h4>
                <p className="text-[10px] font-medium text-amber-500 flex items-center gap-1 mt-0.5">
                  ★ {dyn.attractionDetails.rating} <span className="text-slate-400 font-normal">({dyn.attractionDetails.reviews} reviews)</span>
                </p>
                <p className="text-[10px] text-slate-400">{dyn.attractionDetails.type}</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <span className="text-xs font-extrabold text-emerald-600">{dyn.attractionDetails.price}</span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                  Added <Check size={12} />
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Airport Transfer */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="flex gap-3 rounded-2xl border border-indigo-100/80 bg-white/85 p-3 shadow-sm backdrop-blur-md hover:shadow-md transition-shadow"
          >
            <div className="h-16 w-16 shrink-0 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 p-1 shadow-sm flex flex-col justify-between text-white">
              <span className="text-[9px] font-bold uppercase">Cab</span>
              <Car size={20} className="self-end opacity-90" />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{dyn.transportDetails.title}</h4>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">{dyn.transportDetails.specs}</p>
                <p className="text-[10px] text-slate-400">Pick up & Drop</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <span className="text-xs font-extrabold text-amber-600">{dyn.transportDetails.price}</span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                  Added <Check size={12} />
                </span>
              </div>
            </div>
          </motion.div>

          {/* Summary Pills Widget */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="rounded-2xl border border-indigo-100/80 bg-white/90 p-3 shadow-sm backdrop-blur-md"
          >
            <div className="grid grid-cols-4 gap-1 text-center">
              <div className="flex flex-col items-center p-1 rounded-xl bg-slate-50">
                <Calendar size={12} className="text-indigo-500 mb-0.5" />
                <span className="text-[9px] font-medium text-slate-400">Itinerary</span>
                <span className="text-[10px] font-bold text-indigo-600">Building</span>
              </div>
              <div className="flex flex-col items-center p-1 rounded-xl bg-emerald-50">
                <Wallet size={12} className="text-emerald-500 mb-0.5" />
                <span className="text-[9px] font-medium text-slate-400">Budget</span>
                <span className="text-[10px] font-bold text-emerald-600">On Track</span>
              </div>
              <div className="flex flex-col items-center p-1 rounded-xl bg-amber-50">
                <ShieldCheck size={12} className="text-amber-500 mb-0.5" />
                <span className="text-[9px] font-medium text-slate-400">Comfort</span>
                <span className="text-[10px] font-bold text-amber-600">High</span>
              </div>
              <div className="flex flex-col items-center p-1 rounded-xl bg-purple-50">
                <Smile size={12} className="text-purple-500 mb-0.5" />
                <span className="text-[9px] font-medium text-slate-400">Experience</span>
                <span className="text-[10px] font-bold text-purple-600">Amazing</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Bottom Stepper & Tip Footer ────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto mt-2">
        {/* Stepper Bar Container */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:p-4 shadow-sm backdrop-blur-md overflow-x-auto gap-2">
          {STEPS.map((step, index) => {
            const isCompleted = step.id < currentStep || progress >= 100;
            const isActive = step.id === currentStep && progress < 100;

            return (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Step icon circle */}
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                      isCompleted && 'bg-indigo-600 text-white shadow-xs',
                      isActive && 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1 animate-pulse',
                      !isCompleted && !isActive && 'border border-slate-300 bg-slate-100 text-slate-400'
                    )}
                  >
                    {isCompleted ? (
                      <Check size={12} strokeWidth={3} />
                    ) : isActive ? (
                      <Loader2 size={12} className="animate-spin text-indigo-600" />
                    ) : (
                      step.id
                    )}
                  </div>
                  {/* Step title */}
                  <span
                    className={cn(
                      'text-xs font-semibold whitespace-nowrap transition-colors duration-300',
                      isCompleted && 'text-slate-800 font-bold',
                      isActive && 'text-indigo-600 font-extrabold',
                      !isCompleted && !isActive && 'text-slate-400 font-medium'
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Arrow divider */}
                {index < STEPS.length - 1 && (
                  <span className="text-slate-300 text-xs shrink-0 px-1">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Tip footer */}
        <p className="mt-3 text-center text-xs font-medium text-slate-500 flex items-center justify-center gap-1">
          <span>💡</span> Tip: You can tweak anything once your plan is ready!
        </p>
      </div>
    </motion.div>
  );
}
