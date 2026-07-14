import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

/**
 * Polls the backend for AI tips that are marked as 'pending'.
 * Once ready, it invalidates the React Query cache for the plan so the UI updates.
 */
export function usePendingTips(
  workspaceId: string, 
  pendingBlockIds: string[], 
  onTipsReady: () => void
) {
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!workspaceId || pendingBlockIds.length === 0) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const { data: tips } = await api.get(`/api/planner/workspaces/${workspaceId}/plan/tips/`);
        
        let hasChanges = false;
        
        for (const blockId of pendingBlockIds) {
          const tip = tips[blockId];
          if (!tip) continue;
          
          // If the backend has marked it ready (whether it has a tip or failed),
          // we need to refetch to update the UI and remove it from pending.
          if (tip.ai_tip_status === 'ready') {
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          // Trigger a re-fetch of the plan to pull the newly generated tips
          onTipsReady();
        }

        // Always schedule the next poll. The loop is naturally terminated
        // when the React Query refetch completes, the UI re-renders, and
        // pendingBlockIds becomes empty (triggering the useEffect cleanup).
        timeoutId = setTimeout(poll, 3000);
      } catch (err) {
        // on error, retry slowly
        timeoutId = setTimeout(poll, 5000);
      }
    };

    // Delay the very first poll by 2.5s to ensure the UI's debounced save (1.2s)
    // has time to send the PATCH request to the backend. Otherwise we might fetch 
    // the old 'ready' status before the backend knows the block has changed.
    timeoutId = setTimeout(poll, 2500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [workspaceId, pendingBlockIds.join(','), onTipsReady]);

  return { isPolling };
}
