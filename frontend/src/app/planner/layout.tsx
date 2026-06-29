'use client';

import React from 'react';

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#FAFAFA]">
      {children}
    </div>
  );
}
