'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface Review {
  rating?: number;
  text?: string | { text?: string };
  authorAttribution?: { displayName?: string; photoUri?: string };
  author_name?: string;
  profile_photo_url?: string;
  relative_time_description?: string;
  relativePublishTimeDescription?: string;
}

interface CommentSectionProps {
  reviews: Review[];
}

const TRUNCATE_LENGTH = 160;

function reviewText(review: Review): string {
  return typeof review.text === 'object' && review.text ? (review.text.text ?? '') : ((review.text as string) ?? '');
}

/**
 * One real comment: avatar, name, relative time, star row, then text that
 * truncates past TRUNCATE_LENGTH with its own "Show more"/"Show less"
 * toggle — the familiar comment-list pattern (YouTube/Maps-style), not a
 * fixed 2-review highlight reel. Every review the backend sent renders here.
 */
function CommentItem({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const text = reviewText(review);
  const author = review.authorAttribution?.displayName || review.author_name || 'Traveler';
  const photo = review.authorAttribution?.photoUri || review.profile_photo_url || null;
  const relativeTime = review.relativePublishTimeDescription || review.relative_time_description || '';
  const rating = Math.round(review.rating ?? 0);
  const isLong = text.length > TRUNCATE_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, TRUNCATE_LENGTH).trimEnd()}…`;

  return (
    <div className="flex gap-2.5 py-3 first:pt-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-2 text-[11px] font-bold text-ink-500">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google Places author photo
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          author.charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <p className="truncate text-[11.5px] font-bold text-ink-900">{author}</p>
          {relativeTime && <span className="text-[10.5px] font-medium text-ink-400">· {relativeTime}</span>}
        </div>
        {rating > 0 && (
          <div className="mt-0.5 flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={9} className={i < rating ? 'fill-amber-400 text-amber-400' : 'fill-line text-line'} />
            ))}
          </div>
        )}
        {text && (
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
            {shown}
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 cursor-pointer font-bold text-ink-900 hover:opacity-70"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ reviews }: CommentSectionProps) {
  if (!reviews || reviews.length === 0) return null;
  return (
    <div className="divide-y divide-line/70">
      {reviews.map((rev, i) => <CommentItem key={i} review={rev} />)}
    </div>
  );
}
