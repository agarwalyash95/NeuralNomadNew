'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface HotelReviewSummaryProps {
  reviews: any[];
  rating: number | null;
  ratingsCount: number;
}

/**
 * The aggregate signal only — overall rating + "what guests mention" theme
 * tally. The actual review list lives in CommentSection, rendered
 * separately as the panel's last section; this stays a compact summary
 * that sits right after the fit reasons, not a review list of its own.
 *
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

  return (
    <div className="space-y-2.5">
      {rating != null && (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[15px] font-bold text-ink-900">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            {rating}
          </span>
          <span className="text-[11px] font-medium text-ink-500">from {ratingsCount.toLocaleString()} reviews</span>
        </div>
      )}

      {themeMentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {themeMentions.map((t) => (
            <span key={t.theme} className="rounded-full border border-line bg-paper-2 px-2 py-0.5 text-[10.5px] font-medium text-ink-700">
              {t.theme} · {t.count}/{reviews.length}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
