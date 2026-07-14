import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { plannerKeys } from '@/features/planner/hooks/usePlannerQueries';

/**
 * Real-time workspace event stream via SSE (T3.2).
 *
 * Uses fetch() instead of native EventSource so we can send
 * `Authorization: Bearer` in the request header — native EventSource can
 * only pass the token as a URL query param, which leaks into server access
 * logs. Auto-reconnects on drop with capped exponential backoff (2s -> 30s).
 */

const MAX_RETRY_MS = 30_000;

export function useLiveWorkspaceEvents(workspaceId: string) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const tokens = useAuthStore(state => state.tokens);
  const token = tokens?.access;
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const retryDelay = useRef(2000);
  const mountedRef = useRef(true);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: plannerKeys.plan(workspaceId) });
    queryClient.invalidateQueries({ queryKey: plannerKeys.workspace(workspaceId) });
    queryClient.invalidateQueries({ queryKey: plannerKeys.proposals(workspaceId) });
    queryClient.invalidateQueries({ queryKey: plannerKeys.insights(workspaceId) });
  }, [queryClient, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !token) return;
    mountedRef.current = true;

    const connect = async () => {
      if (!mountedRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;

      const url = `/api/v1/planner/workspaces/${workspaceId}/live/`;

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE ${response.status}`);
        }

        retryDelay.current = 2000;
        if (mountedRef.current) setConnected(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'workspace_updated' && mountedRef.current) {
                  setLastUpdate(new Date());
                  invalidateAll();
                }
              } catch {
                // ignore malformed SSE lines
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('Live workspace events disconnected, retrying in', retryDelay.current, 'ms');
      } finally {
        if (mountedRef.current) setConnected(false);
      }

      if (mountedRef.current) {
        await new Promise(r => setTimeout(r, retryDelay.current));
        retryDelay.current = Math.min(retryDelay.current * 2, MAX_RETRY_MS);
        connect();
      }
    };

    connect();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      setConnected(false);
    };
  }, [workspaceId, token, invalidateAll]);

  return { connected, lastUpdate };
}
