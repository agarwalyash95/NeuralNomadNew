import React from 'react';
import { Sun, Calendar, Users, HelpCircle, TrendingUp, Compass, Utensils, Clock, ShieldCheck, FileText } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

/**
 * Read-only insight cards. Every branch previously fell back to hard-coded
 * placeholder content (a fake Paris itinerary, invented budget splits, made-up
 * safety tips) whenever `widget.data` arrived empty — fabricated data the
 * honest-degrade convention used everywhere else in this app explicitly
 * forbids. None of these types (`weather_insight` etc.) are currently emitted
 * by the backend — real weather/holiday/food/etc. surface today via the
 * capability envelope (chat/capabilities/CapabilityCards.tsx) and the
 * destination_highlight hero card. This component stays registered for
 * forward-compat, but now degrades honestly instead of inventing content.
 */

interface TravelIntelligenceWidgetProps {
  widget: WidgetData;
  onSubmit?: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-paper-0 p-3 text-xs italic text-ink-400">
      {text}
    </div>
  );
}

export function TravelIntelligenceWidget({ widget }: TravelIntelligenceWidgetProps) {
  const data = (widget.data || {}) as any;
  const type = (widget.type as string) || 'weather_insight';

  // Weather Insight
  if (type === 'weather_insight' || type === 'weather') {
    const forecast: Array<{ day: string; temp: string; cond: string }> = Array.isArray(data.forecast) ? data.forecast : [];
    return (
      <WidgetContainer
        header={{
          icon: <Sun size={14} className="text-amber-500" />,
          title: 'Weather Forecast',
          subtitle: data.destination ? `Expected weather in ${data.destination}` : 'Upcoming weather',
        }}
      >
        {forecast.length === 0 && !data.packing_tip ? (
          <EmptyNote text="No forecast data available for this destination yet." />
        ) : (
          <div className="flex flex-col gap-3">
            {data.packing_tip && (
              <div className="flex justify-between items-center bg-paper-0 p-2.5 rounded-xl border border-line">
                <span className="text-sm font-semibold text-ink-700">Packing Tip:</span>
                <span className="text-xs text-ink-500 font-medium">{data.packing_tip}</span>
              </div>
            )}
            {forecast.length > 0 && (
              <div className="flex gap-1.5 justify-between">
                {forecast.map((f, idx: number) => (
                  <div key={idx} className="flex flex-col items-center gap-1 bg-paper-0 border border-line p-2 rounded-xl flex-1">
                    <span className="text-[10px] font-bold text-ink-400 uppercase">{f.day}</span>
                    <span className="text-base">{f.cond.split(' ')[0]}</span>
                    <span className="text-xs font-bold text-ink-800">{f.temp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </WidgetContainer>
    );
  }

  // Holiday / Festival Insight
  if (type === 'holiday_insight' || type === 'holidays') {
    const events: Array<{ name: string; date: string; impact: string }> = Array.isArray(data.events) ? data.events : [];
    return (
      <WidgetContainer
        header={{
          icon: <Calendar size={14} className="text-rose-500" />,
          title: 'Holidays & Events',
          subtitle: 'Local festivals or public closures',
        }}
      >
        {events.length === 0 ? (
          <EmptyNote text="No known festivals or closures for these dates yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((e, idx: number) => (
              <div key={idx} className="flex flex-col gap-0.5 bg-paper-0 border border-line p-3 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-ink-800">{e.name}</span>
                  <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">{e.date}</span>
                </div>
                <span className="text-[11px] text-ink-500 font-medium mt-1">{e.impact}</span>
              </div>
            ))}
          </div>
        )}
      </WidgetContainer>
    );
  }

  // Crowd Insight
  if (type === 'crowd_insight' || type === 'crowds') {
    const level = data.level as string | undefined;
    const percentage = typeof data.percentage === 'number' ? data.percentage : null;
    if (!level) {
      return (
        <WidgetContainer
          header={{ icon: <Users size={14} className="text-blue-500" />, title: 'Crowd Level', subtitle: 'Expected tourism volume' }}
        >
          <EmptyNote text="No crowd data available for this destination yet." />
        </WidgetContainer>
      );
    }
    return (
      <WidgetContainer
        header={{
          icon: <Users size={14} className="text-blue-500" />,
          title: 'Crowd Level',
          subtitle: 'Expected tourism volume',
        }}
      >
        <div className="flex flex-col gap-3 bg-paper-0 border border-line p-3 rounded-xl">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-ink-500">Destination Capacity</span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
              level === 'Peak' ? 'bg-red-50 text-red-600' : level === 'Moderate' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {level}{percentage !== null ? ` (${percentage}%)` : ''}
            </span>
          </div>
          {percentage !== null && (
            <div className="h-2 w-full rounded-full bg-line overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  level === 'Peak' ? 'bg-red-500' : level === 'Moderate' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
          {data.description && (
            <p className="text-[11px] text-ink-500 leading-relaxed font-medium">{data.description}</p>
          )}
        </div>
      </WidgetContainer>
    );
  }

  // Budget Insight
  if (type === 'budget_insight') {
    const allocations: Array<{ category: string; amount: string; pct: number }> = Array.isArray(data.allocations) ? data.allocations : [];
    return (
      <WidgetContainer
        header={{
          icon: <TrendingUp size={14} className="text-emerald-500" />,
          title: 'Budget Allocation',
          subtitle: 'Estimated cost breakdown',
        }}
      >
        {allocations.length === 0 ? (
          <EmptyNote text="No budget breakdown available yet." />
        ) : (
          <div className="flex flex-col gap-3 bg-paper-0 border border-line p-3 rounded-xl">
            <div className="flex flex-col gap-2">
              {allocations.map((a, idx: number) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-ink-700">
                    <span>{a.category}</span>
                    <span className="font-bold text-ink-900">{a.amount}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${a.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </WidgetContainer>
    );
  }

  // Food Insight
  if (type === 'food_insight') {
    const highlights: Array<{ name: string; desc: string }> = Array.isArray(data.highlights) ? data.highlights : [];
    return (
      <WidgetContainer
        header={{
          icon: <Utensils size={14} className="text-amber-600" />,
          title: 'Food Intelligence',
          subtitle: 'Signature local dishes & dining hotspots',
        }}
      >
        {highlights.length === 0 ? (
          <EmptyNote text="No dining highlights available for this destination yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {highlights.map((h, idx: number) => (
              <div key={idx} className="flex flex-col gap-0.5 bg-paper-0 border border-line p-3 rounded-xl">
                <span className="text-xs font-bold text-ink-800">{h.name}</span>
                <span className="text-[11px] text-ink-500 font-medium">{h.desc}</span>
              </div>
            ))}
          </div>
        )}
      </WidgetContainer>
    );
  }

  // Route Insight / Route Flow
  if (type === 'route_insight') {
    const legs: Array<{ from: string; to: string; mode: string; duration: string }> = Array.isArray(data.legs) ? data.legs : [];
    return (
      <WidgetContainer
        header={{
          icon: <Compass size={14} className="text-indigo-500" />,
          title: 'Transit Route Insight',
          subtitle: 'Optimized travel route sequence',
        }}
      >
        {legs.length === 0 ? (
          <EmptyNote text="No route data available yet." />
        ) : (
          <div className="flex flex-col gap-3 relative">
            <div className="absolute left-[13px] top-6 bottom-6 w-[2px] bg-line z-0" />
            {legs.map((l, idx: number) => (
              <div key={idx} className="flex items-start gap-3 relative z-10">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 border border-line text-[10px] font-bold text-ink-500">
                  {idx + 1}
                </div>
                <div className="flex flex-col gap-0.5 bg-paper-0 border border-line p-2.5 rounded-xl flex-1">
                  <span className="text-xs font-bold text-ink-800">{l.from} → {l.to}</span>
                  <span className="text-[10px] text-ink-500 font-semibold flex items-center gap-1">
                    <Clock size={10} /> {l.mode} • {l.duration}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetContainer>
    );
  }

  // Safety Insight
  if (type === 'safety_insight') {
    const level = data.level as string | undefined;
    const tips: string[] = Array.isArray(data.tips) ? data.tips : [];
    const colorMap: Record<string, string> = {
      Safe: 'text-emerald-600 bg-emerald-50',
      Moderate: 'text-amber-600 bg-amber-50',
      Caution: 'text-red-600 bg-red-50',
    };
    return (
      <WidgetContainer
        header={{
          icon: <ShieldCheck size={14} className="text-emerald-500" />,
          title: 'Safety Overview',
          subtitle: data.destination ? `Safety info for ${data.destination}` : 'Destination safety',
        }}
      >
        {!level && tips.length === 0 ? (
          <EmptyNote text="No safety information available for this destination yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {level && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${colorMap[level] || colorMap.Safe}`}>
                <ShieldCheck size={13} /> {level} Destination
              </div>
            )}
            {tips.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {tips.map((tip, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 bg-paper-0 border border-line p-2.5 rounded-xl text-xs text-ink-600">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
                    {tip}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </WidgetContainer>
    );
  }

  // Visa Insight
  if (type === 'visa_insight') {
    const status = data.status as string | undefined;
    const processingTime = data.processing_time as string | undefined;
    const fee = data.fee as string | undefined;
    const steps: string[] = Array.isArray(data.steps) ? data.steps : [];
    if (!status && !processingTime && !fee && steps.length === 0) {
      return (
        <WidgetContainer
          header={{ icon: <FileText size={14} className="text-blue-500" />, title: 'Visa Information', subtitle: data.destination ? `Visa requirements for ${data.destination}` : 'Visa requirements' }}
        >
          <EmptyNote text="No visa information available for this destination yet." />
        </WidgetContainer>
      );
    }
    return (
      <WidgetContainer
        header={{
          icon: <FileText size={14} className="text-blue-500" />,
          title: 'Visa Information',
          subtitle: data.destination ? `Visa requirements for ${data.destination}` : 'Visa requirements',
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {status && (
              <div className="flex flex-col bg-paper-0 border border-line rounded-xl p-2.5">
                <span className="text-[9px] font-bold uppercase text-ink-400">Status</span>
                <span className="text-xs font-bold text-ink-800 mt-0.5">{status}</span>
              </div>
            )}
            {processingTime && (
              <div className="flex flex-col bg-paper-0 border border-line rounded-xl p-2.5">
                <span className="text-[9px] font-bold uppercase text-ink-400">Processing</span>
                <span className="text-xs font-bold text-ink-800 mt-0.5">{processingTime}</span>
              </div>
            )}
            {fee && (
              <div className="col-span-2 flex flex-col bg-paper-0 border border-line rounded-xl p-2.5">
                <span className="text-[9px] font-bold uppercase text-ink-400">Fee</span>
                <span className="text-xs font-bold text-ink-800 mt-0.5">{fee}</span>
              </div>
            )}
          </div>
          {steps.length > 0 && (
            <div className="flex flex-col gap-1">
              {steps.map((step, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-ink-600">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-paper-1 border border-line text-[9px] font-bold text-ink-500">{idx + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          )}
        </div>
      </WidgetContainer>
    );
  }

  // Fallback / AI Insight
  return (
    <WidgetContainer
      header={{
        icon: <HelpCircle size={14} />,
        title: 'Travel Intelligence',
        subtitle: 'Additional insights for your trip',
      }}
    >
      {data.text ? (
        <div className="bg-paper-0 border border-line p-3 rounded-xl text-xs text-ink-600 leading-relaxed font-medium">
          {data.text}
        </div>
      ) : (
        <EmptyNote text="No additional insights available yet." />
      )}
    </WidgetContainer>
  );
}
