'use client';

import React from 'react';
import PlannerChat from '@/features/planner/chat/PlannerChat';

// New conversation — an existing trip lives at /planner/[workspaceId]
export default function PlannerPage() {
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-paper-0">
      <PlannerChat workspaceId={null} />
    </div>
  );
}
