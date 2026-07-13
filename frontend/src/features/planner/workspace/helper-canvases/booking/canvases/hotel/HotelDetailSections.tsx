import React, { useRef, useMemo } from 'react';
import { BedDouble, ArrowLeft, Wallet, Building2, MapPinned } from 'lucide-react';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import type { TripFitResult } from './tripFit';
import HotelReviewSummary from './HotelReviewSummary';
import { buildHotelFacts } from './hotelFacts';
import { getCategoryStyle } from '@/features/planner/workspace/plan-canvas/utils/categoryStyle';
import DetailHero from '@/features/planner/workspace/helper-canvases/shared/detail-panel/DetailHero';
import DecisionBand, { type DecisionStat } from '@/features/planner/workspace/helper-canvases/shared/detail-panel/DecisionBand';
import FitChecklist from '@/features/planner/workspace/helper-canvases/shared/detail-panel/FitChecklist';
import ReferenceRows from '@/features/planner/workspace/helper-canvases/shared/detail-panel/ReferenceRows';
import CommentSection from '@/features/planner/workspace/helper-canvases/shared/detail-panel/CommentSection';
import DetailCTAFooter from '@/features/planner/workspace/helper-canvases/shared/detail-panel/DetailCTAFooter';
import { TripContext } from '@/features/planner/workspace/types';

interface HotelDetailSectionsProps {
  hotel: Suggestion;
  expandedDetails: Suggestion | null;
  detailsLoading: boolean;
  fit: TripFitResult;
  isPending: boolean;
  isCompared: boolean;
  onSelect: () => void;
  onCompareToggle: () => void;
  onBack?: () => void;
  tripContext: TripContext;
}

/**
 * Same anatomy as the explore detail panels, which mirror RichHoverCard:
 * hero (identity + gallery + swap context) → decision band (Trip Fit meter
 * + the numbers) → fit reasons → hours/directions → narrative + amenity
 * chips → rating summary → comments (last, every review, each expandable).
 * No tabs, no big stat cards, no oversized CTA bar. Only real reference
 * data renders — the invented per-name tagline and fabricated About
 * fallback that previously lived here are gone.
 */
export default function HotelDetailSections({
  hotel, expandedDetails, detailsLoading, fit, onSelect, onBack, tripContext, isCompared: _isCompared, onCompareToggle: _onCompareToggle,
}: HotelDetailSectionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const theme = getCategoryStyle('hotel');
  const source = expandedDetails || hotel;
  const d = source.details || {};
  const photos = [source.image_url, ...(source.secondary_images || [])].filter(Boolean) as string[];
  const facts = buildHotelFacts(source);

  const stats = useMemo(() => {
    const items: DecisionStat[] = [];
    if (source.price_label) items.push({ icon: Wallet, text: source.price_label });
    if (d.star_rating != null) items.push({ icon: Building2, text: `${d.star_rating}-star` });
    if (source.distance_km != null) items.push({ icon: MapPinned, text: `${source.distance_km.toFixed(1)} km away` });
    return items;
  }, [source.price_label, d.star_rating, source.distance_km]);

  const meterHeadline = fit.score >= 80 ? 'Excellent' : fit.score >= 60 ? 'Good' : 'Fair';
  const meterCaption = fit.score >= 80 ? 'Closest match for your itinerary' : fit.score >= 60 ? 'Good alignment with your plan' : 'Some compromises on location';

  const positiveChecks = useMemo(
    () => fit.reasons.filter(r => r.tone === 'positive').slice(0, 3),
    [fit.reasons],
  );

  const ctaReason = useMemo(() => {
    const first = fit.reasons.find(r => r.tone === 'positive');
    return first ? first.text : `${fit.score}% trip fit score`;
  }, [fit.reasons, fit.score]);

  if (detailsLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-cat-stay" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-paper-1 select-none">
      {onBack && (
        <button type="button" onClick={onBack} className="absolute top-4 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-md text-ink-700 hover:bg-white cursor-pointer transition-all active:scale-95">
          <ArrowLeft size={16} />
        </button>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
        <DetailHero
          photos={photos}
          badgeLabel="Hotel"
          title={source.name}
          tagline={source.subtitle}
          rating={source.rating}
          ratingsCount={source.ratings_count}
          replacingLabel={tripContext.activeNodeTitle}
          replacingDetail={tripContext.activeNodeDayLabel ? `${tripContext.activeNodeDayLabel}, overnight` : null}
          FallbackIcon={BedDouble}
          fallbackGradientClassName={theme.gradient}
          fallbackIconClassName={theme.text}
        />

        <div className="px-6 pt-5 pb-20">
          <DecisionBand
            stats={stats}
            meter={{
              label: 'Trip fit',
              headline: `${meterHeadline} · ${fit.score}%`,
              caption: meterCaption,
              filled: Math.round(fit.score / 10),
              total: 10,
              accentBgClassName: 'bg-cat-stay',
              accentTextClassName: 'text-cat-stay',
            }}
          />

          {positiveChecks.length > 0 && (
            <div className="mt-3">
              <FitChecklist items={positiveChecks.map(c => c.text)} accentClassName="text-cat-stay" />
            </div>
          )}

          <div className="mt-3 border-t border-line/70 pt-3">
            <ReferenceRows
              openingHours={d.opening_hours}
              address={source.address}
              latitude={source.latitude}
              longitude={source.longitude}
              phone={d.national_phone_number}
              website={d.website_uri}
            />
          </div>

          {d.editorial_summary && (
            <p className="mt-3 text-[12px] font-medium leading-relaxed text-ink-600">{d.editorial_summary}</p>
          )}

          {facts.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {facts.slice(0, 8).map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-ink-600">
                  {f.label}
                </span>
              ))}
            </div>
          )}

          {d.reviews && d.reviews.length > 0 && (
            <div className="mt-4 border-t border-line/70 pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">Reviews</p>
              <HotelReviewSummary reviews={d.reviews} rating={source.rating} ratingsCount={source.ratings_count} />
              <div className="mt-3">
                <CommentSection reviews={d.reviews} />
              </div>
            </div>
          )}
        </div>
      </div>

      <DetailCTAFooter label="Replace" onClick={onSelect} metricLabel={ctaReason} accentClassName="text-cat-stay" />
    </div>
  );
}
