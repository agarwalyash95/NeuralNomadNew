'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plane, Sparkles, MapPin, CalendarDays, ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { plannerService } from '@/services/planner.service';
import type { ChatMessage, PlannerWorkspace } from '@/services/planner.types';
import { ChatWidget } from './ChatWidgets';

export interface PlannerChatProps {
  workspaceId?: string | null;
  onModeChange?: (mode: 'chat' | 'plan', workspaceId?: string) => void;
}

export default function PlannerChat({ workspaceId, onModeChange }: PlannerChatProps) {
  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState<PlannerWorkspace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readyForPlan, setReadyForPlan] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const reset = () => {
      setQuery('');
      setWorkspace(null);
      setMessages([]);
      setReadyForPlan(false);
      setError(null);
      setIsSending(false);
      setIsCreatingPlan(false);
    };

    window.addEventListener('planner:new-plan', reset);
    return () => window.removeEventListener('planner:new-plan', reset);
  }, []);

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
        } catch (err) {
          setError('Failed to restore past draft session. Please try again.');
        }
      };
      loadWorkspace();
    } else {
      setWorkspace(null);
      setMessages([]);
      setReadyForPlan(false);
    }
  }, [workspaceId]);

  const handleSuggestClick = (title: string) => {
    setQuery(title);
  };

  const handleSubmit = async (overrideMessage?: string, structuredValue?: any) => {
    const message = typeof overrideMessage === 'string' ? overrideMessage : query.trim();
    if ((!message && !structuredValue) || isSending) return;

    setIsSending(true);
    setError(null);
    if (typeof overrideMessage !== 'string') setQuery('');

    const tempId = Date.now().toString();
    if (message) {
      setMessages((current) => [
        ...current,
        {
          id: tempId,
          role: 'user',
          message: message,
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
      setMessages((current) => [
        ...current.filter((m) => m.id !== tempId),
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
        } catch {
          // Fall through to the visible error below.
        }
      }

      setError('I could not save that message. Please try again.');
      setMessages((current) => current.filter((m) => m.id !== tempId));
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
    { icon: <CalendarDays size={18} />, title: '7-day itinerary for Switzerland', desc: 'Scenic Alps, trains, and hotel ideas' },
    { icon: <Plane size={18} />, title: 'Find flights to Bali', desc: 'Under Rs 30,000 next month' },
    { icon: <Sparkles size={18} />, title: 'Romantic getaway near me', desc: 'Quiet, premium, and low-friction' },
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(26,86,219,0.08),_transparent_32%),linear-gradient(180deg,#fbfaf7_0%,#f6f4ef_100%)]">
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-44 pt-16">
        <div className="mb-10 mt-8 flex w-full max-w-4xl flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#cfe0ff] bg-white text-blue-600 shadow-sm">
            <Plane size={32} strokeWidth={2} />
          </div>
          <h1 className="mb-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Build your next trip with intent
          </h1>
          <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
            Start with a destination, a mood, or a budget and shape it into a real itinerary.
          </p>
        </div>

        {messages.length === 0 ? (
          <div className="grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
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
          <div className="flex w-full max-w-3xl flex-col gap-3">
            {messages.map((message) => {
              const hasConfidence = message.role === 'assistant' && message.metadata && typeof message.metadata.confidence_score === 'number';
              const score = hasConfidence ? (message.metadata?.confidence_score as number) : null;
              const explanation = hasConfidence ? (message.metadata?.confidence_explanation as string) : null;

              return (
                <div key={message.id} className="w-full flex flex-col gap-2">
                  {hasConfidence && score !== null && (
                    <div className="mr-auto ml-1 mt-3 -mb-1 flex flex-col">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Sparkles size={11} className="text-indigo-500 animate-pulse" />
                        <span>Confidence</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100/60 text-indigo-600 font-extrabold font-mono text-[10px] shadow-sm">
                          {score}%
                        </span>
                        {explanation && (
                          <button
                            type="button"
                            onClick={() => {
                              const id = message.id;
                              setOpenExplanations((prev) => ({
                                ...prev,
                                [id]: !prev[id],
                              }));
                            }}
                            className="text-[10px] text-indigo-500 hover:text-indigo-600 font-semibold underline transition-all ml-1 cursor-pointer"
                          >
                            {openExplanations[message.id] ? 'Hide coaching' : '(improve score?)'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                      message.role === 'user'
                        ? 'ml-auto bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                        : 'mr-auto border border-[#e5dfd2] bg-white text-slate-700'
                    )}
                  >
                    {message.message}
                  </div>
                  {message.role === 'assistant' && openExplanations[message.id] && explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mr-auto w-full max-w-[82%] rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 text-xs text-indigo-800 shadow-[inset_0_1px_2px_rgba(99,102,241,0.02)] backdrop-blur-sm"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">💡</span>
                        <p className="leading-relaxed">
                          <span className="font-bold text-indigo-700">Trip Planner Coach:</span>{' '}
                          {explanation}
                        </p>
                      </div>
                    </motion.div>
                  )}
                  {message.widgets?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {message.widgets.map((widget, i) => (
                        <ChatWidget key={i} widget={widget} onSubmit={handleSubmit} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isSending && (
              <div className="mr-auto w-fit rounded-2xl border border-[#e5dfd2] bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">NeuralNomad is thinking...</span>
                </div>
              </div>
            )}
            {readyForPlan && (
              <div className="mr-auto w-full max-w-[82%] rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  <h4 className="text-sm font-bold text-indigo-900">AI Recommendation</h4>
                </div>
                <p className="text-sm text-indigo-800">
                  You have provided enough details to craft a perfect itinerary! It's highly recommended to generate the initial plan now. You can always ask me to modify it later.
                </p>
              </div>
            )}
            {error && (
              <div className="mr-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#f6f4ef] via-[#f6f4ef]/95 to-transparent px-6 pb-4 pt-12">
        {readyForPlan && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-3 flex w-full max-w-4xl justify-center"
          >
            <button
              onClick={handleCreatePlan}
              disabled={isCreatingPlan}
              className="flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 disabled:scale-100 disabled:cursor-wait disabled:opacity-70"
            >
              {isCreatingPlan && <Loader2 size={18} className="animate-spin" />}
              ✨ Generate Trip Plan
            </button>
          </motion.div>
        )}
        <div className="group relative mx-auto w-full max-w-4xl">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask NeuralNomad to shape a trip, compare options, or map a route"
            className="custom-scrollbar min-h-[72px] max-h-[200px] w-full resize-none rounded-[28px] border border-[#d9d4c7] bg-white py-5 pl-6 pr-16 text-base text-slate-900 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)] transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
          <button
            onClick={handleSubmit}
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
