'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarRange, ShieldCheck, CreditCard, Receipt, Briefcase } from 'lucide-react';
import AppShell from '@/components/ui-custom/app-shell';

interface VaultLayoutProps {
  children: ReactNode;
}

export default function VaultLayout({ children }: VaultLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'My Bookings', href: '/vault/bookings', icon: CalendarRange },
    { label: 'Travel Pass', href: '/vault/pass', icon: ShieldCheck },
    { label: 'Wallet & Payments', href: '/vault/wallet', icon: CreditCard },
    { label: 'Recent Transactions', href: '/vault/transactions', icon: Receipt },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 pt-28 pb-16">
        
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/20">
            <Briefcase size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Vault</h1>
            <p className="text-slate-500 mt-1">Manage your bookings, travel documents, and payments.</p>
          </div>
        </div>

        {/* 2-Column Portal Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="sticky top-28 flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                      }
                    `}
                  >
                    <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Right Content Area */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-sm">
              {children}
            </div>
          </main>

        </div>
      </div>
    </AppShell>
  );
}
