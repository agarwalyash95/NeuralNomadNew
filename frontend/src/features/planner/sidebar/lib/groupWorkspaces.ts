import type { PlannerWorkspace, WorkspaceBucket } from '@/services/planner.types';

export function hasGeneratedPlan(workspace: PlannerWorkspace): boolean {
  return workspace.status !== 'draft';
}

/**
 * Client fallback when the server hasn't sent a bucket (older payloads).
 * Mirrors get_bucket on PlannerWorkspaceSerializer exactly:
 * booked beats saved beats recent; a modified saved plan falls back to
 * Recent until it's re-saved.
 */
function deriveBucket(w: PlannerWorkspace): WorkspaceBucket {
  if (w.bucket) return w.bucket;
  if (w.status === 'booked') return 'booked';
  if (w.status === 'saved' && !w.is_modified) return 'saved';
  return 'recent';
}

export interface GroupedWorkspaces {
  /** Drafts and plans with unsaved changes — active work, sorted by recency */
  recent: PlannerWorkspace[];
  /** Explicitly saved plans, untouched since the save */
  saved: PlannerWorkspace[];
  /** Fully booked trips, sorted by departure — calm by design */
  booked: PlannerWorkspace[];
}

export function groupWorkspaces(workspaces: PlannerWorkspace[]): GroupedWorkspaces {
  const groups: GroupedWorkspaces = { recent: [], saved: [], booked: [] };

  for (const w of workspaces) {
    groups[deriveBucket(w)].push(w);
  }

  const byActivity = (a: PlannerWorkspace, b: PlannerWorkspace) =>
    new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();

  const byDeparture = (a: PlannerWorkspace, b: PlannerWorkspace) => {
    const aStart = a.draft_state?.start_date ? new Date(a.draft_state.start_date).getTime() : Infinity;
    const bStart = b.draft_state?.start_date ? new Date(b.draft_state.start_date).getTime() : Infinity;
    return aStart - bStart;
  };

  groups.recent.sort(byActivity);
  groups.saved.sort(byActivity);
  groups.booked.sort(byDeparture);

  return groups;
}
