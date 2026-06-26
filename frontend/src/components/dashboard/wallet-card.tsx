'use client';

import GlassCard from '@/components/ui-custom/glass-card';
import { useDashboard } from '@/hooks/use-dashboard';
import Link from 'next/link';

export default function WalletCard() {
  const { wallet, loading } = useDashboard();

  if (loading) {
    return <GlassCard className="p-6">Loading Payment Info...</GlassCard>;
  }

  const methodCount = Array.isArray(wallet) ? wallet.length : 0;

  return (
    <GlassCard className="p-6 flex flex-col justify-between h-full">
      <div>
        <p className="text-sm text-slate-500">Payment Methods</p>
        <h2 className="mt-2 text-4xl font-bold">{methodCount} Linked</h2>
        <p className="mt-4 text-sm text-indigo-600">Securely manage your billing.</p>
      </div>
      <Link href="/wallet" className="mt-4 text-sm font-semibold text-blue-600 hover:underline">
        Manage &rarr;
      </Link>
    </GlassCard>
  );
}
