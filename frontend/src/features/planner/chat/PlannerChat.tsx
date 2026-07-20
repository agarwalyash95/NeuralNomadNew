'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Sparkles, MapPin, CalendarDays, Train, Bus, Car, Hotel, Utensils, Activity, Ship,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlannerChatProps } from './types';
import { useConversation } from './hooks/useConversation';
import { useChatScroll } from './hooks/useChatScroll';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TripProgressStrip } from './TripProgressStrip';
import PlanLoadingScreen from './PlanLoadingScreen';
import { usePinnedCapabilities } from './capabilities/usePinnedCapabilities';
import { PinnedRail } from './capabilities/PinnedRail';

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

// Purpose badge label
const PURPOSE_LABELS: Record<string, string> = {
  vacation: '🌴 Vacation', business: '💼 Business', hometown: '🏠 Hometown',
  honeymoon: '💍 Honeymoon', family: '👨‍👩‍👧 Family', solo: '🎒 Solo',
  event: '🎉 Event', emergency: '🚨 Emergency',
};

export default function PlannerChat({ workspaceId }: PlannerChatProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    query,
    setQuery,
    workspace,
    messages,
    readyForPlan,
    isSending,
    isCreatingPlan,
    generationJob,
    suggestedReplies,
    tripProgress,
    error,
    detectedIntent,
    confidenceScore,
    visitPurpose,
    openExplanations,
    setOpenExplanations,
    lastAssistantMessageId,
    handleSuggestClick,
    handleSubmit,
    handleCreatePlan,
    handleConfirmAndGenerate,
    handleRetryGeneration,
    handleLoadingComplete,
  } = useConversation({ workspaceId });

  const bottomRef = useChatScroll([messages, isSending]);
  const { pinned, pinnedKeys, togglePin } = usePinnedCapabilities();

  const onSuggestClick = (title: string) => {
    handleSuggestClick(title);
    textareaRef.current?.focus();
  };

  // Reset text area height whenever the displayed workspace changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [workspaceId]);

  // Draft trip parameters for the loading screen — undefined when unknown
  // (the screen hides chips for facts we don't actually have)
  const destination = workspace?.draft_state?.destination_text || undefined;

  const getTravelersCount = (): number | undefined => {
    if (!workspace?.draft_state) return undefined;
    const adults = workspace.draft_state.adults;
    const children = workspace.draft_state.children || 0;
    if (typeof adults === 'number' && adults > 0) {
      return adults + children;
    }
    const metaTravelers = (workspace.draft_state.metadata as any)?.travelers || (workspace.draft_state.metadata as any)?.passengers;
    if (typeof metaTravelers === 'number' && metaTravelers > 0) {
      return Number(metaTravelers);
    }
    return undefined;
  };
  const travelersCount = getTravelersCount();

  let durationDays: number | undefined;
  if (workspace?.draft_state?.start_date && workspace?.draft_state?.end_date) {
    const start = new Date(workspace.draft_state.start_date);
    const end = new Date(workspace.draft_state.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) durationDays = diffDays + 1;
  }

  const budgetText = workspace?.draft_state?.budget_amount
    ? `${workspace.draft_state.budget_currency || '₹'}${Number(workspace.draft_state.budget_amount).toLocaleString()}`
    : undefined;

  const suggestions = [
    { icon: <MapPin size={18} />, title: 'Plan a weekend in Kyoto', desc: 'Temples, tea houses, and easy rail routes' },
    { icon: <CalendarDays size={18} />, title: '7-day itinerary in Switzerland', desc: 'Scenic Alps, trains, and hotel ideas' },
    { icon: <Plane size={18} />, title: 'Find flights to Bali', desc: 'Under ₹30,000 next month' },
    { icon: <Train size={18} />, title: 'Rajdhani to Goa from Mumbai', desc: 'Overnight sleeper, 3AC/2AC' },
    { icon: <Sparkles size={18} />, title: 'Romantic getaway near me', desc: 'Quiet, premium, and low-friction' },
    { icon: <Utensils size={18} />, title: 'Best restaurants in Tokyo', desc: 'Michelin stars and street food tours' },
  ];

  const intentDisplay = detectedIntent ? INTENT_DISPLAY[detectedIntent] : null;
  const isMandatoryComplete = readyForPlan;
  const isHighlighted = isMandatoryComplete && confidenceScore >= 85;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-paper-0">
      <div className={cn(
        "flex flex-1 flex-col items-center overflow-y-auto px-4 transition-all duration-300",
        messages.length === 0 ? "pb-48 pt-12" : "pb-36 pt-6"
      )}>
        {/* Hero header — only shown on landing empty state */}
        {messages.length === 0 && (
          <div className="mb-10 mt-6 flex w-full max-w-4xl flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgb(var(--color-ai)/0.25)] bg-[rgb(var(--color-ai)/0.08)] text-[rgb(var(--color-ai))] shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
              <Plane size={32} strokeWidth={2} />
            </div>
            <h1 className="mb-3 text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
              Build your next trip with intent
            </h1>
            <p className="max-w-2xl text-base text-ink-600 sm:text-lg">
              Tell me what you need — a flight, hotel, train, or full itinerary — and I&apos;ll take care of the rest.
            </p>
          </div>
        )}

        {messages.length > 0 && (
          <>
            <TripProgressStrip tripProgress={tripProgress} />
            <PinnedRail pinned={pinned} onTogglePin={togglePin} />
          </>
        )}

        {messages.length === 0 ? (
          /* Suggestion grid */
          <div className="grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((item, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => onSuggestClick(item.title)}
                className="group flex items-start gap-4 rounded-2xl border border-line-strong bg-paper-2/90 px-5 py-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-[rgb(var(--color-ai)/0.35)] hover:shadow-hover"
              >
                <div className="mt-0.5 rounded-xl bg-paper-0 p-2 text-ink-500 transition-colors group-hover:bg-[rgb(var(--color-ai)/0.08)] group-hover:text-[rgb(var(--color-ai))]">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-ink-500">{item.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          /* Chat messages log list */
          <MessageList
            messages={messages}
            lastAssistantMessageId={lastAssistantMessageId}
            isSending={isSending}
            error={error}
            intentDisplay={intentDisplay}
            visitPurpose={visitPurpose}
            PURPOSE_LABELS={PURPOSE_LABELS}
            openExplanations={openExplanations}
            setOpenExplanations={setOpenExplanations}
            onSubmitWidget={handleSubmit}
            onConfirmAndGenerate={handleConfirmAndGenerate}
            bottomRef={bottomRef}
            pinnedKeys={pinnedKeys}
            onTogglePin={togglePin}
          />
        )}
      </div>

      {/* Proactive next-step chips — deterministic from what the draft still needs */}
      {suggestedReplies.length > 0 && !isSending && (
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-4 pb-1.5">
          {suggestedReplies.map((chip) => (
            <button
              key={chip}
              onClick={() => (chip.startsWith('Create my plan') ? handleCreatePlan() : handleSubmit(chip))}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                chip.startsWith('Create my plan')
                  ? 'border-[rgb(var(--color-ai)/0.3)] bg-gradient-to-r from-[rgb(var(--color-ai))] to-violet-700 text-white shadow-surface hover:shadow-hover'
                  : 'border-line-strong bg-paper-2 text-ink-700 hover:border-[rgb(var(--color-ai)/0.4)] hover:bg-[rgb(var(--color-ai)/0.08)] hover:text-[rgb(var(--color-ai))]'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Bottom input area */}
      <ChatInput
        query={query}
        setQuery={setQuery}
        isSending={isSending}
        isMandatoryComplete={isMandatoryComplete}
        isHighlighted={isHighlighted}
        isCreatingPlan={isCreatingPlan}
        handleCreatePlan={handleCreatePlan}
        handleSubmit={handleSubmit}
        textareaRef={textareaRef}
      />

      {/* Full-Screen Rolling Plan Loading Overlay */}
      <AnimatePresence>
        {isCreatingPlan && (
          <PlanLoadingScreen
            destination={destination}
            durationDays={durationDays}
            travelersCount={travelersCount}
            budgetText={budgetText}
            job={generationJob}
            onComplete={handleLoadingComplete}
            onRetry={handleRetryGeneration}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
