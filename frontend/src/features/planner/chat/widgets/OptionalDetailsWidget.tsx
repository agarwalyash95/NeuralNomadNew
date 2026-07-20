import React, { useState } from 'react';
import { Sparkles, MapPin, Check } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { CURRENCY_CONFIGS, getLocalCurrency, getBudgetTier, FIELD_OPTIONS } from './fieldOptions';

interface OptionalDetailsWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function OptionalDetailsWidget({ widget, onSubmit }: OptionalDetailsWidgetProps) {
  const { code: currencyCode, symbol: currencySymbol } = getLocalCurrency();
  const config = (CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.USD) as NonNullable<typeof CURRENCY_CONFIGS[string]>;

  const rawFields = (widget.data.fields as string[]) || [];
  const fields = rawFields.length > 0 ? rawFields : ['visit_purpose', 'travelers', 'budget', 'interests', 'origin'];
  const prefilled = (widget.data.prefilled as Record<string, any>) || {};

  // State
  const [activeStep, setActiveStep] = useState(0);
  const [visitPurpose, setVisitPurpose] = useState(prefilled.visit_purpose || '');
  const [travelers, setTravelers] = useState(prefilled.travelers || 2);
  const [budgetVal, setBudgetVal] = useState(prefilled.budget_inr || prefilled.recommended_budget_inr || config.defaultValue);
  const [interests, setInterests] = useState<string[]>(prefilled.interests || []);
  const [origin, setOrigin] = useState(() => {
    if (prefilled.origin) return prefilled.origin;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neuralnomad_home_origin');
      if (saved) return saved;
    }
    return '';
  });
  const [chipValues, setChipValues] = useState<Record<string, string>>(() => ({ ...prefilled }));

  const confidenceScore = Math.min(100, Math.round(50 + (activeStep / Math.max(1, fields.length)) * 50));
  const isFormComplete = activeStep >= fields.length;

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const getChipVal = (f: string) => chipValues[f] || prefilled[f] || '';
  const setChipVal = (f: string, v: string) => setChipValues(prev => ({ ...prev, [f]: v }));

  const handleSubmit = () => {
    const tier = getBudgetTier(budgetVal, currencyCode);
    const formattedBudget = new Intl.NumberFormat(undefined).format(budgetVal);
    const parts: string[] = [];

    if (fields.includes('visit_purpose') && visitPurpose) parts.push(`purpose: ${visitPurpose}`);
    if (fields.includes('travelers')) parts.push(`${travelers} travelers`);
    if (fields.includes('budget')) parts.push(`budget: ${currencySymbol}${formattedBudget}`);
    if (fields.includes('origin') && origin.trim()) {
      parts.push(`from ${origin.trim()}`);
      if (typeof window !== 'undefined') {
        localStorage.setItem('neuralnomad_home_origin', origin.trim());
      }
    }
    if (fields.includes('interests') && interests.length) parts.push(`interests: ${interests.join(', ')}`);

    Object.entries(chipValues).forEach(([k, v]) => {
      if (v && fields.includes(k)) parts.push(`${k.replace('_', ' ')}: ${v}`);
    });

    const message = parts.length > 0 ? parts.join(', ') + '.' : 'Updated my preferences.';

    const chipPayload: Record<string, any> = {};
    Object.entries(chipValues).forEach(([k, v]) => {
      if (v && fields.includes(k)) chipPayload[k] = v;
    });

    onSubmit(message, {
      field: 'optional_trip_details',
      value: {
        visit_purpose: fields.includes('visit_purpose') ? visitPurpose : undefined,
        travelers: fields.includes('travelers') ? travelers : undefined,
        budget: fields.includes('budget') ? { tier, amount: budgetVal, currency: currencyCode } : undefined,
        budget_inr: fields.includes('budget') ? budgetVal : undefined,
        interests: fields.includes('interests') ? interests : undefined,
        origin: fields.includes('origin') && origin.trim() ? origin.trim() : undefined,
        ...chipPayload,
      },
    });
  };

  const handleSkipAll = () => {
    const tier = getBudgetTier(budgetVal, currencyCode);
    const finalPayload: Record<string, any> = {};
    fields.forEach(field => {
      if (field === 'visit_purpose') {
        finalPayload.visit_purpose = visitPurpose || prefilled.visit_purpose || 'vacation';
      } else if (field === 'travelers') {
        finalPayload.travelers = travelers || prefilled.travelers || 2;
      } else if (field === 'budget') {
        finalPayload.budget = { tier, amount: budgetVal, currency: currencyCode };
        finalPayload.budget_inr = budgetVal;
      } else if (field === 'origin') {
        finalPayload.origin = origin.trim() || prefilled.origin || 'Delhi';
      } else if (field === 'interests') {
        finalPayload.interests = interests.length > 0 ? interests : (prefilled.interests || ['nature']);
      } else {
        finalPayload[field] = chipValues[field] || prefilled[field] || FIELD_OPTIONS[field]?.[0] || 'Standard';
      }
    });

    onSubmit('Configured my travel profile with recommendations.', {
      field: 'optional_trip_details',
      value: finalPayload,
    });
  };

  const renderField = (field: string, index: number) => {
    const isCompleted = index < activeStep;
    const isFuture = index > activeStep;

    if (isFuture) {
      return (
        <div key={field} className="py-2 opacity-40">
          <label className="text-[11px] font-semibold uppercase text-ink-500">
            {field.replace('_', ' ')} (Next)
          </label>
        </div>
      );
    }

    if (isCompleted) {
      let valStr = '';
      if (field === 'visit_purpose') valStr = visitPurpose;
      else if (field === 'travelers') valStr = `${travelers} Passengers`;
      else if (field === 'origin') valStr = origin;
      else if (field === 'budget') valStr = `${currencySymbol}${new Intl.NumberFormat(undefined).format(budgetVal)}`;
      else if (field === 'interests') valStr = interests.join(', ');
      else valStr = getChipVal(field);

      return (
        <div key={field} className="flex items-center gap-2 py-2 text-sm font-medium text-ink-600 border-b border-line last:border-0">
          <Check size={14} className="text-emerald-500" />
          <span className="capitalize">{field.replace('_', ' ')}:</span>
          <span className="text-ink-900 capitalize font-bold">{valStr || 'Not set'}</span>
        </div>
      );
    }

    const nextBtn = (
      <div className="mt-4 flex items-center justify-between gap-2">
        <button onClick={handleNext} className="text-xs font-semibold text-ink-400 hover:text-ink-600 transition-colors cursor-pointer">
          Skip Step →
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSkipAll}
            className="text-xs font-extrabold text-ink-900 hover:opacity-80 transition-opacity cursor-pointer"
          >
            ⚡ Skip All & Build Plan
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg bg-ink-900 px-4 py-1.5 text-xs font-bold text-white transition-all hover:bg-violet-700 cursor-pointer"
          >
            Next Step
          </button>
        </div>
      </div>
    );

    const options = FIELD_OPTIONS[field] || ['Standard', 'Premium', 'Flexible'];
    const currentVal = getChipVal(field);

    // ACTIVE STEP
    return (
      <div key={field} className="py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {field === 'visit_purpose' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500 flex justify-between">
              <span>Trip Purpose</span>
              {prefilled.visit_purpose && <span className="text-[9px] text-ink-900 flex items-center gap-0.5"><Sparkles size={8}/> AI Detected</span>}
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Vacation', 'Business', 'Hometown', 'Family', 'Honeymoon', 'Solo'].map(p => (
                <button
                  key={p}
                  onClick={() => { setVisitPurpose(p.toLowerCase()); setTimeout(handleNext, 150); }}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border flex items-center gap-1 ${
                    visitPurpose === p.toLowerCase() ? 'bg-ink-900 text-white border-transparent' : 'bg-paper-0 text-ink-600 border-line hover:bg-paper-1'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {nextBtn}
          </div>
        )}

        {field === 'travelers' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Travelers</label>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => setTravelers(Math.max(1, travelers - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-0 text-ink-600 font-bold hover:bg-paper-1">-</button>
              <span className="w-6 text-center text-sm font-bold text-ink-800">{travelers}</span>
              <button onClick={() => setTravelers(travelers + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-0 text-ink-600 font-bold hover:bg-paper-1">+</button>
            </div>
            {nextBtn}
          </div>
        )}

        {field === 'budget' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500 flex justify-between">
              <span>Trip Budget</span>
              {prefilled.recommended_budget_inr && <span className="text-[9px] text-ink-900 flex items-center gap-0.5"><Sparkles size={8}/> Recommended</span>}
            </label>
            <div className="mt-2 text-sm font-bold text-ink-900">
              {currencySymbol}{new Intl.NumberFormat(undefined).format(budgetVal)}
            </div>
            <input type="range" min={config.min} max={config.max} step={config.step} value={budgetVal} onChange={(e) => setBudgetVal(Number(e.target.value))} className="mt-2 w-full h-1.5 cursor-pointer appearance-none rounded-lg bg-paper-0 accent-ink-900" />
            {nextBtn}
          </div>
        )}

        {field === 'origin' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Departure City</label>
            <div className="relative mt-2">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
              <input value={origin} onChange={(e) => setOrigin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNext()} placeholder="e.g. Mumbai" className="w-full rounded-lg border border-line bg-paper-0 py-1.5 pl-8 pr-3 text-sm text-ink-800 placeholder:text-ink-400" />
            </div>
            {nextBtn}
          </div>
        )}

        {field === 'interests' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500">Interests</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Food', 'Culture', 'Nature', 'Nightlife', 'Shopping', 'Relaxation', 'Adventure'].map(i => {
                const isSel = interests.includes(i.toLowerCase());
                return (
                  <button key={i} onClick={() => {
                    setInterests(prev => isSel ? prev.filter(x => x !== i.toLowerCase()) : [...prev, i.toLowerCase()]);
                  }} className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border ${isSel ? 'bg-ink-900 text-white border-transparent' : 'bg-paper-0 text-ink-600 border-line hover:bg-paper-1'}`}>
                    {i}
                  </button>
                )
              })}
            </div>
            {nextBtn}
          </div>
        )}

        {/* Dynamic chip-based fields (handles all other fields + fallback) */}
        {!['visit_purpose', 'travelers', 'budget', 'origin', 'interests'].includes(field) && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-ink-500 flex justify-between">
              <span>{field.replace('_', ' ')}</span>
              {prefilled[field] && <span className="text-[9px] text-ink-900 flex items-center gap-0.5"><Sparkles size={8}/> Recommended</span>}
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => { setChipVal(field, opt); setTimeout(handleNext, 150); }}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border ${currentVal === opt ? 'bg-ink-900 text-white border-transparent' : 'bg-paper-0 text-ink-600 border-line hover:bg-paper-1'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {nextBtn}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line-strong bg-paper-2 p-4 shadow-surface animate-fade-in">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
          <Sparkles size={14} className="text-ink-900 motion-safe:animate-pulse" />
          <span>Fine-tuning your trip</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-ink-900 uppercase tracking-wider">AI Confidence {confidenceScore}%</span>
          <div className="w-20 bg-paper-0 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-ink-900 to-violet-700 h-1.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${confidenceScore}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {fields.map((field, idx) => renderField(field, idx))}
      </div>

      <div className="mt-2 pt-2 animate-in fade-in zoom-in duration-300 border-t border-line flex items-center justify-between gap-2">
        <button
          onClick={handleSkipAll}
          className="text-xs font-semibold text-ink-400 hover:text-ink-600 transition-colors"
        >
          Skip All & Create
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> {isFormComplete ? 'Confirm Preferences' : 'Submit & Build'}
        </button>
      </div>
    </div>
  );
}
