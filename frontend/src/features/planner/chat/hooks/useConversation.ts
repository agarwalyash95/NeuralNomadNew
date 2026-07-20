import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { plannerService } from '@/services/planner.service';
import type { ChatMessage, GenerationJobStatus, PlannerWorkspace } from '@/services/planner.types';
import { plannerKeys, useWorkspace } from '@/features/planner/hooks/usePlannerQueries';
import { streamChatMessage } from '../services/chatStream';
import type { CapabilityData } from '../capabilities/CapabilityCards';

/** The latest "trip_progress" capability out of a turn's capability list, or
 * undefined if this turn didn't carry one (most turns don't recompute it). */
function latestTripProgress(capabilities: unknown): CapabilityData | undefined {
  if (!Array.isArray(capabilities)) return undefined;
  return capabilities.find((c: any) => c?.cap === 'trip_progress');
}

interface UseConversationProps {
  workspaceId?: string | null;
}

const STREAMING_ENABLED = process.env.NEXT_PUBLIC_CHAT_STREAMING !== '0';

export function useConversation({ workspaceId }: UseConversationProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: workspaceData } = useWorkspace(workspaceId ?? null);

  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState<PlannerWorkspace | null>(null);
  const workspaceRevisionRef = useRef(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readyForPlan, setReadyForPlan] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const isCreatingPlanRef = useRef(false);
  const [generationJob, setGenerationJob] = useState<GenerationJobStatus | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [detectedIntent, setDetectedIntent] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [visitPurpose, setVisitPurpose] = useState<string | null>(null);
  /** Deterministic next-step chips from the last streamed turn */
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  /** Latest "Your trip so far" snapshot — a single updating value, not a
   * per-message card (see TripProgressStrip). */
  const [tripProgress, setTripProgress] = useState<CapabilityData | null>(null);

  // Sync workspace object from the shared query cache
  useEffect(() => {
    if (workspaceId && workspaceData && (workspaceData.revision ?? 0) >= workspaceRevisionRef.current) {
      workspaceRevisionRef.current = workspaceData.revision ?? 0;
      setWorkspace(workspaceData);
      setReadyForPlan(workspaceData.draft_state?.ready_for_plan ?? false);
    }
  }, [workspaceId, workspaceData]);

  // Load message history for an existing workspace
  useEffect(() => {
    if (workspaceId) {
      const loadMessages = async () => {
        try {
          setError(null);
          const msgs = await plannerService.listMessages(workspaceId);
          setMessages(msgs);

          const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
          if (lastAssistant?.metadata?.detected_intent) {
            setDetectedIntent(lastAssistant.metadata.detected_intent as string);
          }
          if (lastAssistant?.metadata?.confidence_score) {
            setConfidenceScore(lastAssistant.metadata.confidence_score as number);
          }
          // Restore the last known trip-progress snapshot by scanning
          // backward — most turns don't recompute it, so it isn't
          // necessarily on the very last assistant message.
          for (let i = msgs.length - 1; i >= 0; i--) {
            const found = latestTripProgress((msgs[i]?.metadata as any)?.capabilities);
            if (found) {
              setTripProgress(found);
              break;
            }
          }
        } catch {
          setError('Failed to restore past draft session. Please try again.');
        }
      };
      loadMessages();
    } else {
      setWorkspace(null);
      setMessages([]);
      setReadyForPlan(false);
      setDetectedIntent(null);
      setConfidenceScore(0);
      setVisitPurpose(null);
      setTripProgress(null);
    }
  }, [workspaceId]);

  // The ID of the last assistant message
  const lastAssistantMessageId = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant')?.id,
    [messages]
  );

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
          message,
          widgets: [],
          commands: [],
          created_at: new Date().toISOString(),
        },
      ]);
    }

    const isNewWorkspace = !workspace;
    const previousTitle = workspace?.title;

    const appendResponse = (response: any) => {
      const ws: PlannerWorkspace = response.workspace;
      const isLatest = (ws.revision ?? 0) >= workspaceRevisionRef.current;
      if (isLatest) {
        workspaceRevisionRef.current = ws.revision ?? 0;
        setWorkspace(ws);
        setReadyForPlan(response.ready_for_plan);
        setSuggestedReplies(response.suggested_replies ?? []);
      }

      // Keep the shared cache truthful without refetching everything
      if (isLatest) {
        queryClient.setQueryData(plannerKeys.workspace(ws.id), ws);
      }
      if (isNewWorkspace || ws.title !== previousTitle) {
        queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
      }

      // A lazily-created conversation now has a real address — reflect it in
      // the URL without remounting (state is preserved; refresh restores it)
      if (isNewWorkspace && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/planner/${ws.id}`);
      }

      const meta = response.assistant_message?.metadata;
      const intent = meta?.detected_intent as string | undefined;
      if (intent) setDetectedIntent(intent);

      const score = meta?.confidence_score as number | undefined;
      if (typeof score === 'number') setConfidenceScore(score);

      const progress = latestTripProgress(meta?.capabilities);
      if (progress) setTripProgress(progress);

      const widgets = response.assistant_message?.widgets ?? [];
      const optionalWidget = widgets.find((w: any) => w?.type === 'optional_trip_details');
      const prefilled = optionalWidget?.data?.prefilled as Record<string, any> | undefined;
      if (prefilled?.visit_purpose) {
        setVisitPurpose(prefilled.visit_purpose);
      }

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

    /** Token-streamed turn over SSE — the reply renders as it arrives. */
    const turnId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const sendViaStream = async () => {
      const streamingMsgId = `streaming-${Date.now()}`;
      let acc = '';
      let widgets: any[] = [];
      setMessages((current) => [
        ...current,
        { id: streamingMsgId, role: 'assistant', message: '', widgets: [], commands: [], created_at: new Date().toISOString() } as ChatMessage,
      ]);
      try {
        await streamChatMessage(
          workspace?.id ?? null,
          { message, structured_value: structuredValue, turn_id: turnId },
          {
            onState: (s) => {
              if (typeof s.revision === 'number') {
                workspaceRevisionRef.current = Math.max(workspaceRevisionRef.current, s.revision);
              }
              if (s.detected_intent) setDetectedIntent(s.detected_intent);
              if (typeof s.confidence_score === 'number') setConfidenceScore(s.confidence_score);
              // Reconcile the optimistic user message with its persisted id
              if (s.user_message_id) {
                setMessages((current) =>
                  current.map((m) => (m.id === tempId ? { ...m, id: s.user_message_id } : m))
                );
              }
            },
            onToken: (t) => {
              acc += t;
              setMessages((current) =>
                current.map((m) => (m.id === streamingMsgId ? { ...m, message: acc } : m))
              );
            },
            onWidgets: (w) => { widgets = w; },
            // Additive — capability/insight cards now render progressively
            // during the stream instead of only appearing once `done`
            // arrives (they were previously silently dropped: the handlers
            // existed in chatStream.ts but were never passed in here).
            onCapabilities: (caps) => {
              setMessages((current) =>
                current.map((m) => (m.id === streamingMsgId ? { ...m, metadata: { ...(m.metadata || {}), capabilities: caps } } : m))
              );
              const progress = latestTripProgress(caps);
              if (progress) setTripProgress(progress);
            },
            onInsights: (ins) => {
              setMessages((current) =>
                current.map((m) => (m.id === streamingMsgId ? { ...m, metadata: { ...(m.metadata || {}), insights: ins } } : m))
              );
            },
            onDone: (d) => {
              const ws: PlannerWorkspace = d.workspace;
              const isLatest = (ws.revision ?? 0) >= workspaceRevisionRef.current;
              if (isLatest) {
                workspaceRevisionRef.current = ws.revision ?? 0;
                setWorkspace(ws);
                setReadyForPlan(d.ready_for_plan);
                setSuggestedReplies(d.suggested_replies ?? []);
                const progress = latestTripProgress(d.metadata?.capabilities);
                if (progress) setTripProgress(progress);
              }
              if (isLatest) queryClient.setQueryData(plannerKeys.workspace(ws.id), ws);
              if (isNewWorkspace || ws.title !== previousTitle) {
                queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
              }
              if (isNewWorkspace && typeof window !== 'undefined') {
                window.history.replaceState(null, '', `/planner/${ws.id}`);
              }
              const prefilled = widgets.find((w: any) => w?.type === 'optional_trip_details')?.data
                ?.prefilled as Record<string, any> | undefined;
              if (prefilled?.visit_purpose) setVisitPurpose(prefilled.visit_purpose);

              // Reconcile the placeholder with the persisted message
              setMessages((current) =>
                current.map((m) =>
                  m.id === streamingMsgId
                    ? ({ ...m, id: d.message_id, message: acc, widgets, metadata: d.metadata } as ChatMessage)
                    : m
                )
              );
            },
          }
        );
      } catch (err) {
        // Remove the placeholder before the classic path retries the turn
        setMessages((current) => current.filter((m) => m.id !== streamingMsgId));
        throw err;
      }
    };

    try {
      setSuggestedReplies([]);
      if (STREAMING_ENABLED) {
        try {
          await sendViaStream();
          return;
        } catch (streamErr) {
          console.warn('Chat stream failed, falling back to classic request:', streamErr);
        }
      }
      const response = workspace
        ? await plannerService.sendMessage(workspace.id, message, structuredValue, turnId)
        : await plannerService.sendLazyMessage(message, structuredValue, turnId);
      appendResponse(response);
    } catch {
      setError('I could not save that message. Please try again.');
      setMessages((current) => current.filter((m) => m.id !== tempId));
      setQuery(message);
    } finally {
      setIsSending(false);
    }
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const handleConfirmAndGenerate = async (options?: { retry?: boolean; skipConfirm?: boolean }) => {
    if (!workspace) {
      setError('Finish the required trip details before creating the plan.');
      return;
    }
    if (isCreatingPlanRef.current && !options?.retry) return;
    let currentWorkspace = workspace;
    try {
      // Create Plan always begins from a fresh canonical revision. This also
      // repairs a stale local ready flag instead of silently doing nothing.
      currentWorkspace = await plannerService.getWorkspace(workspace.id);
      workspaceRevisionRef.current = currentWorkspace.revision ?? workspaceRevisionRef.current;
      setWorkspace(currentWorkspace);
      setReadyForPlan(Boolean(currentWorkspace.draft_state?.ready_for_plan));
      queryClient.setQueryData(plannerKeys.workspace(currentWorkspace.id), currentWorkspace);
    } catch {
      setError('Could not verify the latest trip details. Please try again.');
      return;
    }
    if (!currentWorkspace.draft_state?.ready_for_plan) {
      const missing = currentWorkspace.draft_state?.missing_slots || [];
      setError(`Add ${missing.join(', ') || 'the required trip details'} before creating the plan.`);
      return;
    }
    const isRegeneration = ['generated', 'generated_degraded', 'refining'].includes(currentWorkspace.planner_state || '');
    if (
      isRegeneration &&
      !options?.skipConfirm &&
      typeof window !== 'undefined' &&
      !window.confirm('Rebuild this itinerary? Existing uncommitted plan details may change.')
    ) {
      return;
    }
    isCreatingPlanRef.current = true;
    setIsCreatingPlan(true);
    setGenerationJob(null);
    setError(null);
    try {
      const job = await plannerService.createPlan(currentWorkspace.id, {
        confirm: true,
        expected_draft_revision: currentWorkspace.revision,
        ...(isRegeneration ? { regenerate: true } : {}),
      });
      setGenerationJob(job);
      workspaceRevisionRef.current = Math.max(workspaceRevisionRef.current, job.revision || 0);

      // Poll real pipeline progress ~1s until the job settles. The loading
      // screen renders exactly what the backend reports — nothing simulated.
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await plannerService.getPlanStatus(currentWorkspace.id);
          setGenerationJob(status);
          workspaceRevisionRef.current = Math.max(workspaceRevisionRef.current, status.revision || 0);
          if (status.status === 'done' || status.status === 'failed' || status.status === 'needs_input') {
            stopPolling();
          }
        } catch {
          // transient poll failure — keep trying; staleness is server-judged
        }
      }, 1000);
    } catch (err: any) {
      if ((err?.code === 'stale_revision' || err?.status === 409) && !options?.retry) {
        isCreatingPlanRef.current = false;
        setIsCreatingPlan(false);
        await handleConfirmAndGenerate({ retry: true, skipConfirm: true });
        return;
      }
      setError(err?.message || 'The plan could not be created yet.');
      isCreatingPlanRef.current = false;
      setIsCreatingPlan(false);
    }
  };

  const handleRetryGeneration = () => {
    stopPolling();
    isCreatingPlanRef.current = false;
    setIsCreatingPlan(false);
    const needsInput = generationJob?.status === 'needs_input';
    setGenerationJob(null);
    if (!needsInput) {
      // The explicit retry bypasses only the in-flight guard, never revision checks.
      setTimeout(() => void handleConfirmAndGenerate({ retry: true, skipConfirm: true }), 0);
    }
  };

  const handleLoadingComplete = () => {
    stopPolling();
    if (workspace) {
      // Plan just generated server-side — wipe the plan cache entry entirely
      // (not just invalidate) so PlannerWorkspace gets a clean fetch instead
      // of being served a stale error-state response. router.refresh() forces
      // Next.js to re-render the current route segment, which remounts
      // PlannerWorkspace and triggers a fresh usePlan() call.
      queryClient.removeQueries({ queryKey: plannerKeys.plan(workspace.id) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspace(workspace.id) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
      router.refresh();
    }
    setIsCreatingPlan(false);
    isCreatingPlanRef.current = false;
    setGenerationJob(null);
  };

  return {
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
    setError,
    detectedIntent,
    confidenceScore,
    visitPurpose,
    openExplanations,
    setOpenExplanations,
    lastAssistantMessageId,
    handleSuggestClick,
    handleSubmit,
    handleCreatePlan: handleConfirmAndGenerate,
    handleConfirmAndGenerate,
    handleRetryGeneration,
    handleLoadingComplete,
  };
}
