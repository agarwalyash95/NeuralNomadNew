'use client';

import React, { useState } from 'react';
import PlannerSidebar from '../sidebar/PlannerSidebar';

interface PlannerLayoutProps {
  children: React.ReactNode;
}

export default function PlannerLayout({ children }: PlannerLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-[calc(100vh-88px)] w-full overflow-hidden bg-[#f6f4ef]">
      <PlannerSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <main className="relative flex flex-1 flex-col overflow-hidden rounded-l-[28px] border border-white/60 bg-[#fbfaf7] shadow-[0_16px_48px_-28px_rgba(15,23,42,0.28)] transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
