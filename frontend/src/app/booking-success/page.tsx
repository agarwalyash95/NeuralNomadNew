'use client';

import Link from 'next/link';

import AppShell from '@/components/ui-custom/app-shell';
import { Button } from '@/components/ui/button';

export default function BookingSuccessPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rounded-xl border bg-white p-8 text-center">
        <h1 className="text-4xl font-bold text-green-600">Booking Created</h1>

        <p className="mt-4 text-slate-600">Your booking has been successfully created.</p>

        <div className="mt-8 flex justify-center gap-4">
          <Button asChild>
            <Link href="/bookings">View Bookings</Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
