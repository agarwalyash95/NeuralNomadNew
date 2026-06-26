interface Props {
  status: string;
}

export default function BookingStatusBadge({ status }: Props) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',

    confirmed: 'bg-green-100 text-green-800',

    cancelled: 'bg-red-100 text-red-800',

    completed: 'bg-blue-100 text-blue-800',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        styles[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {status}
    </span>
  );
}
