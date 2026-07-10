'use client';

import React from 'react';
import PlannerSidebar from '../sidebar/PlannerSidebar';
import { usePlannerNavStore } from '@/store/planner-nav.store';

interface PlannerLayoutProps {
  children: React.ReactNode;
}

export default function PlannerLayout({ children }: PlannerLayoutProps) {
  const isSidebarOpen = usePlannerNavStore((s) => s.isSidebarOpen);
  const toggleSidebar = usePlannerNavStore((s) => s.toggleSidebar);

  return (
    <div className="relative flex h-[calc(100vh-64px)] w-full overflow-hidden bg-paper-0">
      <PlannerSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      <main className="relative flex flex-1 flex-col overflow-hidden rounded-l-[28px] border border-white/60 bg-paper-1 shadow-[0_16px_48px_-28px_rgba(15,23,42,0.28)] transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
