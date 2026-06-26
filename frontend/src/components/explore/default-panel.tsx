import { Attraction } from '@/services/attraction.service';
import { MapPin, Star, Image as ImageIcon, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import { useState, useRef } from 'react';

export function DefaultPanel({ place }: { place: Attraction }) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const overviewRef = useRef<HTMLElement>(null);
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
            <ImageIcon size={64} className="opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        <div className="absolute bottom-8 left-8 right-8 text-white z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-slate-700/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20">
              {place.category?.replace('_', ' ') || 'Place'}
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
        <button onClick={() => scrollTo(locationRef, 'location')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'location' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          Location & Contact
        </button>
      </div>

      <div className="p-8 flex-1 space-y-12">
        {/* Overview Section */}
        <section ref={overviewRef} className="scroll-mt-24">
          {place.editorial_summary ? (
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg font-medium mb-8">
              {place.editorial_summary}
            </p>
          ) : (
            <p className="text-slate-500 italic mb-8">Detailed description not available.</p>
          )}

          {/* Photo Gallery Snippet */}
          {place.secondary_images && place.secondary_images.length > 0 && (
            <div className="mt-8">
               <h3 className="text-xl font-bold mb-4">Photos</h3>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {place.secondary_images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
                      <Image src={img} alt={`${place.name} photo ${idx}`} fill className="object-cover hover:scale-110 transition-transform duration-500" />
                    </div>
                  ))}
               </div>
            </div>
          )}
        </section>

        {/* Location & Contact Section */}
        <section ref={locationRef} className="scroll-mt-24 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><MapPin className="text-slate-500"/> Location & Contact</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {place.address && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Address</p>
                  <p className="font-medium text-lg text-slate-900 dark:text-slate-100">{place.address}</p>
                  {place.google_maps_url && (
                    <a href={place.google_maps_url} target="_blank" rel="noreferrer" className="text-primary font-bold flex items-center gap-1 hover:underline mt-1 w-fit">
                      Get Directions <ArrowUpRight size={16}/>
                    </a>
                  )}
                </div>
              )}
              {place.formatted_phone_number && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-2 justify-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</p>
                  <a href={`tel:${place.formatted_phone_number}`} className="font-medium text-lg text-slate-900 dark:text-slate-100 hover:text-primary transition-colors">
                    {place.formatted_phone_number}
                  </a>
                </div>
              )}
              {(place as any).website && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-2 justify-center md:col-span-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Website</p>
                  <a href={(place as any).website} target="_blank" rel="noreferrer" className="font-medium text-lg text-primary hover:underline truncate">
                    {(place as any).website}
                  </a>
                </div>
              )}
          </div>
        </section>
      </div>
    </div>
  );
}
