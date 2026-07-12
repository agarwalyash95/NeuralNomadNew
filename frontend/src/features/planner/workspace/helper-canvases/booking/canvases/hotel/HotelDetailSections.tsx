'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronDown, Check, ArrowRightLeft, Phone, Map, Globe, Clock, BedDouble, Info } from 'lucide-react';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import { FOCUS_RING_CLASS } from '@/lib/utils';
import type { TripFitResult } from './tripFit';
import HotelPhotoGallery from './HotelPhotoGallery';
import HotelReviewSummary from './HotelReviewSummary';
import { buildHotelFacts } from './hotelFacts';

interface HotelDetailSectionsProps {
  hotel: Suggestion;
  expandedDetails: Suggestion | null;
  detailsLoading: boolean;
  fit: TripFitResult;
}

/**
 * Everything that isn't the collapsed-card decision facts, organized so the
 * itinerary story (why it scores well, what it does to the plan) reads
 * before the traditional catalog sections (photos, rooms, amenities,
 * reviews) — those support the decision, they don't lead it. The detailed
 * day-by-day "Nearby itinerary" breakdown was cut for taking up too much
 * space per session feedback — the Trip Fit reasons below already surface
 * the same distance/time facts in one line each.
 */
export default function HotelDetailSections({ hotel, expandedDetails, detailsLoading, fit }: HotelDetailSectionsProps) {
  if (detailsLoading) {
    return (
      <div className="flex justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-cat-stay" />
      </div>
    );
  }

  const source = expandedDetails || hotel;
  const d = source.details || {};
  const photos = [source.image_url, ...(source.secondary_images || [])].filter(Boolean) as string[];
  const facts = buildHotelFacts(source);

  return (
    <div className="space-y-3">
      {/* AI reasoning — always open, this is the headline content */}
      <div className="rounded-xl border border-dashed border-trust-estimated/40 bg-trust-estimated/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-trust-estimated">
          <Sparkles size={13} strokeWidth={2.5} />
          <span className="text-xs font-bold">Trip Fit — {fit.score}%</span>
        </div>
        {fit.reasons.length > 0 ? (
          <ul className="space-y-1.5">
            {fit.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs leading-snug text-ink-700">
                {r.tone === 'positive' ? (
                  <Check size={13} className="mt-0.5 shrink-0 text-trust-estimated" strokeWidth={3} />
                ) : (
                  <ArrowRightLeft size={12} className="mt-0.5 shrink-0 text-ink-400" />
                )}
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-500">Add planned stops to your itinerary to see how this hotel fits your trip.</p>
        )}
      </div>

      {d.editorial_summary && (
        <Section title="Overview" defaultOpen>
          <p className="rounded-lg border border-line bg-paper-2 p-3 text-xs italic leading-relaxed text-ink-700">&quot;{d.editorial_summary}&quot;</p>
          {d.opening_hours?.[0] && (
            <p className="mt-2 flex items-center gap-2 text-xs text-ink-500">
              <Clock size={12} className="text-ink-400" /> {d.opening_hours[0]}
            </p>
          )}
        </Section>
      )}

      {photos.length > 0 && (
        <Section title="Photos" defaultOpen>
          <HotelPhotoGallery images={photos} title={source.name} />
        </Section>
      )}

      {d.room_tiers && d.room_tiers.length > 0 && (
        <Section title="Rooms">
          <div className="space-y-1.5">
            {d.room_tiers.map((tier: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper-2 p-2.5 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-ink-800">
                  <BedDouble size={12} className="text-cat-stay" /> {tier.tier_name}
                </span>
                {tier.price_premium_pct != null && (
                  <span className="font-medium text-ink-500">+{tier.price_premium_pct}% vs. base</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(facts.length > 0 || (d.seasonal_amenities && d.seasonal_amenities.length > 0)) && (
        <Section title="Amenities">
          <div className="flex flex-wrap gap-1.5">
            {facts.map((f, i) => (
              <span key={i} className="rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[11px] font-medium text-ink-700">
                {f.label}
              </span>
            ))}
            {(d.seasonal_amenities || []).map((a: any, i: number) => (
              <span key={`s-${i}`} className="rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[11px] font-medium text-ink-700">
                {a.amenity}
              </span>
            ))}
          </div>
        </Section>
      )}

      {d.reviews && d.reviews.length > 0 && (
        <Section title="Reviews">
          <HotelReviewSummary reviews={d.reviews} rating={source.rating} ratingsCount={source.ratings_count} />
        </Section>
      )}

      <Section title="Location">
        <p className="mb-2 text-xs text-ink-700">{source.address}</p>
        <div className="flex items-center gap-2">
          {d.national_phone_number && (
            <a href={`tel:${d.national_phone_number}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-paper-2 border border-line py-2 text-xs font-semibold text-ink-700 transition hover:bg-paper-1">
              <Phone size={13} /> Call
            </a>
          )}
          {source.latitude != null && source.longitude != null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${source.latitude},${source.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-paper-2 border border-line py-2 text-xs font-semibold text-ink-700 transition hover:bg-paper-1"
            >
              <Map size={13} /> Directions
            </a>
          )}
          {d.website_uri && (
            <a
              href={d.website_uri}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cat-stay/10 py-2 text-xs font-semibold text-cat-stay transition hover:bg-cat-stay/15"
            >
              <Globe size={13} /> Website
            </a>
          )}
        </div>
      </Section>

      {(d.reservation_policy || d.accessibility_detail) && (
        <Section title="Policies">
          <div className="space-y-1.5 text-xs text-ink-700">
            {d.reservation_policy && <p>Reservation: <span className="font-semibold capitalize">{d.reservation_policy.replace(/_/g, ' ')}</span></p>}
            {d.accessibility_detail?.step_free != null && (
              <p>{d.accessibility_detail.step_free ? 'Step-free access' : 'Not step-free'}</p>
            )}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] text-ink-400">
            <Info size={11} className="mt-0.5 shrink-0" />
            Cancellation, refund, and breakfast policy aren&apos;t confirmed yet for this listing — check with the property before booking.
          </p>
        </Section>
      )}

      <Section title="Price & availability">
        <div className="flex items-center justify-between">
          <div>
            {source.cost?.amount != null ? (
              <p className="text-lg font-bold tabular-nums text-ink-900">{source.price_label}</p>
            ) : d.price_range ? (
              <div>
                <p className="text-sm font-bold text-ink-900">Price tier {d.price_range}</p>
                <p className="text-[10.5px] text-ink-400">Live rate not connected yet</p>
              </div>
            ) : (
              <p className="text-xs text-ink-400">No pricing data available</p>
            )}
          </div>
          {source.cost?.provenance && <ProvenanceBadge provenance={source.cost.provenance} detail />}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className={`flex min-h-[40px] w-full items-center justify-between px-3 py-2 text-left ${FOCUS_RING_CLASS}`}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-ink-700">{title}</span>
        <ChevronDown size={14} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-line p-3 pt-2.5">{children}</div>}
    </div>
  );
}
