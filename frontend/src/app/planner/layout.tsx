/**
 * Planner layout — fullscreen, no navbar padding.
 * The planner has its own navigation chrome.
 */

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950">
      {children}
    </div>
  );
}
