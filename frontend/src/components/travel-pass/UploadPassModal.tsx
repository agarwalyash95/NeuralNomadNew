'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle, AlertCircle, FileUp } from 'lucide-react';
import { DocumentType, CreateTravelPassRequest, DOC_TYPE_META } from '@/types/travelpass';
import { travelPassService } from '@/services/travelpass.service';
import { TravelPass } from '@/types/travelpass';

interface Trip {
  id: string;
  destination: string;
}

interface UploadPassModalProps {
  onClose: () => void;
  onSuccess: (pass: TravelPass) => void;
  trips: Trip[];
}

const DOC_TYPES: DocumentType[] = [
  'FLIGHT', 'TRAIN', 'BUS', 'FERRY', 'VISA', 'HOTEL', 'INSURANCE', 'PASSPORT', 'OTHER',
];

export default function UploadPassModal({ onClose, onSuccess, trips }: UploadPassModalProps) {
  const [form, setForm] = useState<Omit<CreateTravelPassRequest, 'document_file'>>({
    title: '',
    document_type: 'FLIGHT',
    description: '',
    origin: '',
    destination: '',
    valid_from: '',
    valid_until: '',
    status: 'UPCOMING',
    issuer: '',
    seat_info: '',
    trip: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedMeta = DOC_TYPE_META[form.document_type];

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      const created = await travelPassService.createPass({
        ...form,
        document_file: file ?? undefined,
      });
      setDone(true);
      setTimeout(() => onSuccess(created), 1200);
    } catch {
      setError('Failed to upload document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 shadow-2xl bg-white/90 backdrop-blur-xl"
      >
        {/* Header with gradient */}
        <div
          className="flex items-center justify-between p-6 pb-4 border-b border-slate-200"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
              style={{ background: `linear-gradient(135deg, ${selectedMeta.colorFrom}40, ${selectedMeta.colorTo}40)`, border: `1px solid ${selectedMeta.colorFrom}40` }}
            >
              {selectedMeta.emoji}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add Travel Document</h2>
              <p className="text-xs text-slate-500">{selectedMeta.label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <CheckCircle size={48} className="text-emerald-500" />
            <p className="text-lg font-bold text-slate-900">Document Added!</p>
            <p className="text-sm text-slate-500">Your travel pass has been saved.</p>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-5">
            {/* Document Type */}
            <div>
              <label className={labelCls}>Document Type</label>
              <div className="grid grid-cols-3 gap-2">
                {DOC_TYPES.map((type) => {
                  const m = DOC_TYPE_META[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, document_type: type }))}
                      className={`flex flex-col items-center gap-1 rounded-xl py-2.5 px-2 text-xs font-semibold transition-all border ${
                        form.document_type === type
                          ? `${m.bgClass} ${m.textClass} ${m.borderClass}`
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      <span className="text-lg">{m.emoji}</span>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={`e.g. ${selectedMeta.label} – Mumbai to Tokyo`}
                className={inputCls}
              />
            </div>

            {/* Linked Trip */}
            {trips.length > 0 && (
              <div>
                <label className={labelCls}>Linked Trip (optional)</label>
                <select
                  value={form.trip}
                  onChange={(e) => setForm((f) => ({ ...f, trip: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— None —</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>{t.destination}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Origin / Destination (for transport types) */}
            {['FLIGHT', 'TRAIN', 'BUS', 'FERRY'].includes(form.document_type) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>From</label>
                  <input type="text" value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} placeholder="e.g. BOM" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>To</label>
                  <input type="text" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder="e.g. NRT" className={inputCls} />
                </div>
              </div>
            )}

            {/* Issuer + Seat Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Issuer</label>
                <input type="text" value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} placeholder="e.g. IndiGo" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Seat / Class</label>
                <input type="text" value={form.seat_info} onChange={(e) => setForm((f) => ({ ...f, seat_info: e.target.value }))} placeholder="e.g. 14B Economy" className={inputCls} />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Valid From</label>
                <input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Valid Until</label>
                <input type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} className={inputCls} />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CreateTravelPassRequest['status'] }))} className={inputCls}>
                <option value="UPCOMING">Upcoming</option>
                <option value="ACTIVE">Active</option>
                <option value="USED">Used</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            {/* File Upload */}
            <div>
              <label className={labelCls}>Attach Document (PDF / Image)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-5 text-sm text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition-all"
              >
                <FileUp size={22} />
                {file ? (
                  <span className="text-indigo-600 font-medium">{file.name}</span>
                ) : (
                  <span>Click to browse or drag a file here</span>
                )}
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${selectedMeta.colorFrom}, ${selectedMeta.colorTo})` }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Save Travel Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
