import GlassCard from './glass-card';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

interface DestinationCardProps {
  name: string;
  country: string;
  price: string;
  days: string;
  id?: string;
}

export default function DestinationCard({
  name,
  country,
  price,
  days,
  id = '#',
}: DestinationCardProps) {
  return (
    <GlassCard className="overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <img
        src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf"
        alt={name}
        className="h-48 w-full object-cover"
      />

      <div className="p-5">
        <div className="flex items-center gap-2 text-slate-500">
          <MapPin size={14} />
          <span>{country}</span>
        </div>

        <h3 className="mt-3 text-xl font-bold">{name}</h3>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Starting From</p>

            <p className="font-bold text-blue-600">{price}</p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{days}</span>
        </div>
      </div>

      <Link
        href={id === '#' ? '#' : `/destinations/${id}`}
        className="mt-4 inline-flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2 text-white"
      >
        View Details
      </Link>
    </GlassCard>
  );
}
