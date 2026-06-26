'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import AppShell from '@/components/ui-custom/app-shell';
import { bookingService } from '@/services/booking.service';

interface BookingStatusBadgeProps {
  status: string;
}

function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        styles[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {status}
    </span>
  );
}

export default function BookingDetailPage() {
  const params = useParams();

  const id = String(params.id);

  const [booking, setBooking] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);

  async function loadBooking() {
    try {
      const response = await bookingService.getBookings();

      const bookings = Array.isArray(response) ? response : (response.results ?? []);

      const selected = bookings.find((item: any) => String(item.id) === id) ?? null;

      setBooking(selected);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooking();
  }, []);

  async function confirmPayment() {
    if (!booking) return;

    try {
      setActionLoading(true);

      const updated = await bookingService.confirmPayment(booking.id);

      setBooking(updated);
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelBooking() {
    if (!booking) return;

    try {
      setActionLoading(true);

      const updated = await bookingService.cancelBooking(booking.id);

      setBooking(updated);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <AppShell>Loading booking...</AppShell>;
  }

  if (!booking) {
    return <AppShell>Booking not found.</AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Booking Details</h1>

            <BookingStatusBadge status={booking.status} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Reference Number</p>

              <p className="font-semibold">{booking.reference_number}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Booking Type</p>

              <p className="font-semibold">{booking.booking_type}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Provider</p>

              <p className="font-semibold">{booking.provider}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Amount</p>

              <p className="font-semibold">₹{booking.amount}</p>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              onClick={confirmPayment}
              disabled={actionLoading}
              className="rounded-lg bg-green-600 px-4 py-2 text-white"
            >
              Confirm Payment
            </button>

            <button
              onClick={cancelBooking}
              disabled={actionLoading}
              className="rounded-lg bg-red-600 px-4 py-2 text-white"
            >
              Cancel Booking
            </button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-bold">Booking Details Payload</h2>

          <pre className="overflow-auto text-sm">{JSON.stringify(booking.details, null, 2)}</pre>
        </div>
      </div>
    </AppShell>
  );
}
