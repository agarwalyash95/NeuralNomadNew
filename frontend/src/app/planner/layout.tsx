import React from 'react';
import PlannerLayout from '@/features/planner/layout/PlannerLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlannerLayout>{children}</PlannerLayout>;
}
