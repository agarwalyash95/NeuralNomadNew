export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-hidden bg-slate-950/5">
      {children}
    </div>
  );
}
