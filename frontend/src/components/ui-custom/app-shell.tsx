import { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 pb-8">{children}</div>
  );
}
