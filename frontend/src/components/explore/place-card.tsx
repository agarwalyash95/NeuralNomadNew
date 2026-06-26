import { Attraction } from '@/services/attraction.service';
import { MapPin, Star, Bookmark } from 'lucide-react';
import Image from 'next/image';

interface PlaceCardProps {
  place: Attraction;
}

export function PlaceCard({ place }: PlaceCardProps) {
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
      default: return { icon: '📍', color: 'from-slate-700/80 to-slate-800/80' };
    }
  };

  const catDetails = getCategoryDetails(place.category);

  return (
    <div className="group relative overflow-hidden rounded-3xl h-[400px] w-full isolate transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] cursor-pointer">
      {/* Background Image */}
      <div className="absolute inset-0 bg-slate-900 z-0">
        {place.image_url ? (
          <Image
            src={place.image_url}
            alt={place.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-slate-800">
            <MapPin size={48} className="opacity-20" />
          </div>
        )}
      </div>
      
      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />

      {/* Content Container */}
      <div className="absolute inset-0 z-20 p-5 flex flex-col">
        {/* Top Header */}
        <div className="flex justify-between items-start">
          <div className={`bg-gradient-to-r ${catDetails.color} backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/10`}>
            <span>{catDetails.icon}</span>
            <span className="capitalize tracking-wide">{place.category.replace('_', ' ')}</span>
          </div>
          
          <button className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors transform opacity-0 group-hover:opacity-100 translate-y-[-10px] group-hover:translate-y-0 duration-300">
            <Bookmark size={16} />
          </button>
        </div>

        {/* Bottom Content */}
        <div className="mt-auto transform transition-transform duration-500 translate-y-4 group-hover:translate-y-0">
          <h3 className="font-bold text-2xl text-white line-clamp-2 mb-2 drop-shadow-md">
            {place.name}
          </h3>
          
          <p className="text-sm text-slate-300 line-clamp-1 mb-4 flex items-center gap-1.5">
            <MapPin size={14} className="text-primary" />
            {place.address || place.description}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md text-amber-400 px-3 py-1.5 rounded-xl text-sm font-bold border border-white/5">
              <Star size={16} className="fill-current" />
              <span>{place.rating ? place.rating.toFixed(1) : 'New'}</span>
              {place.review_count > 0 && (
                <span className="text-xs text-white/60 font-medium ml-1">({place.review_count})</span>
              )}
            </div>
            
            {renderPrice((place as any).price_level)}
          </div>
        </div>
      </div>
    </div>
  );
}
