import { Attraction } from '@/services/attraction.service';
import { MapPin, Star, Clock, Phone, Globe, Info, Utensils, Beer, Wine, Leaf, Navigation, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import { useState, useRef } from 'react';

export function RestaurantPanel({ place }: { place: Attraction }) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const overviewRef = useRef<HTMLElement>(null);
  const reviewsRef = useRef<HTMLElement>(null);
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

  const renderPrice = (level: number | null | undefined) => {
    if (level === null || level === undefined) return null;
    return Array(level || 1).fill('$').join('');
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 flex flex-col relative scroll-smooth">
      {/* Hero Image (Cinematic) */}
      <div className="relative h-[45vh] w-full shrink-0">
        {place.image_url ? (
          <Image src={place.image_url} alt={place.name} fill className="object-cover" priority sizes="50vw" />
        ) : (
          <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Utensils size={64} className="opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        <div className="absolute bottom-8 left-8 right-8 text-white z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-rose-500/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20 shadow-[0_0_15px_rgba(244,63,94,0.5)]">
              🍽️ Restaurant
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
            {(place as any).price_level !== null && (place as any).price_level !== undefined && (
              <div className="bg-green-500/20 text-green-400 border border-green-500/30 backdrop-blur-md px-3 py-1.5 rounded-xl tracking-widest font-bold">
                {renderPrice((place as any).price_level)}
              </div>
            )}
            {place.google_maps_url && (
              <a href={place.google_maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-md">
                <Navigation size={16} /> Maps
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
        <button onClick={() => scrollTo(reviewsRef, 'reviews')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'reviews' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          Reviews
        </button>
        <button onClick={() => scrollTo(locationRef, 'location')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'location' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          Location & Hours
        </button>
      </div>

      <div className="p-8 flex-1 space-y-12">
        {/* Overview Section */}
        <section ref={overviewRef} className="scroll-mt-24">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><Info className="text-rose-500"/> The Vibe</h3>
          
          {place.editorial_summary ? (
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg font-medium mb-8">
              {place.editorial_summary}
            </p>
          ) : (
            <p className="text-slate-500 italic mb-8">A highly rated dining spot in the city.</p>
          )}

          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Amenities & Offerings</h4>
          <div className="flex flex-wrap gap-3">
            {place.dine_in && <span className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold shadow-sm flex items-center gap-2"><Utensils size={16} className="text-emerald-500"/> Dine-in</span>}
            {place.takeout && <span className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold shadow-sm flex items-center gap-2">🛍️ Takeout</span>}
            {place.delivery && <span className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold shadow-sm flex items-center gap-2">🛵 Delivery</span>}
            {place.serves_vegetarian_food && <span className="px-4 py-2 rounded-xl bg-green-50 text-green-700 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-400 border border-green-200 text-sm font-bold shadow-sm flex items-center gap-2"><Leaf size={16}/> Veggie Options</span>}
            {place.serves_beer && <span className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400 border border-amber-200 text-sm font-bold shadow-sm flex items-center gap-2"><Beer size={16}/> Beer</span>}
            {place.serves_wine && <span className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 border border-rose-200 text-sm font-bold shadow-sm flex items-center gap-2"><Wine size={16}/> Wine</span>}
            {place.reservable && <span className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400 border border-blue-200 text-sm font-bold shadow-sm flex items-center gap-2">📅 Reservable</span>}
          </div>
        </section>

        {/* Reviews Section */}
        <section ref={reviewsRef} className="scroll-mt-24 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><Star className="text-rose-500"/> Featured Reviews</h3>
          {place.reviews && place.reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {place.reviews.map((rev: any, idx: number) => (
                <div key={idx} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
                      {rev.profile_photo_url && <img src={rev.profile_photo_url} alt={rev.author_name} className="w-full h-full object-cover"/>}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{rev.author_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex">
                          {Array(5).fill(0).map((_, i) => (
                            <Star key={i} size={12} className={i < rev.rating ? "text-amber-400 fill-current" : "text-slate-300 dark:text-slate-700"} />
                          ))}
                        </div>
                        <span className="text-xs text-slate-500">{rev.relative_time_description}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed italic">&quot;{rev.text}&quot;</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No reviews available.</p>
          )}
        </section>

        {/* Location & Hours Section */}
        <section ref={locationRef} className="scroll-mt-24 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><MapPin className="text-rose-500"/> Location & Hours</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {/* Info Cards */}
              {place.address && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Address</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{place.address}</p>
                    {place.google_maps_url && (
                      <a href={place.google_maps_url} target="_blank" rel="noreferrer" className="text-sm text-primary font-bold mt-2 flex items-center gap-1 hover:underline">
                        Get Directions <ArrowUpRight size={14}/>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {place.formatted_phone_number && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</p>
                    <a href={`tel:${place.formatted_phone_number}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-primary transition-colors">
                      {place.formatted_phone_number}
                    </a>
                  </div>
                </div>
              )}

              {(place as any).website && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                    <Globe size={20} />
                  </div>
                  <div className="overflow-hidden w-full">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Website</p>
                    <a href={(place as any).website} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline block truncate">
                      Official Menu & Booking <ArrowUpRight size={14} className="inline"/>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Hours */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                  <Clock size={20} />
                </div>
                <h4 className="font-bold text-lg">Weekly Schedule</h4>
              </div>
              
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
                <p className="text-slate-500 text-sm">Hours not available. Please call to verify.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
