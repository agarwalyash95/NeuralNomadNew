import React, { useRef, useMemo, useState } from 'react';
import { BedDouble, ArrowLeft, Wallet, Building2, MapPinned, Calendar, GitCompareArrows, Loader2, AlertCircle } from 'lucide-react';
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
import { plannerService } from '@/services/planner.service';
import type { PriceLookupResult } from '@/services/planner.types';

export interface HotelStayContext {
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  autoNights?: number;
  isOverridden: boolean;
  guests: number;
}

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
  /** Check-in/check-out + editable nights — the traveler's stay decision for this hotel. */
  stayContext: HotelStayContext;
  onNightsChange: (nights: number) => void;
  onResetNights: () => void;
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
  hotel, expandedDetails, detailsLoading, fit, onSelect, onBack, tripContext, isCompared, onCompareToggle,
  stayContext, onNightsChange, onResetNights,
}: HotelDetailSectionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Phase 2e (docs/planner-north-star-audit-and-vision.md) — a manual,
  // user-initiated check (mirrors the existing "Verify Price" pattern on
  // placed blocks), not an automatic fetch per card: TravelPriceHistory
  // has very sparse hotel coverage today, so most checks will honestly
  // come back empty, and firing this for every visible list card would be
  // an unbounded number of backend calls with no real user intent behind it.
  const [rateState, setRateState] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [rateResult, setRateResult] = useState<PriceLookupResult | null>(null);

  const theme = getCategoryStyle('hotel');
  const source = expandedDetails || hotel;
  const d = source.details || {};
  const photos = [source.image_url, ...(source.secondary_images || [])].filter(Boolean) as string[];
  const facts = buildHotelFacts(source);

  const checkNightlyRate = async () => {
    if (!stayContext.checkIn) return;
    setRateState('loading');
    try {
      // apiClient rejects on non-2xx, so the honest "no price found" 404
      // arrives here as a caught error, not a `found: false` response body.
      const resp = await plannerService.lookupPrice({
        serviceType: 'hotel',
        date: stayContext.checkIn,
        provider: source.name,
        destination: tripContext.activeNodeCityName || tripContext.destination || undefined,
      });
      setRateResult(resp.price);
      setRateState('found');
    } catch (err) {
      const apiErr = err as { status?: number };
      setRateState(apiErr.status === 404 ? 'not_found' : 'error');
    }
  };

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

      {/* Phase 2b (docs/planner-north-star-audit-and-vision.md) — isCompared/
          onCompareToggle were previously destructured with underscore
          aliases specifically to satisfy the unused-var lint rule; nothing
          in this file rendered them, so pinning for HotelCompareTray was
          completely unreachable from the detail view. */}
      {onCompareToggle && (
        <button
          type="button"
          onClick={onCompareToggle}
          aria-pressed={isCompared}
          title={isCompared ? 'Remove from comparison' : 'Add to comparison'}
          className={`absolute top-4 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur-sm cursor-pointer transition-all active:scale-95 ${
            isCompared ? 'bg-cat-stay text-white' : 'bg-white/90 text-ink-700 hover:bg-white'
          }`}
        >
          <GitCompareArrows size={16} />
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

          {/* Your Stay — a distinct, editable section: defaults to how many
              nights the itinerary already spends in this city, but the
              traveler can book fewer/more nights than the plan currently has. */}
          <div className="mt-3 rounded-xl border border-line/70 bg-paper-1 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
              <Calendar size={11} className="text-cat-stay" /> Your Stay
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-ink-700">
                {stayContext.checkIn ? (
                  <>
                    <span className="text-ink-400">Check-in</span> {stayContext.checkIn}
                    {stayContext.checkOut && stayContext.checkOut !== stayContext.checkIn && (
                      <>
                        <span className="mx-1 text-ink-300">→</span>
                        <span className="text-ink-400">Check-out</span> {stayContext.checkOut}
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-ink-400">Dates not set yet</span>
                )}
              </div>
              <div className="flex shrink-0 items-center rounded-full border border-line bg-paper-2 shadow-xs">
                <button
                  type="button"
                  aria-label="One fewer night"
                  disabled={(stayContext.nights ?? 1) <= 1}
                  onClick={() => onNightsChange(Math.max(1, (stayContext.nights ?? stayContext.autoNights ?? 1) - 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-500 hover:bg-paper-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  −
                </button>
                <span className="min-w-[58px] text-center text-[11px] font-bold tabular-nums text-ink-900">
                  {stayContext.nights ?? '—'} night{stayContext.nights === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  aria-label="One more night"
                  onClick={() => onNightsChange(Math.min(30, (stayContext.nights ?? stayContext.autoNights ?? 1) + 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-500 hover:bg-paper-1 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
            {stayContext.isOverridden && (
              <button
                type="button"
                onClick={onResetNights}
                className="mt-1.5 text-[10px] font-semibold text-cat-stay hover:underline cursor-pointer"
              >
                Reset to {stayContext.autoNights} night{stayContext.autoNights === 1 ? '' : 's'} (matches your itinerary)
              </button>
            )}

            {/* Nightly rate — manual, user-initiated (Phase 2e). Real
                historical/live data only; never a fabricated number. */}
            <div className="mt-2 border-t border-line/60 pt-2">
              {rateState === 'found' && rateResult ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold tabular-nums text-ink-900">
                    {rateResult.price}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      rateResult.provenance.tier === 'verified'
                        ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border border-dashed border-amber-300 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {rateResult.provenance.tier === 'verified' ? 'Verified' : 'Estimate'}
                  </span>
                </div>
              ) : rateState === 'not_found' ? (
                <div className="flex items-center gap-1.5 text-[10px] text-ink-400">
                  <AlertCircle size={11} /> No live rate found for these dates yet
                </div>
              ) : rateState === 'error' ? (
                <div className="flex items-center gap-1.5 text-[10px] text-ink-400">
                  <AlertCircle size={11} /> Could not check the rate right now
                </div>
              ) : (
                <button
                  type="button"
                  onClick={checkNightlyRate}
                  disabled={rateState === 'loading' || !stayContext.checkIn}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-cat-stay hover:underline disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {rateState === 'loading' ? <Loader2 size={11} className="animate-spin" /> : null}
                  {rateState === 'loading' ? 'Checking…' : 'Check nightly rate'}
                </button>
              )}
            </div>
          </div>

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
