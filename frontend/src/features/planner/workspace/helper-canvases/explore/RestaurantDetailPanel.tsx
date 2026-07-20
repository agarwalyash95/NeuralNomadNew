import React, { useRef, useMemo } from 'react';
import { Utensils, ArrowLeft, Footprints, Wallet, Clock, GitCompareArrows } from 'lucide-react';
import type { MealRecommendation } from './services/mealRecommendationEngine';
import { getFoodFirstPhotos, isOpenNow } from './services/mealPresentation';
import { getCategoryStyle } from '../../plan-canvas/utils/categoryStyle';
import DetailHero from '../shared/detail-panel/DetailHero';
import DecisionBand, { type DecisionStat } from '../shared/detail-panel/DecisionBand';
import InsightCallout from '../shared/detail-panel/InsightCallout';
import ReferenceRows from '../shared/detail-panel/ReferenceRows';
import CommentSection from '../shared/detail-panel/CommentSection';
import DetailCTAFooter from '../shared/detail-panel/DetailCTAFooter';
import { buildJudgmentLine, buildFactChips } from '../shared/detail-panel/placeFacts';
import { TripContext } from '../../types';

interface RestaurantDetailPanelProps {
  recommendation: MealRecommendation;
  isPending: boolean;
  onSelect: () => void;
  onCompareToggle: () => void;
  isCompared: boolean;
  onBack?: () => void;
  tripContext: TripContext;
}

/**
 * The detail panel is RichHoverCard expanded, not a different interface:
 * same inline stat row, same gradient insight box, same chip/divider
 * language, just with the hero as a full header and room for reviews +
 * reference rows the hover card can't fit. Hero (identity + gallery + swap
 * context) → decision band → insight → hours/directions → narrative + fact
 * chips → comments (last, every review, each expandable). No tabs, no big
 * stat cards, no oversized CTA bar.
 */
export default function RestaurantDetailPanel({
  recommendation, onSelect, onBack, tripContext, isCompared, onCompareToggle,
}: RestaurantDetailPanelProps) {
  const { suggestion, walkTimeMins, estimatedCostForTwo, costIsEstimate } = recommendation;

  const theme = getCategoryStyle('food');
  const details = suggestion.details ?? {};
  const allPhotos = getFoodFirstPhotos(suggestion);
  const openStatus = isOpenNow(details.opening_hours);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const items: DecisionStat[] = [];
    if (walkTimeMins != null) items.push({ icon: Footprints, text: `${walkTimeMins} min walk` });
    if (estimatedCostForTwo !== null) {
      items.push({ icon: Wallet, text: `${costIsEstimate ? 'Est. ' : ''}₹${estimatedCostForTwo.toLocaleString('en-IN')} for two` });
    } else if (suggestion.price_label) {
      items.push({ icon: Wallet, text: suggestion.price_label });
    }
    if (openStatus !== 'unknown') {
      items.push({
        icon: Clock,
        text: openStatus === 'open' ? 'Open now' : 'Closed now',
        toneClassName: openStatus === 'open' ? 'text-emerald-600' : 'text-rose-500',
      });
    }
    return items;
  }, [walkTimeMins, estimatedCostForTwo, costIsEstimate, suggestion.price_label, openStatus]);

  const judgment = buildJudgmentLine(details.insights);
  const localTip = details.local_tips?.[0] ?? null;
  const factChips = buildFactChips(details);
  const reviews = details.reviews ?? [];

  const ctaReason = walkTimeMins != null
    ? `${walkTimeMins} min walk from your current route`
    : estimatedCostForTwo !== null
      ? `${costIsEstimate ? 'Est. ' : ''}₹${estimatedCostForTwo} for two`
      : undefined;

  return (
    <div className="relative flex h-full flex-col bg-paper-1 select-none">
      {onBack && (
        <button type="button" onClick={onBack} className="absolute top-4 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-md text-ink-700 hover:bg-white cursor-pointer transition-all active:scale-95">
          <ArrowLeft size={16} />
        </button>
      )}

      {/* Phase 2b (docs/planner-north-star-audit-and-vision.md) — was
          destructured with underscore aliases to satisfy the unused-var
          lint rule; nothing rendered them, so RestaurantCompareTray pinning
          was unreachable from this panel. */}
      {onCompareToggle && (
        <button
          type="button"
          onClick={onCompareToggle}
          aria-pressed={isCompared}
          title={isCompared ? 'Remove from comparison' : 'Add to comparison'}
          className={`absolute top-4 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur-sm cursor-pointer transition-all active:scale-95 ${
            isCompared ? 'bg-cat-food text-white' : 'bg-white/90 text-ink-700 hover:bg-white'
          }`}
        >
          <GitCompareArrows size={16} />
        </button>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
        <DetailHero
          photos={allPhotos}
          badgeLabel="Restaurant"
          title={suggestion.name}
          tagline={suggestion.subtitle}
          rating={suggestion.rating}
          ratingsCount={suggestion.ratings_count}
          replacingLabel={tripContext.activeNodeTitle}
          replacingDetail={tripContext.activeNodeDayLabel
            ? `${tripContext.activeNodeDayLabel}${tripContext.activeNodeStartTime ? `, ${tripContext.activeNodeStartTime}` : ''}`
            : null}
          FallbackIcon={Utensils}
          fallbackGradientClassName={theme.gradient}
          fallbackIconClassName={theme.text}
        />

        <div className="px-6 pt-5 pb-20">
          <DecisionBand stats={stats} />

          {(judgment || localTip) && (
            <div className="mt-3">
              <InsightCallout judgment={judgment} tip={localTip} />
            </div>
          )}

          <div className="mt-3 border-t border-line/70 pt-3">
            <ReferenceRows
              openingHours={details.opening_hours}
              address={suggestion.address}
              latitude={suggestion.latitude}
              longitude={suggestion.longitude}
              phone={details.national_phone_number}
              website={details.website_uri}
            />
          </div>

          {details.editorial_summary && (
            <p className="mt-3 text-[12px] font-medium leading-relaxed text-ink-600">{details.editorial_summary}</p>
          )}

          {factChips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {factChips.map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-ink-600">
                  <Icon size={10} className="text-ink-400" /> {label}
                </span>
              ))}
            </div>
          )}

          {reviews.length > 0 && (
            <div className="mt-4 border-t border-line/70 pt-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">Reviews</p>
              <CommentSection reviews={reviews} />
            </div>
          )}
        </div>
      </div>

      <DetailCTAFooter label="Replace" onClick={onSelect} metricLabel={ctaReason} accentClassName="text-cat-food" />
    </div>
  );
}
