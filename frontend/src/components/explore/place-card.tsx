import { Attraction } from '@/services/attraction.service';
import { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import { MapPin, Star, Bookmark } from 'lucide-react';
import Image from 'next/image';

interface PlaceCardProps {
  place: Attraction | Suggestion;
  compact?: boolean;
}

export function PlaceCard({ place, compact = false }: PlaceCardProps) {
  const renderPrice = (level: number | null | undefined) => {
    if (level === null || level === undefined) return null;
    return (
      <div className="flex items-center text-green-400 font-bold tracking-widest text-sm bg-green-500/10 px-2 py-0.5 rounded backdrop-blur-sm">
        {Array(level || 1).fill('$').join('')}
      </div>
    );
  };

  const getCategoryDetails = (cat: string) => {
    switch(cat) {
      case 'restaurant': return { icon: '🍽️', color: 'from-rose-500/80 to-rose-600/80' };
      case 'museum': return { icon: '🏛️', color: 'from-blue-500/80 to-blue-600/80' };
      case 'park': return { icon: '🌳', color: 'from-green-500/80 to-green-600/80' };
      case 'tourist_attraction': return { icon: '📸', color: 'from-violet-500/80 to-violet-600/80' };
      case 'amusement_park': return { icon: '🎢', color: 'from-fuchsia-500/80 to-fuchsia-600/80' };
      case 'local_activities': return { icon: '🎭', color: 'from-amber-500/80 to-amber-600/80' };
      // Suggestion categories mapping
      case 'attraction': return { icon: '🏛️', color: 'from-blue-500/80 to-blue-600/80' };
      case 'activity': return { icon: '🎭', color: 'from-violet-500/80 to-violet-600/80' };
      case 'hotel': return { icon: '🏨', color: 'from-emerald-500/80 to-emerald-600/80' };
      default: return { icon: '📍', color: 'from-slate-700/80 to-slate-800/80' };
    }
  };

  const catDetails = getCategoryDetails(place.category);
  const ratingCount = 'ratings_count' in place ? place.ratings_count : ('review_count' in place ? place.review_count : 0);
  const priceLabel = 'price_label' in place ? place.price_label : null;
  const priceLevel = 'price_level' in place ? (place as any).price_level : null;

  return (
    <div className={`group relative overflow-hidden rounded-3xl isolate transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] cursor-pointer w-full ${compact ? 'h-[220px]' : 'h-[400px]'}`}>
      {/* Background Image */}
      <div className="absolute inset-0 bg-slate-900 z-0">
        {place.image_url ? (
          <Image
            src={place.image_url}
            alt={place.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
            sizes={compact ? "300px" : "(max-width: 768px) 100vw, 400px"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-slate-800">
            <MapPin size={compact ? 32 : 48} className="opacity-20" />
          </div>
        )}
      </div>
      
      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />

      {/* Content Container */}
      <div className={`absolute inset-0 z-20 flex flex-col ${compact ? 'p-4' : 'p-5'}`}>
        {/* Top Header */}
        <div className="flex justify-between items-start">
          <div className={`bg-gradient-to-r ${catDetails.color} backdrop-blur-md text-white rounded-full font-bold flex items-center gap-1.5 shadow-lg border border-white/10 ${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}>
            <span>{catDetails.icon}</span>
            <span className="capitalize tracking-wide">{place.category.replace('_', ' ')}</span>
          </div>
          
          <button className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors transform opacity-0 group-hover:opacity-100 translate-y-[-10px] group-hover:translate-y-0 duration-300`}>
            <Bookmark size={compact ? 12 : 16} />
          </button>
        </div>

        {/* Bottom Content */}
        <div className={`mt-auto transform transition-transform duration-500 translate-y-2 group-hover:translate-y-0`}>
          <h3 className={`font-bold text-white line-clamp-2 drop-shadow-md ${compact ? 'text-lg leading-tight mb-1' : 'text-2xl mb-2'}`}>
            {place.name}
          </h3>
          
          <p className={`text-slate-300 line-clamp-1 flex items-center gap-1.5 ${compact ? 'text-xs mb-2' : 'text-sm mb-4'}`}>
            <MapPin size={compact ? 12 : 14} className="text-primary shrink-0" />
            <span className="truncate">{place.address || (place as any).description}</span>
          </p>

          <div className={`flex items-center justify-between border-white/10 ${compact ? 'pt-2 border-t border-dashed' : 'pt-4 border-t'}`}>
            <div className={`flex items-center gap-1 bg-black/50 backdrop-blur-md text-amber-400 rounded-lg font-bold border border-white/5 ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm rounded-xl'}`}>
              <Star size={compact ? 12 : 16} className="fill-current" />
              <span>{place.rating ? place.rating.toFixed(1) : 'New'}</span>
              {ratingCount > 0 && !compact && (
                <span className="text-xs text-white/60 font-medium ml-1">({ratingCount})</span>
              )}
            </div>
            
            {priceLabel ? (
              <div className="flex items-center text-green-400 font-bold text-xs bg-green-500/10 px-2.5 py-1 rounded backdrop-blur-sm">
                {priceLabel}
              </div>
            ) : renderPrice(priceLevel)}
          </div>
        </div>
      </div>
    </div>
  );
}

