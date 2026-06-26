'use client';

import Link from 'next/link';
import { AIFeatureTile } from '@/services/homepage.service';

interface AIFeaturesStripProps {
  features: AIFeatureTile[];
}

export default function AIFeaturesStrip({ features }: AIFeaturesStripProps) {
  if (!features.length) return null;

  return (
    <section className="py-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((tile) => (
          <Link
            key={tile.id}
            href={tile.cta_url}
            className="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md transition-all duration-200"
          >
            <div className="text-3xl mb-3">{tile.emoji}</div>
            <h3 className="font-bold text-slate-900 text-base">{tile.title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{tile.description}</p>
            <span className="mt-3 inline-flex items-center text-sm font-semibold text-blue-600 group-hover:gap-2 transition-all">
              {tile.cta_label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
