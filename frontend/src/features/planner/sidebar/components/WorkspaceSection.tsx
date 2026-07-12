import React from 'react';
import { Map, MessageSquare } from 'lucide-react';
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

export function WorkspaceSection({
  title,
  workspaces,
  activeWorkspaceId,
  onOpen,
  onDelete,
  emptyMessage,
  showStatusBadge = true,
}: WorkspaceSectionProps) {
  if (workspaces.length === 0 && !emptyMessage) return null;

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
          workspaces.map((workspace) => {
            const hasPlan = hasGeneratedPlan(workspace);
            const dateStr = workspace.last_activity_at
              ? new Date(workspace.last_activity_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '';
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
      </div>
    </div>
  );
}
