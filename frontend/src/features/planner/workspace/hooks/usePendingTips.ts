import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

/**
 * Polls the backend for AI tips that are marked as 'pending'.
 * Once ready, it invalidates the React Query cache for the plan so the UI updates.
 */
export function usePendingTips(
  workspaceId: string | null, 
  pendingBlockIds: string[], 
  onTipsReady: () => void
) {
  const [isPolling, setIsPolling] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId || pendingBlockIds.length === 0) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const tips = await apiClient.get<Record<string, { ai_tip: string; ai_tip_status: string } | undefined>>(
          `/planner/workspaces/${workspaceId}/plan/tips/`
        );
        
        let hasChanges = false;
        const readyTips: Record<string, { ai_tip: string; ai_tip_status: string }> = {};
        
        for (const blockId of pendingBlockIds) {
          const tip = tips[blockId];
          if (!tip) continue;
          
          if (tip.ai_tip_status === 'ready') {
            hasChanges = true;
            readyTips[blockId] = tip;
          }
        }
        
        if (hasChanges) {
          // Direct React Query cache update so the UI updates instantly
          queryClient.setQueryData(
            ['planner', 'plan', workspaceId],
            (oldTrip: any) => {
              if (!oldTrip) return oldTrip;
              
              const newTrip = { ...oldTrip };
              
              // Update days and activities
              newTrip.days = (newTrip.days || []).map((day: any) => {
                const newDay = { ...day };
                newDay.activities = (newDay.activities || []).map((act: any) => {
                  const readyTip = readyTips[act.id];
                  if (readyTip) {
                    return {
                      ...act,
                      ai_tip: readyTip.ai_tip,
                      metadata: {
                        ...(act.metadata || {}),
                        ai_tip_status: 'ready'
                      }
                    };
                  }
                  return act;
                });
                return newDay;
              });
              
              // Update cities and transits
              newTrip.cities = (newTrip.cities || []).map((city: any) => {
                if (city.transitToNext && readyTips[city.transitToNext.id]) {
                  const readyTip = readyTips[city.transitToNext.id];
                  if (readyTip) {
                    return {
                      ...city,
                      transitToNext: {
                        ...city.transitToNext,
                        ai_tip: readyTip.ai_tip,
                        metadata: {
                          ...(city.transitToNext.metadata || {}),
                          ai_tip_status: 'ready'
                        }
                      }
                    };
                  }
                }
                return city;
              });
              
              return newTrip;
            }
          );
          
          // Trigger callbacks if needed
          onTipsReady();
        }

        // Schedule next poll
        timeoutId = setTimeout(poll, 3000);
      } catch (err) {
        timeoutId = setTimeout(poll, 5000);
      }
    };

    timeoutId = setTimeout(poll, 2500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [workspaceId, pendingBlockIds.join(','), onTipsReady, queryClient]);

  return { isPolling };
}
