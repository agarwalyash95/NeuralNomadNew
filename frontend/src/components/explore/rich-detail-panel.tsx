import { Suggestion, SuggestionCategory } from '@/features/planner/workspace/plan-canvas/types';
import { 
  MapPin, Star, Clock, Phone, Globe, Navigation, Bookmark,
  ChevronDown, ChevronUp, ExternalLink, Sparkles, AlertCircle
} from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';

interface RichDetailPanelProps {
  place: Suggestion;
}

export function RichDetailPanel({ place }: RichDetailPanelProps) {
  const [activeImage, setActiveImage] = useState(place.image_url || '');
  const [showAllHours, setShowAllHours] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Sync active image when place changes
  useEffect(() => {
    setActiveImage(place.image_url || '');
  }, [place]);

  const details = place.details || {};
  const insights = details.insights || {};
  const localTips = details.local_tips || [];
  const secondaryImages = place.secondary_images || [];

  // Group all images (primary + secondary)
  const allImages = [place.image_url, ...secondaryImages].filter(Boolean) as string[];

  // Dynamic Google Maps Search URL
  const googleMapsUrl = place.place_id 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;

  // Category label helper
  const getCategoryLabel = (cat: SuggestionCategory) => {
    switch (cat) {
      case 'restaurant': return 'Restaurant';
      case 'attraction': return 'Tourist attraction';
      case 'activity': return 'Local activity';
      default: return 'Establishment';
    }
  };

  // Hours status helper (Open/Closed)
  const getOpeningStatus = () => {
    if (details.business_status === 'CLOSED_TEMPORARILY') {
      return { text: 'Temporarily Closed', color: 'text-red-500 font-bold' };
    }
    return { text: 'Open', color: 'text-emerald-600 dark:text-emerald-400 font-bold' };
  };

  const openStatus = getOpeningStatus();

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col scrollbar-thin">
      {/* 1. TOP HERO & PHOTOS GRID (Google Maps style photo strip) */}
      <div className="relative w-full shrink-0">
        {allImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 h-[220px] bg-slate-100 dark:bg-slate-800">
            {/* Primary main image (spans 2 columns) */}
            <div className="col-span-2 relative h-full">
              <Image 
                src={activeImage} 
                alt={place.name} 
                fill 
                className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxIndex(0)}
                sizes="(max-width: 768px) 60vw, 40vw"
              />
            </div>
            {/* Secondary image slots (stacked on right column) */}
            <div className="grid grid-rows-2 gap-1 h-full">
              {allImages.slice(1, 3).map((imgUrl, idx) => (
                <div key={idx} className="relative h-full w-full">
                  <Image 
                    src={imgUrl} 
                    alt={`${place.name} photo ${idx}`} 
                    fill 
                    className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxIndex(idx + 1)}
                    sizes="20vw"
                  />
                  {idx === 1 && allImages.length > 3 && (
                    <div 
                      className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-sm cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex(3);
                      }}
                    >
                      +{allImages.length - 3} photos
                    </div>
                  )}
                </div>
              ))}
              {allImages.length <= 1 && (
                <div className="row-span-2 bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Globe size={32} className="opacity-25" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[180px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Globe size={48} className="opacity-25" />
          </div>
        )}
      </div>

      {/* 2. PLACE HEADER IDENTIFICATION */}
      <div className="px-6 py-5">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">{place.name}</h2>
        
        {/* Rating & Review summary */}
        <div className="flex items-center gap-1.5 mt-1.5 text-sm font-medium text-slate-650 dark:text-slate-400">
          <span className="text-slate-850 dark:text-slate-200 font-bold">{place.rating || 'New'}</span>
          <div className="flex text-amber-500">
            {Array(5).fill(0).map((_, i) => (
              <Star key={i} size={14} className={i < (place.rating || 0) ? "fill-current text-amber-450" : "text-slate-300 dark:text-slate-700"} />
            ))}
          </div>
          {place.ratings_count > 0 && (
            <span className="hover:underline cursor-pointer">
              ({place.ratings_count} reviews)
            </span>
          )}
          <span>·</span>
          <span>{getCategoryLabel(place.category)}</span>
          {place.price_label && (
            <>
              <span>·</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{place.price_label}</span>
            </>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 mt-2 text-sm text-slate-500 dark:text-slate-400">
          <span className={openStatus.color}>{openStatus.text}</span>
          {details.opening_hours && details.opening_hours[0] && (
            <>
              <span>·</span>
              <span>{details.opening_hours[0].split(': ').slice(1).join(': ')}</span>
            </>
          )}
        </div>
      </div>

      {/* 3. ACTION BUTTONS ROW */}
      <div className="px-6 pb-6 border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex flex-wrap gap-6 items-center">
          {/* Directions */}
          <a 
            href={googleMapsUrl} 
            target="_blank" 
            rel="noreferrer"
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors shadow-sm group-hover:border-blue-300">
              <Navigation size={18} className="fill-current text-blue-600 rotate-45" />
            </div>
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Directions</span>
          </a>

          {/* Bookmark / Save */}
          <button 
            onClick={() => setIsBookmarked(!isBookmarked)}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-colors shadow-sm ${isBookmarked ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/30' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <Bookmark size={18} className={isBookmarked ? 'fill-current' : ''} />
            </div>
            <span className={`text-[11px] font-medium ${isBookmarked ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {isBookmarked ? 'Saved' : 'Save'}
            </span>
          </button>

          {/* Website */}
          {details.website_uri && (
            <a 
              href={details.website_uri} 
              target="_blank" 
              rel="noreferrer"
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors shadow-sm group-hover:border-blue-300">
                <Globe size={18} />
              </div>
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Website</span>
            </a>
          )}

          {/* Phone */}
          {details.national_phone_number && (
            <a 
              href={`tel:${details.national_phone_number}`}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors shadow-sm group-hover:border-blue-300">
                <Phone size={18} />
              </div>
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Call</span>
            </a>
          )}
        </div>
      </div>

      {/* 4. DETAILS ROW-BY-ROW INFORMATION LIST */}
      <div className="py-4 border-b border-slate-100 dark:border-slate-800/60 text-sm space-y-1">
        {/* Address Row */}
        {place.address && (
          <div className="flex gap-4 px-6 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
            <MapPin size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{place.address}</div>
          </div>
        )}

        {/* Schedule / Hours Row with Collapse/Expand */}
        {details.opening_hours && Array.isArray(details.opening_hours) && (
          <div className="px-6 py-1">
            <button 
              onClick={() => setShowAllHours(!showAllHours)}
              className="w-full flex gap-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left group"
            >
              <Clock size={18} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 flex justify-between items-center text-slate-700 dark:text-slate-300 font-medium">
                <div>
                  <span className={openStatus.color}>{openStatus.text}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400 text-xs">
                    {showAllHours ? 'Hide weekly schedule' : 'Show weekly schedule'}
                  </span>
                </div>
                {showAllHours ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            
            {showAllHours && (
              <div className="pl-9 pr-6 py-2 text-xs space-y-2 border-l-2 border-slate-100 dark:border-slate-800 ml-2 mt-1">
                {details.opening_hours.map((hourStr, idx) => {
                  const parts = hourStr.split(': ');
                  const day = parts[0];
                  const hours = parts.slice(1).join(': ');
                  return (
                    <div key={idx} className="flex justify-between pb-1 text-slate-650 dark:text-slate-400 font-semibold border-b border-slate-50 dark:border-slate-800/20 last:border-0">
                      <span>{day}</span>
                      <span>{hours}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Phone Row */}
        {details.national_phone_number && (
          <a 
            href={`tel:${details.national_phone_number}`}
            className="flex gap-4 px-6 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group text-slate-700 dark:text-slate-300 font-medium"
          >
            <Phone size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div>{details.national_phone_number}</div>
          </a>
        )}

        {/* Website Link Row */}
        {details.website_uri && (
          <a 
            href={details.website_uri} 
            target="_blank" 
            rel="noreferrer"
            className="flex gap-4 px-6 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group text-blue-600 dark:text-blue-400 font-medium"
          >
            <Globe size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="truncate flex items-center gap-1">
              {details.website_uri.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
              <ExternalLink size={12} />
            </div>
          </a>
        )}
      </div>

      {/* 5. AMENITIES / ABOUT LIST */}
      <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800/60">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5">About this place</h3>
        <div className="flex flex-wrap gap-2">
          {details.dine_in && <span className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-750 dark:text-slate-300">🍽️ Dine-in</span>}
          {details.takeout && <span className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-750 dark:text-slate-300">🛍️ Takeout</span>}
          {details.delivery && <span className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-750 dark:text-slate-300">🛵 Delivery</span>}
          {details.serves_vegetarian_food && <span className="px-3.5 py-1.5 rounded-full bg-green-50 dark:bg-green-950/20 text-xs font-semibold text-green-700 dark:text-green-400 border border-green-100/50 dark:border-green-900/30 font-medium">🌿 Serves vegetarian food</span>}
          {details.serves_beer && <span className="px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/20 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30 font-medium">🍺 Serves beer</span>}
          {details.serves_wine && <span className="px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/20 text-xs font-semibold text-rose-700 dark:text-rose-400 border border-rose-100/50 dark:border-rose-900/30 font-medium font-medium">🍷 Serves wine</span>}
          {details.reservable && <span className="px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/20 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 font-medium font-medium">📅 Reservations required</span>}
          {details.wheelchair_accessible && <span className="px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-xs font-semibold text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 font-medium">♿ Wheelchair accessible entrance</span>}
          {details.good_for_children && <span className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-750 dark:text-slate-300 font-medium">👶 Good for kids</span>}
          {details.good_for_groups && <span className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-750 dark:text-slate-300 font-medium">👥 Good for groups</span>}
        </div>
      </div>

      {/* 6. AI INSIGHTS & ADVICE SECTION */}
      {(Object.keys(insights).length > 0 || localTips.length > 0) && (
        <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="space-y-6">
            {/* Insights */}
            {Object.keys(insights).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5 text-sm font-bold">
                  <Sparkles size={16} className="text-indigo-500 fill-current" /> Google Maps Insights
                </h4>
                <div className="space-y-3 pl-5 border-l-2 border-indigo-200 dark:border-indigo-900/50">
                  {Object.entries(insights).map(([key, value]: [string, any]) => (
                    <div key={key} className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-300 capitalize">{key.replace('_', ' ')}:</span>
                      <p className="text-slate-650 dark:text-slate-400 mt-0.5 leading-relaxed font-medium">{value.text || value.verdict}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Local Tips */}
            {localTips.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5 text-sm font-bold">
                  <AlertCircle size={16} className="text-amber-500 fill-current" /> Safety & Etiquette Advice
                </h4>
                <div className="space-y-3.5">
                  {localTips.map((tip: any, idx: number) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                      <span>💡</span>
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-300 capitalize">{tip.category.replace('_', ' ')}: </span>
                        {tip.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. DETAILED REVIEWS SECTION */}
      {details.reviews && details.reviews.length > 0 && (
        <div className="px-6 py-6 pb-20">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-6">Review Highlights</h3>
          <div className="space-y-6">
            {details.reviews.map((rev: any, idx: number) => {
              const reviewText = typeof rev.text === 'object' && rev.text ? (rev.text.text || '') : (rev.text || '');
              const authorName = rev.author_name || rev.authorAttribution?.displayName || 'Anonymous';
              const profilePhoto = rev.profile_photo_url || rev.authorAttribution?.photoUri || null;
              const relativeTime = rev.relative_time_description || rev.relative_time || rev.relativePublishTimeDescription || '';

              return (
                <div key={idx} className="space-y-2 pb-5 border-b border-slate-100 dark:border-slate-800/40 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 relative">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt={authorName} className="w-full h-full object-cover"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-200 dark:bg-slate-800 text-xs">
                          {authorName ? authorName[0] : 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-slate-900 dark:text-slate-200">{authorName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex text-amber-400">
                          {Array(5).fill(0).map((_, i) => (
                            <Star key={i} size={10} className={i < rev.rating ? "fill-current" : "text-slate-200 dark:text-slate-800"} />
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{relativeTime}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-650 dark:text-slate-350 text-xs leading-relaxed font-medium italic">&quot;{reviewText}&quot;</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. LIGHTBOX POPUP FOR ALL PHOTOS */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-6">
          {/* Close button */}
          <button 
            onClick={() => setLightboxIndex(null)}
            className="absolute top-6 right-6 z-[110] w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all active:scale-95 border border-white/10 shadow-lg text-lg font-bold"
          >
            ✕
          </button>

          {/* Main Large Image Container */}
          <div className="flex-1 flex items-center justify-center relative w-full max-h-[70vh]">
            {/* Prev button */}
            {lightboxIndex > 0 && (
              <button 
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute left-4 z-[110] w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all active:scale-95 border border-white/10 text-lg font-bold"
              >
                ◀
              </button>
            )}

            {/* Next button */}
            {lightboxIndex < allImages.length - 1 && (
              <button 
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute right-4 z-[110] w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all active:scale-95 border border-white/10 text-lg font-bold"
              >
                ▶
              </button>
            )}

            {/* Main image */}
            <div className="relative w-full h-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
              <Image 
                src={allImages[lightboxIndex] || ''} 
                alt={`${place.name} slide ${lightboxIndex}`} 
                fill 
                className="object-contain" 
                sizes="80vw"
              />
            </div>
          </div>

          {/* Bottom Thumbnails Strip */}
          <div className="h-[90px] w-full mt-6 flex justify-center gap-3 overflow-x-auto py-2">
            {allImages.map((imgUrl, i) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${lightboxIndex === i ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/20' : 'border-transparent opacity-50 hover:opacity-85'}`}
              >
                <Image src={imgUrl} alt={`${place.name} thumbnail ${i}`} fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
