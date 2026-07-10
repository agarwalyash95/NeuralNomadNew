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
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2 mb-1.5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#968f83]">
          {title}
        </h3>
        {workspaces.length > 0 && (
          <span className="text-[9px] font-bold bg-[#e8e3d5]/60 text-[#7c756a] px-2 py-0.5 rounded-full scale-90">
            {workspaces.length}
          </span>
        )}
      </div>

      <div className="max-h-[220px] overflow-y-auto custom-scrollbar pr-0.5 space-y-1.5">
        {workspaces.length > 0 ? (
          workspaces.map((workspace) => {
            const hasPlan = hasGeneratedPlan(workspace);
            const dateStr = workspace.last_activity_at
              ? new Date(workspace.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '';
            return (
              <SidebarItem
                key={workspace.id}
                icon={hasPlan ? <Map size={14} strokeWidth={1.8} /> : <MessageSquare size={14} strokeWidth={1.8} />}
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
          <p className="px-2 py-2 text-xs text-[#968f83]/80 italic font-medium">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
