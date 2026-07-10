import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { plannerService } from '@/services/planner.service';
import type { ChatMessage, GenerationJobStatus, PlannerWorkspace } from '@/services/planner.types';
import { plannerKeys, useWorkspace } from '@/features/planner/hooks/usePlannerQueries';
import { streamChatMessage } from '../services/chatStream';

interface UseConversationProps {
  workspaceId?: string | null;
}

const STREAMING_ENABLED = process.env.NEXT_PUBLIC_CHAT_STREAMING === '1';

export function useConversation({ workspaceId }: UseConversationProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: workspaceData } = useWorkspace(workspaceId ?? null);

  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState<PlannerWorkspace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readyForPlan, setReadyForPlan] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [generationJob, setGenerationJob] = useState<GenerationJobStatus | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [detectedIntent, setDetectedIntent] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [visitPurpose, setVisitPurpose] = useState<string | null>(null);
  /** Deterministic next-step chips from the last streamed turn */
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);

  // Sync workspace object from the shared query cache
  useEffect(() => {
    if (workspaceId && workspaceData) {
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
      setWorkspace(ws);
      setReadyForPlan(response.ready_for_plan);

      // Keep the shared cache truthful without refetching everything
      queryClient.setQueryData(plannerKeys.workspace(ws.id), ws);
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
          { message, structured_value: structuredValue },
          {
            onState: (s) => {
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
            onDone: (d) => {
              const ws: PlannerWorkspace = d.workspace;
              setWorkspace(ws);
              setReadyForPlan(d.ready_for_plan);
              setSuggestedReplies(d.suggested_replies ?? []);
              queryClient.setQueryData(plannerKeys.workspace(ws.id), ws);
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
        ? await plannerService.sendMessage(workspace.id, message, structuredValue)
        : await plannerService.sendLazyMessage(message, structuredValue);
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

  const handleCreatePlan = async () => {
    if (!workspace || !readyForPlan || isCreatingPlan) return;
    setIsCreatingPlan(true);
    setGenerationJob(null);
    setError(null);
    try {
      const job = await plannerService.createPlan(workspace.id);
      setGenerationJob(job);

      // Poll real pipeline progress ~1s until the job settles. The loading
      // screen renders exactly what the backend reports — nothing simulated.
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await plannerService.getPlanStatus(workspace.id);
          setGenerationJob(status);
          if (status.status === 'done' || status.status === 'failed') {
            stopPolling();
          }
        } catch {
          // transient poll failure — keep trying; staleness is server-judged
        }
      }, 1000);
    } catch {
      setError('The plan could not be created yet.');
      setIsCreatingPlan(false);
    }
  };

  const handleRetryGeneration = () => {
    stopPolling();
    setIsCreatingPlan(false);
    setGenerationJob(null);
    // Next tick re-enters handleCreatePlan cleanly
    setTimeout(() => handleCreatePlan(), 0);
  };

  const handleLoadingComplete = () => {
    stopPolling();
    if (workspace) {
      // Status changed server-side (draft → planned) — refresh what we hold
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspace(workspace.id) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.plan(workspace.id) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
      router.push(`/planner/${workspace.id}`);
    }
    setIsCreatingPlan(false);
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
    handleCreatePlan,
    handleRetryGeneration,
    handleLoadingComplete,
  };
}
