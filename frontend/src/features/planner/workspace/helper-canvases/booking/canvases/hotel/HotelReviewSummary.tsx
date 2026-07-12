'use client';

import React from 'react';
import { Star, ThumbsDown } from 'lucide-react';

interface HotelReviewSummaryProps {
  reviews: any[];
  rating: number | null;
  ratingsCount: number;
}

/**
 * "What guests mention" is a real, literal keyword-mention tally across the
 * actual review text — labeled as mentions, not a per-theme star score.
 * Google's Places reviews don't carry per-theme sub-ratings (that's an OTA-
 * survey feature this data source doesn't have), so a fabricated
 * "Cleanliness: 4.6" would be a guess dressed as a fact. Counting real
 * mentions is the honest version of the same idea.
 */
const THEME_KEYWORDS: Record<string, string[]> = {
  Cleanliness: ['clean', 'tidy', 'spotless', 'dust'],
  Location: ['location', 'central', 'walk', 'near', 'close to'],
  Service: ['staff', 'service', 'friendly', 'helpful', 'rude'],
  Value: ['value', 'price', 'worth', 'expensive', 'cheap', 'overpriced'],
  Food: ['breakfast', 'food', 'restaurant', 'meal'],
};

function reviewText(rev: any): string {
  return String(rev?.text?.text ?? rev?.text ?? '').toLowerCase();
}

export default function HotelReviewSummary({ reviews, rating, ratingsCount }: HotelReviewSummaryProps) {
  if (!reviews || reviews.length === 0) return null;

  const themeMentions = Object.entries(THEME_KEYWORDS)
    .map(([theme, words]) => ({
      theme,
      count: reviews.filter((r) => words.some((w) => reviewText(r).includes(w))).length,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const highlighted = [...reviews]
    .filter((r) => (r.rating ?? 0) >= 4)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 2);
  const negative = [...reviews].filter((r) => (r.rating ?? 0) <= 2).slice(0, 2);
  const rest = reviews.filter((r) => !highlighted.includes(r) && !negative.includes(r)).slice(0, 2);

  return (
    <div className="space-y-3">
      {rating != null && (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xl font-bold text-ink-900">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            {rating}
          </span>
          <span className="text-xs text-ink-500">from {ratingsCount} reviews</span>
        </div>
      )}

      {themeMentions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">What guests mention</p>
          <div className="flex flex-wrap gap-1.5">
            {themeMentions.map((t) => (
              <span key={t.theme} className="rounded-full border border-line bg-paper-2 px-2 py-0.5 text-[10.5px] font-medium text-ink-700">
                {t.theme} · {t.count}/{reviews.length}
              </span>
            ))}
          </div>
        </div>
      )}

      {highlighted.length > 0 && <ReviewGroup label="Highlighted" reviews={highlighted} />}
      {negative.length > 0 && <ReviewGroup label="Worth knowing" reviews={negative} icon={<ThumbsDown size={11} />} />}
      {highlighted.length === 0 && negative.length === 0 && rest.length > 0 && <ReviewGroup label="Reviews" reviews={rest} />}
    </div>
  );
}

function ReviewGroup({ label, reviews, icon }: { label: string; reviews: any[]; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
        {icon}
        {label}
      </p>
      <div className="space-y-1.5">
        {reviews.map((rev, i) => (
          <div key={i} className="rounded-lg border border-line bg-paper-2 p-2.5 text-xs">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-ink-800">{rev.authorAttribution?.displayName || 'Traveler'}</span>
              <span className="flex shrink-0 text-amber-400">
                {[...Array(5)].map((_, idx) => (
                  <Star key={idx} size={10} fill={idx < (rev.rating || 0) ? 'currentColor' : 'none'} className={idx < (rev.rating || 0) ? '' : 'text-line-strong'} />
                ))}
              </span>
            </div>
            <p className="max-h-16 overflow-y-auto pr-1 text-[11px] leading-relaxed text-ink-700 custom-scrollbar">{rev.text?.text || rev.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
