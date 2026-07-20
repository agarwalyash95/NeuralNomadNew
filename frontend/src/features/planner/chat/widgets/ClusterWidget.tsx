import React, { useState } from 'react';
import { Sparkles, MapPin, Plane, Train, Bus, Car, Navigation } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { CURRENCY_CONFIGS, getLocalCurrency, getBudgetTier, FIELD_OPTIONS } from './fieldOptions';
import { WidgetContainer } from './shared/WidgetContainer';

/**
 * ClusterWidget — one CONNECTED decision per card (docs/master-planner-
 * conversation-model.md §2). The backend's WidgetOrchestrator ladder emits at
 * most 5 asks + 1 confirmation for a full trip (party / trip_style / logistics
 * / stay_style / journey_style / dining / fine_tune) — this is the single
 * rendering vehicle for every one of them, driven entirely by the payload
 * (`fields`, `prefilled`, `defaults`, `recommendation`, `mode_options`), so a
 * cluster rename on the backend never needs a frontend deploy.
 *
 * Submits `{ field: 'cluster_submit', value: { cluster, values, touched } }`
 * on confirm, or `{ field: 'cluster_skip', value: { cluster, defaults } }` on
 * skip — both consumed by ConversationEngine._apply_structured_value. Skip
 * forwards the payload's own `defaults` (== the recommendation) so a skipped
 * cluster still lands a sensible value instead of leaving the slot empty.
 *
 * `touched` (audit CH-09) lists the fields the user actively changed — the
 * backend locks (user_confirmed provenance) ONLY those; untouched prefill
 * submitted via "Done" stays inferred and editable by later extraction.
 */

const CLUSTER_LABELS: Record<string, string> = {
  party: "Who's traveling",
  trip_style: 'Budget & style',
  logistics: 'Travel & stay',
  stay_style: 'Your stay',
  journey_style: 'Journey preferences',
  dining: 'Dining preferences',
  fine_tune: 'Fine-tune (optional)',
  // legacy cluster names some old persisted messages may still carry
  budget: 'Your budget',
  experience: 'Trip style',
};

const NAMED_FIELDS = [
  'visit_purpose', 'travelers', 'origin', 'budget', 'interests', 'preferred_mode',
  // Phase 5 (M4 depth): rendered as their own dedicated blocks below, not
  // via the generic chip/multi-select/text fallbacks.
  'children_ages', 'budget_split',
];
const MULTI_SELECT_FIELDS = new Set(['stay_amenities', 'accessibility']);
// Phase 5 (M4 depth): interests_other/visit_purpose_other are the free-text
// escape hatch alongside the fixed chip sets — same textarea pattern
// special_notes already uses, nothing new to build.
const TEXT_FIELDS = new Set(['special_notes', 'interests_other', 'visit_purpose_other']);
const BUDGET_SPLIT_CATEGORIES = ['transport', 'stay', 'food', 'activities'] as const;

const MODE_ICONS: Record<string, React.ReactNode> = {
  flight: <Plane size={14} />,
  train: <Train size={14} />,
  bus: <Bus size={14} />,
  cab: <Navigation size={14} />,
  self_drive: <Car size={14} />,
};

interface ModeOptionDetails {
  duration?: string | null;
  price_line?: string | null;
  departure_hint?: string | null;
  provider?: string | null;
  emissions_note?: string | null;
  reasons?: string[];
  note?: string;
}

interface ModeOption {
  mode: string;
  label: string;
  recommended: boolean;
  details: ModeOptionDetails;
}

interface Recommendation {
  text?: string;
  confidence?: number;
  reasons?: string[];
}

interface ClusterWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function ClusterWidget({ widget, onSubmit, isCompleted }: ClusterWidgetProps) {
  const { code: currencyCode, symbol: currencySymbol } = getLocalCurrency();
  const config = (CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.USD) as NonNullable<
    (typeof CURRENCY_CONFIGS)[string]
  >;

  const clusterName = (widget.data.cluster as string) || 'party';
  const fields = (widget.data.fields as string[]) || [];
  const prefilled = (widget.data.prefilled as Record<string, any>) || {};
  const defaults = (widget.data.defaults as Record<string, any>) || {};
  const label = (widget.data.step_label as string) || CLUSTER_LABELS[clusterName] || 'A few preferences';
  const recommendation = (widget.data.recommendation as Recommendation) || {};
  const modeOptions = (widget.data.mode_options as ModeOption[]) || [];

  const [visitPurpose, setVisitPurpose] = useState(prefilled.visit_purpose || '');
  const [travelers, setTravelers] = useState(prefilled.travelers || 2);
  const [children, setChildren] = useState(prefilled.children || 0);
  const [budgetVal, setBudgetVal] = useState(
    prefilled.budget_inr || prefilled.recommended_budget_inr || config.defaultValue
  );
  // CH-09: only fields the user actively changed get user_confirmed
  // provenance server-side; untouched prefill stays inferred.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const markTouched = (f: string) =>
    setTouched(prev => (prev.has(f) ? prev : new Set(prev).add(f)));
  const [interests, setInterests] = useState<string[]>(prefilled.interests || []);
  const [origin, setOrigin] = useState(prefilled.origin || '');
  // Phase 5 (M4 depth): one age per child, kept in sync with the children
  // stepper above rather than a separate counter the user has to align by hand.
  const [childrenAges, setChildrenAges] = useState<number[]>(
    Array.isArray(prefilled.children_ages) ? prefilled.children_ages : []
  );
  const [budgetSplit, setBudgetSplit] = useState<Record<string, number>>(
    prefilled.budget_split && typeof prefilled.budget_split === 'object' ? prefilled.budget_split : {}
  );
  const [chipValues, setChipValues] = useState<Record<string, string>>(() => ({ ...prefilled }));
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    MULTI_SELECT_FIELDS.forEach(f => {
      if (Array.isArray(prefilled[f])) init[f] = prefilled[f];
    });
    return init;
  });
  const [textValues, setTextValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    TEXT_FIELDS.forEach(f => {
      if (typeof prefilled[f] === 'string') init[f] = prefilled[f];
    });
    return init;
  });
  const [selectedMode, setSelectedMode] = useState<string>(
    (prefilled.preferred_mode as string) || modeOptions.find(m => m.recommended)?.mode || ''
  );
  const [showWhy, setShowWhy] = useState(false);

  const getChipVal = (f: string) => chipValues[f] ?? prefilled[f] ?? '';
  const setChipVal = (f: string, v: string) => {
    markTouched(f);
    setChipValues(prev => ({ ...prev, [f]: v }));
  };
  const toggleMulti = (f: string, v: string) => {
    markTouched(f);
    setMultiValues(prev => {
      const cur = prev[f] || [];
      return { ...prev, [f]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] };
    });
  };

  const buildValues = () => {
    const tier = getBudgetTier(budgetVal, currencyCode);
    const values: Record<string, any> = {};
    if (fields.includes('visit_purpose') && visitPurpose) values.visit_purpose = visitPurpose;
    if (fields.includes('travelers')) {
      values.travelers = travelers;
      values.children = children;
    }
    if (fields.includes('children_ages') && childrenAges.length) values.children_ages = childrenAges.slice(0, children);
    if (fields.includes('budget_split') && Object.values(budgetSplit).some(v => v > 0)) values.budget_split = budgetSplit;
    if (fields.includes('origin') && origin.trim()) values.origin = origin.trim();
    if (fields.includes('budget')) {
      values.budget = { tier, amount: budgetVal, currency: currencyCode };
      values.budget_inr = budgetVal;
    }
    if (fields.includes('interests') && interests.length) values.interests = interests;
    if (fields.includes('preferred_mode') && selectedMode) values.preferred_mode = selectedMode;
    fields.forEach(f => {
      if (NAMED_FIELDS.includes(f)) return;
      if (MULTI_SELECT_FIELDS.has(f)) {
        if (multiValues[f]?.length) values[f] = multiValues[f];
      } else if (TEXT_FIELDS.has(f)) {
        if (textValues[f]?.trim()) values[f] = textValues[f].trim();
      } else {
        const v = chipValues[f];
        if (v) values[f] = v;
      }
    });
    return values;
  };

  const summarize = (values: Record<string, any>) => {
    const parts: string[] = [];
    if (values.visit_purpose) parts.push(`purpose: ${values.visit_purpose}`);
    if (values.travelers) {
      parts.push(
        values.children
          ? `${values.travelers} adults + ${values.children} kids`
          : `${values.travelers} travelers`
      );
    }
    if (values.origin) parts.push(`from ${values.origin}`);
    if (values.budget_inr) parts.push(`budget: ${currencySymbol}${new Intl.NumberFormat(undefined).format(values.budget_inr)}`);
    if (values.interests?.length) parts.push(`interests: ${values.interests.join(', ')}`);
    if (values.preferred_mode) parts.push(`by ${String(values.preferred_mode).replace(/_/g, ' ')}`);
    if (values.children_ages?.length) parts.push(`children's ages: ${values.children_ages.join(', ')}`);
    if (values.budget_split && Object.keys(values.budget_split).length) {
      parts.push(`budget split: ${Object.entries(values.budget_split).map(([c, p]) => `${c} ${p}%`).join(', ')}`);
    }
    const SUMMARIZED_ELSEWHERE = new Set([
      'visit_purpose', 'travelers', 'children', 'origin', 'budget', 'budget_inr', 'interests', 'preferred_mode',
      'children_ages', 'budget_split',
    ]);
    Object.entries(values).forEach(([k, v]) => {
      if (!SUMMARIZED_ELSEWHERE.has(k) && v) {
        parts.push(`${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`);
      }
    });
    return parts.length ? parts.join(', ') + '.' : 'Updated my preferences.';
  };

  const handleConfirm = () => {
    const values = buildValues();
    onSubmit(summarize(values), {
      field: 'cluster_submit',
      value: { cluster: clusterName, values, touched: [...touched] },
    });
  };

  const handleSkip = () => {
    onSubmit(`Skipping ${label.toLowerCase()} for now.`, {
      field: 'cluster_skip',
      value: { cluster: clusterName, defaults },
    });
  };

  const otherFields = fields.filter(
    f => !NAMED_FIELDS.includes(f) && !MULTI_SELECT_FIELDS.has(f) && !TEXT_FIELDS.has(f)
  );
  const selectedModeOption = modeOptions.find(m => m.mode === selectedMode);

  const summaryNode = (() => {
    const parts: string[] = [];
    if (fields.includes('travelers')) parts.push(`${travelers}`);
    if (fields.includes('origin') && origin) parts.push(`from ${origin}`);
    if (fields.includes('budget')) parts.push(`${currencySymbol}${new Intl.NumberFormat(undefined).format(budgetVal)}`);
    if (fields.includes('preferred_mode') && selectedMode) parts.push(selectedModeOption?.label || selectedMode);
    return parts.length ? <span className="font-semibold text-ink-800">{parts.join(' · ')}</span> : null;
  })();

  return (
    <WidgetContainer
      header={{ icon: <Sparkles size={13} />, title: label, aiRecommendation: recommendation.text }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
      onSkip={widget.data.required ? undefined : handleSkip}
    >
      {recommendation.text && (
        <div className="rounded-xl bg-paper-1 px-3 py-2 text-[11px] leading-snug text-ink-600">
          <div className="flex items-start gap-1.5">
            <Sparkles size={11} className="mt-0.5 shrink-0 text-violet-400" />
            <span>{recommendation.text}</span>
          </div>
          {!!recommendation.reasons?.length && (
            <div className="mt-1 pl-[19px]">
              <button
                type="button"
                onClick={() => setShowWhy(w => !w)}
                className="text-[10px] font-semibold text-ink-400 underline decoration-dotted hover:text-ink-600"
              >
                {showWhy ? 'Hide why' : 'Why?'}
              </button>
              {showWhy && (
                <ul className="mt-1 list-disc space-y-0.5 pl-3.5 text-[10px] text-ink-500">
                  {recommendation.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {fields.includes('visit_purpose') && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Trip purpose</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Vacation', 'Business', 'Hometown', 'Family', 'Honeymoon', 'Solo'].map(p => (
                <button
                  key={p}
                  onClick={() => { markTouched('visit_purpose'); setVisitPurpose(p.toLowerCase()); }}
                  className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    visitPurpose === p.toLowerCase()
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1 hover:text-ink-900 hover:border-ink-900/20'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {fields.includes('travelers') && (
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="text-[11px] font-semibold uppercase text-ink-500">Adults</label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => { markTouched('travelers'); setTravelers(Math.max(1, travelers - 1)); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-0 font-bold text-ink-600 hover:bg-paper-1"
                >
                  -
                </button>
                <span className="w-6 text-center text-sm font-bold text-ink-800">{travelers}</span>
                <button
                  onClick={() => { markTouched('travelers'); setTravelers(travelers + 1); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-0 font-bold text-ink-600 hover:bg-paper-1"
                >
                  +
                </button>
              </div>
            </div>
            {/* CH-11: children were previously uncapturable on the party card
                — a family of 4 was silently recorded as 4 adults. */}
            <div>
              <label className="text-[11px] font-semibold uppercase text-ink-500">Children</label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => {
                    markTouched('travelers');
                    setChildren(Math.max(0, children - 1));
                    setChildrenAges(prev => prev.slice(0, Math.max(0, children - 1)));
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-0 font-bold text-ink-600 hover:bg-paper-1"
                >
                  -
                </button>
                <span className="w-6 text-center text-sm font-bold text-ink-800">{children}</span>
                <button
                  onClick={() => {
                    markTouched('travelers');
                    setChildren(children + 1);
                    setChildrenAges(prev => [...prev, 5]);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-0 font-bold text-ink-600 hover:bg-paper-1"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase 5 (M4 depth): ages, when the card offers children_ages and
            there's at least one child — age-appropriate activity/hotel
            suitability instead of just an undifferentiated count. */}
        {fields.includes('children_ages') && children > 0 && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Children&apos;s ages</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: children }).map((_, i) => (
                <input
                  key={i}
                  type="number"
                  min={0}
                  max={17}
                  value={childrenAges[i] ?? ''}
                  onChange={e => {
                    markTouched('children_ages');
                    const age = Math.max(0, Math.min(17, Number(e.target.value) || 0));
                    setChildrenAges(prev => {
                      const next = [...prev];
                      next[i] = age;
                      return next;
                    });
                  }}
                  placeholder={`Child ${i + 1}`}
                  className="w-20 rounded-lg border border-line bg-paper-0 py-1.5 px-2 text-sm text-ink-800 placeholder:text-ink-400"
                />
              ))}
            </div>
          </div>
        )}

        {fields.includes('origin') && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Departure city</label>
            <div className="relative mt-2">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
              <input
                value={origin}
                onChange={e => { markTouched('origin'); setOrigin(e.target.value); }}
                placeholder="e.g. Mumbai"
                className="w-full rounded-lg border border-line bg-paper-0 py-1.5 pl-8 pr-3 text-sm text-ink-800 placeholder:text-ink-400"
              />
            </div>
          </div>
        )}

        {fields.includes('budget') && (
          <div>
            <label className="flex justify-between text-[11px] font-semibold uppercase text-ink-500">
              <span>Budget</span>
              {(prefilled.recommended_budget_inr || defaults.budget_inr) && (
                <span className="flex items-center gap-0.5 text-[9px] text-ink-500 bg-paper-1 px-1.5 py-0.5 rounded-full">
                  <Sparkles size={8} /> Recommended
                </span>
              )}
            </label>
            <div className="mt-2 text-sm font-bold text-ink-900">
              {currencySymbol}
              {new Intl.NumberFormat(undefined).format(budgetVal)}
            </div>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={budgetVal}
              onChange={e => { markTouched('budget'); setBudgetVal(Number(e.target.value)); }}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-paper-0 accent-ink-900"
            />
          </div>
        )}

        {/* Phase 5 (M4 depth): an OPTIONAL split of the total budget across
            categories — soft guidance for generation (plan_context.py
            prefs_prompt_block), never a second hard cap. Percentages need
            not sum to 100 — this is a weighting hint, not a strict allocation. */}
        {fields.includes('budget_split') && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Budget split (optional, %)</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BUDGET_SPLIT_CATEGORIES.map(category => (
                <div key={category}>
                  <label className="text-[10px] font-medium capitalize text-ink-400">{category}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={budgetSplit[category] ?? ''}
                    onChange={e => {
                      markTouched('budget_split');
                      const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setBudgetSplit(prev => ({ ...prev, [category]: pct }));
                    }}
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-line bg-paper-0 py-1.5 px-2 text-sm text-ink-800 placeholder:text-ink-400"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {fields.includes('interests') && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Interests</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Food', 'Culture', 'Nature', 'Nightlife', 'Shopping', 'Relaxation', 'Adventure'].map(i => {
                const isSel = interests.includes(i.toLowerCase());
                return (
                  <button
                    key={i}
                    onClick={() => {
                      markTouched('interests');
                      setInterests(prev => (isSel ? prev.filter(x => x !== i.toLowerCase()) : [...prev, i.toLowerCase()]));
                    }}
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      isSel
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1 hover:text-ink-900 hover:border-ink-900/20'
                    }`}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Explicit 5-way mode choice — every mode always tappable; real
            price/duration attach only where TravelPriceHistory has the
            route. Tapping reveals its detail panel instantly, client-side,
            no round trip. */}
        {fields.includes('preferred_mode') && modeOptions.length > 0 && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">How are you getting there?</label>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {modeOptions.map(opt => (
                <button
                  key={opt.mode}
                  onClick={() => { markTouched('preferred_mode'); setSelectedMode(opt.mode); }}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[9.5px] font-semibold transition-all ${
                    selectedMode === opt.mode
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-line bg-paper-0 text-ink-600 hover:border-ink-900/30'
                  }`}
                >
                  {opt.recommended && (
                    <span className="absolute -top-1.5 -right-1 rounded-full bg-violet-500 px-1 py-px text-[7px] font-bold text-white">
                      AI
                    </span>
                  )}
                  {MODE_ICONS[opt.mode]}
                  {opt.label}
                </button>
              ))}
            </div>
            {selectedModeOption && (
              <div className="mt-2 rounded-xl border border-line/60 bg-paper-0 px-3 py-2 text-[11px] text-ink-600">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {selectedModeOption.details.duration && (
                    <span className="font-semibold text-ink-800">{selectedModeOption.details.duration}</span>
                  )}
                  {selectedModeOption.details.price_line && <span>· {selectedModeOption.details.price_line}</span>}
                  {selectedModeOption.details.departure_hint && (
                    <span>· {selectedModeOption.details.departure_hint}</span>
                  )}
                  {selectedModeOption.details.emissions_note && (
                    <span className="text-emerald-600">· {selectedModeOption.details.emissions_note}</span>
                  )}
                </div>
                {selectedModeOption.details.note && (
                  <div className="mt-0.5 text-ink-400">{selectedModeOption.details.note}</div>
                )}
                {!!selectedModeOption.details.reasons?.length && (
                  <div className="mt-1 text-[10px] text-ink-400">{selectedModeOption.details.reasons.join(' · ')}</div>
                )}
              </div>
            )}
          </div>
        )}

        {otherFields.map(fieldName => {
          const options = FIELD_OPTIONS[fieldName] || ['Standard', 'Premium', 'Flexible'];
          const currentVal = getChipVal(fieldName);
          return (
            <div key={fieldName}>
              <label className="flex justify-between text-[11px] font-semibold uppercase text-ink-500">
                <span>{fieldName.replace(/_/g, ' ')}</span>
                {(prefilled[fieldName] || defaults[fieldName]) && (
                  <span className="flex items-center gap-0.5 text-[9px] text-ink-500 bg-paper-1 px-1.5 py-0.5 rounded-full">
                    <Sparkles size={8} /> Recommended
                  </span>
                )}
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setChipVal(fieldName, opt)}
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      currentVal === opt
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1 hover:text-ink-900 hover:border-ink-900/20'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {[...MULTI_SELECT_FIELDS].filter(f => fields.includes(f)).map(fieldName => {
          const options = FIELD_OPTIONS[fieldName] || [];
          const selected = multiValues[fieldName] || [];
          return (
            <div key={fieldName}>
              <label className="text-[11px] font-semibold uppercase text-ink-500">{fieldName.replace(/_/g, ' ')}</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {options.map(opt => {
                  const isSel = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleMulti(fieldName, opt)}
                      className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        isSel
                          ? 'border-ink-900 bg-ink-900 text-white'
                          : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1 hover:text-ink-900 hover:border-ink-900/20'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {[...TEXT_FIELDS].filter(f => fields.includes(f)).map(fieldName => (
          <div key={fieldName}>
            <label className="text-[11px] font-semibold uppercase text-ink-500">{fieldName.replace(/_/g, ' ')}</label>
            <textarea
              value={textValues[fieldName] || ''}
              onChange={e => { markTouched(fieldName); setTextValues(prev => ({ ...prev, [fieldName]: e.target.value })); }}
              placeholder="Optional — anything I should know"
              rows={2}
              className="mt-2 w-full resize-none rounded-lg border border-line bg-paper-0 px-3 py-1.5 text-sm text-ink-800 placeholder:text-ink-400"
            />
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
}
