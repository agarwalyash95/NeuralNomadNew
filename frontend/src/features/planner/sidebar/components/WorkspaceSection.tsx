import React, { useState } from 'react';
import { Map, MessageSquare, ChevronDown } from 'lucide-react';
import type { PlannerWorkspace } from '@/services/planner.types';
import { hasGeneratedPlan } from '../lib/groupWorkspaces';
import { SidebarItem } from './SidebarItem';

interface WorkspaceSectionProps {
  title: string;
  workspaces: PlannerWorkspace[];
  activeWorkspaceId: string | null;
  onOpen: (w: PlannerWorkspace) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  emptyMessage?: string;
  showStatusBadge?: boolean;
}

/** "2h ago" for anything recent, falling back to an absolute "Jul 10" once
 *  it's more than a week old — recency is what's scannable at a glance for
 *  a list you check often; an old absolute date is what's meaningful later. */
function formatRecency(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const VISIBLE_CAP = 6;

export function WorkspaceSection({
  title,
  workspaces,
  activeWorkspaceId,
  onOpen,
  onDelete,
  emptyMessage,
  showStatusBadge = true,
}: WorkspaceSectionProps) {
  const [expanded, setExpanded] = useState(false);
  if (workspaces.length === 0 && !emptyMessage) return null;

  const visible = expanded ? workspaces : workspaces.slice(0, VISIBLE_CAP);
  const hiddenCount = workspaces.length - visible.length;

  return (
    <div className="pt-4 first:pt-0">
      {/* Ultra-subtle section label — whitespace over borders */}
      <div className="flex items-center gap-2 px-2 mb-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-400">
          {title}
        </span>
        {workspaces.length > 0 && (
          <span className="text-[9px] font-semibold text-ink-400/60 tabular-nums">
            {workspaces.length}
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        {workspaces.length > 0 ? (
          visible.map((workspace) => {
            const hasPlan = hasGeneratedPlan(workspace);
            const dateStr = workspace.last_activity_at ? formatRecency(workspace.last_activity_at) : '';
            return (
              <SidebarItem
                key={workspace.id}
                icon={
                  hasPlan
                    ? <Map size={13} strokeWidth={1.7} />
                    : <MessageSquare size={13} strokeWidth={1.7} />
                }
                label={workspace.title}
                dateStr={dateStr}
                status={workspace.status}
                hint={workspace.next_action}
                isModified={workspace.is_modified}
                isActive={workspace.id === activeWorkspaceId}
                showStatusBadge={showStatusBadge}
                onClick={() => onOpen(workspace)}
                onDelete={(e) => onDelete(e, workspace.id)}
              />
            );
          })
        ) : (
          <p className="px-2 py-1.5 text-[11px] text-ink-400 italic">
            {emptyMessage}
          </p>
        )}

        {(hiddenCount > 0 || expanded) && workspaces.length > VISIBLE_CAP && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full cursor-pointer items-center gap-1 px-2 py-1.5 text-[10.5px] font-semibold text-ink-400 hover:text-ink-700"
          >
            <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
}
