'use client';

import { Sparkles } from 'lucide-react';
import GradientButton from '@/components/ui-custom/gradient-button';
import { MoodCategory, HomepageDestination } from '@/services/homepage.service';
import HeroRight from './hero-right';

interface HeroProps {
  moods: MoodCategory[];
  activeMood: string;
  onMoodClick: (slug: string) => void;
  destinations?: HomepageDestination[];
}

export default function Hero({ moods, activeMood, onMoodClick, destinations = [] }: HeroProps) {
  // Show only first 4 moods (excluding "all") as quick suggestion chips
  const suggestionMoods = moods.filter((m) => m.slug !== 'all').slice(0, 4);

  return (
    <section className="relative overflow-hidden pt-24 pb-20">
      {/* Stunning Dynamic Animated Background */}
      <div className="absolute inset-0 overflow-hidden bg-[#f8fafc]">
        {/* Animated Blur Blobs */}
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-400/30 to-purple-400/30 blur-[100px] animate-blob" style={{ animationDelay: '0s' }} />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-gradient-to-br from-cyan-400/30 to-emerald-400/30 blur-[100px] animate-blob" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[50%] rounded-full bg-gradient-to-br from-indigo-400/30 to-fuchsia-400/30 blur-[100px] animate-blob" style={{ animationDelay: '4s' }} />
        
        {/* Glassmorphic Overlay */}
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Side - Copy & CTA */}
          <div className="max-w-2xl pt-10">
            {/* AI badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm shadow-sm shadow-blue-900/5">
              <Sparkles size={15} className="text-blue-600" />
              <span className="font-medium text-slate-700">AI Powered Travel Concierge</span>
            </div>

            <h1 className="mt-8 text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              Where do you want
              <br />
              to go <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">next?</span>
            </h1>

            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-lg">
              Tell our AI your dream — get a full itinerary, flights, hotels, visa & forex sorted in seconds.
            </p>

            {/* Quick mood suggestion chips */}
            {suggestionMoods.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-slate-400 mr-2">I want:</span>
                {suggestionMoods.map((mood) => (
                  <button
                    key={mood.slug}
                    onClick={() => onMoodClick(mood.slug)}
                    className={`
                      flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300
                      ${activeMood === mood.slug
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105'
                        : 'bg-white/80 backdrop-blur-sm text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-white hover:scale-105 shadow-sm'
                      }
                    `}
                  >
                    <span>{mood.emoji}</span>
                    {mood.name}
                  </button>
                ))}
              </div>
            )}

            {/* CTA row + stats */}
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <GradientButton>Start Planning</GradientButton>
              <button className="rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-sm px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-white hover:shadow-sm transition-all">
                Watch Demo
              </button>
              <div className="hidden sm:flex items-center gap-4 pl-5 border-l border-slate-300/50 text-xs text-slate-500 font-semibold">
                <div className="flex flex-col"><span className="text-slate-900 text-base">500+</span> Airlines</div>
                <div className="flex flex-col"><span className="text-slate-900 text-base">12k+</span> Itineraries</div>
              </div>
            </div>
          </div>

          {/* Right Side - Dynamic Visuals */}
          <HeroRight destinations={destinations} />

        </div>
      </div>
    </section>
  );
}