import { Attraction } from '@/services/attraction.service';
import { MapPin, Star, Clock, Info, Ticket, Globe, Accessibility, ArrowUpRight, Camera } from 'lucide-react';
import Image from 'next/image';
import { useState, useRef } from 'react';

export function SightPanel({ place }: { place: Attraction }) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const overviewRef = useRef<HTMLElement>(null);
  const infoRef = useRef<HTMLElement>(null);
  const locationRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>, id: string) => {
    setActiveTab(id);
    if (ref.current && containerRef.current) {
      containerRef.current.scrollTo({
        top: ref.current.offsetTop - 80, // Offset for sticky navbar
        behavior: 'smooth'
      });
    }
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 flex flex-col relative scroll-smooth">
      {/* Hero Image (Cinematic) */}
      <div className="relative h-[45vh] w-full shrink-0">
        {place.image_url ? (
          <Image src={place.image_url} alt={place.name} fill className="object-cover" priority sizes="50vw" />
        ) : (
          <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Globe size={64} className="opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        <div className="absolute bottom-8 left-8 right-8 text-white z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-blue-600/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
              🏛️ Landmark
            </span>
            {place.business_status === 'CLOSED_TEMPORARILY' && (
              <span className="bg-red-500/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20">
                Temporarily Closed
              </span>
            )}
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-3 tracking-tight drop-shadow-lg">{place.name}</h2>
          
          <div className="flex flex-wrap items-center gap-4 text-sm md:text-base font-medium">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
              <Star size={18} className="text-amber-400 fill-current" /> 
              <span>{place.rating}</span>
              <span className="text-white/60">({place.review_count} reviews)</span>
            </div>
            {place.google_maps_url && (
              <a href={place.google_maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-md">
                <MapPin size={16} /> Maps
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Functional Navbar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 px-8 shrink-0 sticky top-0 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl z-20 shadow-sm">
        <button onClick={() => scrollTo(overviewRef, 'overview')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          Overview
        </button>
        <button onClick={() => scrollTo(infoRef, 'info')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          Visitor Info
        </button>
        <button onClick={() => scrollTo(locationRef, 'location')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'location' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          Location & Contact
        </button>
      </div>

      <div className="p-8 flex-1 space-y-12">
        {/* Overview Section */}
        <section ref={overviewRef} className="scroll-mt-24">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><Info className="text-blue-500"/> History & Culture</h3>
          
          {place.editorial_summary ? (
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg font-medium mb-8">
              {place.editorial_summary}
            </p>
          ) : (
            <p className="text-slate-500 italic mb-8">A highly rated point of interest.</p>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
              <Camera size={24} className="text-slate-400 mb-2"/>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Photo Spot</span>
            </div>
            {place.wheelchair_accessible_entrance && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                <Accessibility size={24} className="text-slate-400 mb-2"/>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Accessible</span>
              </div>
            )}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
              <Ticket size={24} className="text-slate-400 mb-2"/>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Tickets</span>
            </div>
            {place.rating && place.rating >= 4.5 && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 flex flex-col items-center justify-center text-center">
                <Star size={24} className="text-amber-400 fill-current mb-2"/>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Top Rated</span>
              </div>
            )}
          </div>
        </section>

        {/* Visitor Info Section */}
        <section ref={infoRef} className="scroll-mt-24 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><Clock className="text-blue-500"/> Plan Your Visit</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2">Opening Hours</h4>
              {place.opening_hours && Array.isArray(place.opening_hours) ? (
                <ul className="space-y-3">
                  {place.opening_hours.map((hourStr, idx) => {
                    const [day, hours] = hourStr.split(': ');
                    return (
                      <li key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/50 pb-2 last:border-0 last:pb-0">
                        <span className="font-bold text-slate-600 dark:text-slate-400">{day}</span>
                        <span className="font-medium">{hours}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-slate-500 text-sm">Hours not available.</p>
              )}
            </div>

            <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50">
              <h4 className="font-bold text-lg mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">Tickets & Entry</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-6 font-medium">
                {place.ticket_price ? `Entry typically starts around $${place.ticket_price}.` : 'Ticket prices vary. Check the official website for current rates and availability.'}
              </p>
              
              {place.website ? (
                <a href={place.website} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                  Book Official Tickets <ArrowUpRight size={18}/>
                </a>
              ) : (
                <button disabled className="w-full bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold py-3 px-4 rounded-xl cursor-not-allowed">
                  No Online Booking
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section ref={locationRef} className="scroll-mt-24 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><MapPin className="text-blue-500"/> Location & Contact</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {place.address && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Address</p>
                  <p className="font-medium text-lg text-slate-900 dark:text-slate-100">{place.address}</p>
                  {place.google_maps_url && (
                    <a href={place.google_maps_url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold flex items-center gap-1 hover:underline mt-1 w-fit">
                      Get Directions <ArrowUpRight size={16}/>
                    </a>
                  )}
                </div>
              )}
              {place.formatted_phone_number && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-2 justify-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</p>
                  <a href={`tel:${place.formatted_phone_number}`} className="font-medium text-lg text-slate-900 dark:text-slate-100 hover:text-blue-600 transition-colors">
                    {place.formatted_phone_number}
                  </a>
                </div>
              )}
          </div>
        </section>
      </div>
    </div>
  );
}
