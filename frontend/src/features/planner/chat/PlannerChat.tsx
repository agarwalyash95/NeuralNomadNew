'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Sparkles, MapPin, CalendarDays, ArrowUp, Loader2,
  Train, Bus, Car, Hotel, Utensils, Activity, Ship,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { plannerService } from '@/services/planner.service';
import type { ChatMessage, PlannerWorkspace } from '@/services/planner.types';
import { ChatWidget } from './ChatWidgets';

export interface PlannerChatProps {
  workspaceId?: string | null;
  onModeChange?: (mode: 'chat' | 'plan', workspaceId?: string) => void;
}

// Intent badges for the header strip
const INTENT_DISPLAY: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  full_trip:       { label: 'Full Trip',         icon: <Plane size={12} />,     color: 'blue' },
  hotel_only:      { label: 'Hotel Search',       icon: <Hotel size={12} />,     color: 'indigo' },
  flight_only:     { label: 'Flight Search',      icon: <Plane size={12} />,     color: 'sky' },
  train_only:      { label: 'Train Booking',      icon: <Train size={12} />,     color: 'green' },
  bus_only:        { label: 'Bus Booking',        icon: <Bus size={12} />,       color: 'orange' },
  cab_only:        { label: 'Cab Booking',        icon: <Car size={12} />,       color: 'yellow' },
  cruise_only:     { label: 'Cruise',             icon: <Ship size={12} />,      color: 'cyan' },
  car_rental:      { label: 'Car Rental',         icon: <Car size={12} />,       color: 'teal' },
  transit_only:    { label: 'Transit',            icon: <Train size={12} />,     color: 'purple' },
  activities_only: { label: 'Activities',         icon: <Activity size={12} />,  color: 'pink' },
  food_and_dining: { label: 'Food & Dining',      icon: <Utensils size={12} />,  color: 'rose' },
};

export default function PlannerChat({ workspaceId, onModeChange }: PlannerChatProps) {
  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState<PlannerWorkspace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readyForPlan, setReadyForPlan] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [detectedIntent, setDetectedIntent] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [visitPurpose, setVisitPurpose] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Reset on new plan event
  useEffect(() => {
    const reset = () => {
      setQuery('');
      setWorkspace(null);
      setMessages([]);
      setReadyForPlan(false);
      setError(null);
      setIsSending(false);
      setIsCreatingPlan(false);
      setDetectedIntent(null);
    };
    window.addEventListener('planner:new-plan', reset);
    return () => window.removeEventListener('planner:new-plan', reset);
  }, []);

  // Load existing workspace
  useEffect(() => {
    if (workspaceId) {
      const loadWorkspace = async () => {
        try {
          setError(null);
          const [ws, msgs] = await Promise.all([
            plannerService.getWorkspace(workspaceId),
            plannerService.listMessages(workspaceId),
          ]);
          setWorkspace(ws);
          setMessages(msgs);
          setReadyForPlan(ws.draft_state?.ready_for_plan ?? false);
          // Detect intent + confidence from last assistant message metadata
          const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
          if (lastAssistant?.metadata?.detected_intent) {
            setDetectedIntent(lastAssistant.metadata.detected_intent as string);
          }
          if (lastAssistant?.metadata?.confidence_score) {
            setConfidenceScore(lastAssistant.metadata.confidence_score as number);
          }
        } catch {
          setError('Failed to restore past draft session. Please try again.');
        }
      };
      loadWorkspace();
    } else {
      setWorkspace(null);
      setMessages([]);
      setReadyForPlan(false);
      setDetectedIntent(null);
      setConfidenceScore(0);
      setVisitPurpose(null);
    }
  }, [workspaceId]);

  // The ID of the last assistant message — only this one gets its widget rendered
  const lastAssistantMessageId = useMemo(
    () => [...messages].reverse().find(m => m.role === 'assistant')?.id,
    [messages]
  );

  const handleSuggestClick = (title: string) => {
    setQuery(title);
    textareaRef.current?.focus();
  };

  const handleSubmit = async (overrideMessage?: string, structuredValue?: any) => {
    const message = typeof overrideMessage === 'string' ? overrideMessage : query.trim();
    if ((!message && !structuredValue) || isSending) return;

    setIsSending(true);
    setError(null);
    if (typeof overrideMessage !== 'string') setQuery('');

    const tempId = Date.now().toString();
    if (message) {
      setMessages(current => [
        ...current,
        {
          id: tempId,
          role: 'user',
          message,
          widgets: [],
          commands: [],
          created_at: new Date().toISOString(),
        },
      ]);
    }

    const appendResponse = (response: Awaited<ReturnType<typeof plannerService.sendLazyMessage>>) => {
      setWorkspace(response.workspace);
      window.dispatchEvent(new CustomEvent('planner:refresh-workspaces'));
      setReadyForPlan(response.ready_for_plan);

      // Track detected intent + confidence from response metadata
      const meta = response.assistant_message?.metadata;
      const intent = meta?.detected_intent as string | undefined;
      if (intent) setDetectedIntent(intent);

      const score = meta?.confidence_score as number | undefined;
      if (typeof score === 'number') setConfidenceScore(score);

      // Track visit_purpose if present in last widget's prefilled
      const widgets = response.assistant_message?.widgets ?? [];
      const optionalWidget = widgets.find((w: any) => w?.type === 'optional_trip_details');
      const prefilled = optionalWidget?.data?.prefilled as Record<string, any> | undefined;
      if (prefilled?.visit_purpose) {
        setVisitPurpose(prefilled.visit_purpose);
      }

      setMessages(current => [
        ...current.filter(m => m.id !== tempId),
        {
          id: response.user_message.id,
          role: response.user_message.role,
          message: response.user_message.message,
          widgets: [],
          commands: [],
          created_at: response.user_message.created_at,
        },
        response.assistant_message,
      ]);
    };

    const send = async () =>
      workspace
        ? await plannerService.sendMessage(workspace.id, message, structuredValue)
        : await plannerService.sendLazyMessage(message, structuredValue);

    try {
      appendResponse(await send());
    } catch (err) {
      if ((err as { status?: number }).status === 401) {
        try {
          appendResponse(await send());
          return;
        } catch { /* fall through */ }
      }
      setError('I could not save that message. Please try again.');
      setMessages(current => current.filter(m => m.id !== tempId));
      setQuery(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!workspace || !readyForPlan || isCreatingPlan) return;
    setIsCreatingPlan(true);
    setError(null);
    try {
      await plannerService.createPlan(workspace.id);
      onModeChange?.('plan', workspace.id);
      window.dispatchEvent(new CustomEvent('planner:toggle-sidebar', { detail: false }));
    } catch {
      setError('The plan could not be created yet.');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const suggestions = [
    { icon: <MapPin size={18} />, title: 'Plan a weekend in Kyoto', desc: 'Temples, tea houses, and easy rail routes' },
    { icon: <CalendarDays size={18} />, title: '7-day itinerary in Switzerland', desc: 'Scenic Alps, trains, and hotel ideas' },
    { icon: <Plane size={18} />, title: 'Find flights to Bali', desc: 'Under ₹30,000 next month' },
    { icon: <Train size={18} />, title: 'Rajdhani to Goa from Mumbai', desc: 'Overnight sleeper, 3AC/2AC' },
    { icon: <Sparkles size={18} />, title: 'Romantic getaway near me', desc: 'Quiet, premium, and low-friction' },
    { icon: <Utensils size={18} />, title: 'Best restaurants in Tokyo', desc: 'Michelin stars and street food tours' },
  ];

  const intentDisplay = detectedIntent ? INTENT_DISPLAY[detectedIntent] : null;

  // Create Plan button state
  const isMandatoryComplete = readyForPlan;
  const isHighlighted = isMandatoryComplete && confidenceScore >= 85;

  // Purpose badge label
  const PURPOSE_LABELS: Record<string, string> = {
    vacation: '🌴 Vacation', business: '💼 Business', hometown: '🏠 Hometown',
    honeymoon: '💍 Honeymoon', family: '👨‍👩‍👧 Family', solo: '🎒 Solo',
    event: '🎉 Event', emergency: '🚨 Emergency',
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(26,86,219,0.08),_transparent_32%),linear-gradient(180deg,#fbfaf7_0%,#f6f4ef_100%)]">
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-52 pt-16">
        {/* Hero header */}
        <div className="mb-10 mt-8 flex w-full max-w-4xl flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#cfe0ff] bg-white text-blue-600 shadow-sm">
            <Plane size={32} strokeWidth={2} />
          </div>
          <h1 className="mb-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Build your next trip with intent
          </h1>
          <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
            Tell me what you need — a flight, hotel, train, or full itinerary — and I&apos;ll take care of the rest.
          </p>
        </div>

        {messages.length === 0 ? (
          /* Suggestion grid */
          <div className="grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((item, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleSuggestClick(item.title)}
                className="group flex items-start gap-4 rounded-2xl border border-[#ddd7ca] bg-white px-5 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#c7c0b1] hover:shadow-md"
              >
                <div className="mt-0.5 rounded-xl bg-[#f6f4ef] p-2 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          /* Chat messages */
          <div className="flex w-full max-w-3xl flex-col gap-3">
            {/* Intent + Purpose badge strip */}
            {intentDisplay && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-1 flex items-center gap-2 flex-wrap"
              >
                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                  {intentDisplay.icon}
                  <span className="font-bold text-slate-700">{intentDisplay.label}</span>
                </span>
                {visitPurpose && PURPOSE_LABELS[visitPurpose] && (
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600">
                    {PURPOSE_LABELS[visitPurpose]}
                  </span>
                )}
              </motion.div>
            )}

            {messages.map((message) => {
              const isAssistant = message.role === 'assistant';
              const hasConfidence = isAssistant && message.metadata && typeof message.metadata.confidence_score === 'number';
              const score = hasConfidence ? (message.metadata?.confidence_score as number) : null;
              const explanation = hasConfidence ? (message.metadata?.confidence_explanation as string) : null;
              const isLastAssistant = message.id === lastAssistantMessageId;

              return (
                <div key={message.id} className="flex w-full flex-col gap-1.5">
                  {/* Confidence badge — only on last assistant message */}
                  {isLastAssistant && hasConfidence && score !== null && (
                    <div className="mr-auto ml-1 mt-2 -mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Sparkles size={11} className="text-indigo-500 animate-pulse" />
                      <span>Confidence</span>
                      <span className="inline-flex items-center justify-center rounded-full border border-indigo-100/60 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-indigo-600 shadow-sm">
                        {score}%
                      </span>
                      {explanation && (
                        <button
                          type="button"
                          onClick={() => setOpenExplanations(prev => ({ ...prev, [message.id]: !prev[message.id] }))}
                          className="ml-1 cursor-pointer text-[10px] font-semibold text-indigo-500 underline transition-all hover:text-indigo-600"
                        >
                          {openExplanations[message.id] ? 'Hide' : '(improve?)'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={cn(
                      'max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                      message.role === 'user'
                        ? 'ml-auto bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                        : 'mr-auto border border-[#e5dfd2] bg-white text-slate-700 whitespace-pre-wrap leading-relaxed'
                    )}
                  >
                    {message.message}
                  </div>

                  {/* Coaching explanation */}
                  {isAssistant && openExplanations[message.id] && explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mr-auto w-full max-w-[82%] rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 text-xs text-indigo-800 backdrop-blur-sm"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">💡</span>
                        <p className="leading-relaxed">
                          <span className="font-bold text-indigo-700">Trip Planner Coach: </span>
                          {explanation}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/*
                   * CRITICAL: Only render widget for the LAST assistant message.
                   * Historical messages never show their widget again — prevents widget clutter.
                   */}
                  {isLastAssistant && !isSending && Boolean(message.widgets && message.widgets.length > 0) && (
                    <AnimatePresence>
                      <motion.div
                        key={message.id + '-widget'}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-2"
                      >
                        <ChatWidget widget={message.widgets![0]!} onSubmit={handleSubmit} />
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              );
            })}

            {/* Typing indicator */}
            {isSending && (
              <div className="mr-auto w-fit rounded-2xl border border-[#e5dfd2] bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">NeuralNomad is thinking...</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mr-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Bottom input area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#f6f4ef] via-[#f6f4ef]/95 to-transparent px-6 pb-4 pt-12">
        {/* Create Plan button — bottom-right, state-based styling */}
        <AnimatePresence>
          {isMandatoryComplete && (
            <motion.button
              key="create-plan-btn"
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 8 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={handleCreatePlan}
              disabled={isCreatingPlan}
              title={isHighlighted ? undefined : 'You can create the plan now, or keep refining details'}
              className={cn(
                'absolute bottom-[88px] right-6 z-20 flex items-center gap-2 rounded-xl transition-all duration-300',
                isHighlighted
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:scale-[1.03] hover:shadow-lg'
                  : 'border border-indigo-300 bg-white/90 px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm backdrop-blur-sm hover:bg-indigo-50 hover:border-indigo-400',
                isCreatingPlan && 'cursor-wait opacity-75'
              )}
            >
              {isCreatingPlan
                ? <Loader2 size={14} className="animate-spin" />
                : <Sparkles size={14} className={isHighlighted ? 'animate-pulse' : ''} />
              }
              {isCreatingPlan ? 'Creating...' : 'Create Plan'}
            </motion.button>
          )}
        </AnimatePresence>

        <div className="group relative mx-auto w-full max-w-4xl">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask NeuralNomad — flights, hotels, trains, activities, or a full trip…"
            className="custom-scrollbar min-h-[72px] max-h-[200px] w-full resize-none rounded-[28px] border border-[#d9d4c7] bg-white py-5 pl-6 pr-16 text-base text-slate-900 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)] transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
          <button
            onClick={() => handleSubmit()}
            className={cn(
              'absolute bottom-4 right-4 rounded-2xl p-2.5 transition-all',
              query.trim().length > 0 && !isSending
                ? 'bg-slate-900 text-white shadow-md hover:bg-slate-800'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            )}
            disabled={query.trim().length === 0 || isSending}
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
}
