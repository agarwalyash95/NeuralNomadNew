'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileCheck, CalendarClock, Lock } from 'lucide-react';
import TravelPassCard from '@/components/travel-pass/TravelPassCard';
import UploadPassModal from '@/components/travel-pass/UploadPassModal';
import { travelPassService } from '@/services/travelpass.service';
import { tripService } from '@/services/trip.service';
import { TravelPass, DocumentType } from '@/types/travelpass';
import { Trip } from '@/types/trip';
import { useAuthStore } from '@/store/auth.store';

const FILTERS: { key: DocumentType | 'ALL'; label: string; emoji: string }[] = [
  { key: 'ALL', label: 'All', emoji: '🗂️' },
  { key: 'FLIGHT', label: 'Flights', emoji: '✈️' },
  { key: 'TRAIN', label: 'Trains', emoji: '🚂' },
  { key: 'BUS', label: 'Buses', emoji: '🚌' },
  { key: 'VISA', label: 'Visa', emoji: '🛂' },
  { key: 'HOTEL', label: 'Hotels', emoji: '🏨' },
  { key: 'INSURANCE', label: 'Insurance', emoji: '🛡️' },
  { key: 'FERRY', label: 'Ferry', emoji: '⛴️' },
  { key: 'PASSPORT', label: 'Passport', emoji: '📘' },
  { key: 'OTHER', label: 'Misc', emoji: '📁' }, // Renamed from "Other" to "Misc"
];

export default function VaultTravelPassPage() {
  const { isAuthenticated, user } = useAuthStore();

  const [passes, setPasses] = useState<TravelPass[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number; upcoming: number; by_type: Record<string, number> } | null>(null);
  const [activeFilter, setActiveFilter] = useState<DocumentType | 'ALL'>('ALL');
  const [activeTripFilter, setActiveTripFilter] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [passData, tripData, sumData] = await Promise.all([
        travelPassService.getPasses({
          type: activeFilter !== 'ALL' ? activeFilter : undefined,
          trip: activeTripFilter || undefined,
        }),
        tripService.getTrips(),
        travelPassService.getSummary(),
      ]);
      setPasses(Array.isArray(passData) ? passData : (passData as any).results || []);
      setTrips(Array.isArray(tripData) ? tripData : (tripData as any).results || []);
      setSummary(sumData);
    } catch (e) {
      console.error('Failed to load travel pass data:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeFilter, activeTripFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await travelPassService.deletePass(id);
      setPasses((p) => p.filter((x) => x.id !== id));
      setSummary((s) => s ? { ...s, total: s.total - 1 } : s);
    } catch {
      alert('Failed to delete document. Please try again.');
    }
  };

  const handleUploadSuccess = (newPass: TravelPass) => {
    setPasses((p) => [newPass, ...p]);
    setShowUpload(false);
    loadData();
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Travel Pass
          </h2>
          <p className="mt-1 text-slate-500 text-sm">
            Your digital document wallet
          </p>
        </div>

        {/* Upload FAB */}
        <button
          onClick={() => setShowUpload(true)}
          disabled={!isAuthenticated}
          title={!isAuthenticated ? 'Please log in to upload documents' : 'Add new document'}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg transition-all duration-200 active:scale-95 ${
            isAuthenticated
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/25'
              : 'cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          {isAuthenticated ? <Plus size={18} /> : <Lock size={16} />}
          {isAuthenticated ? 'Add Document' : 'Login Required'}
        </button>
      </div>

      {/* ── Stats Bar ── */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Docs', value: summary.total, icon: <FileCheck size={18} className="text-indigo-600" />, bg: 'bg-indigo-50' },
            { label: 'Active', value: summary.active, icon: <FileCheck size={18} className="text-emerald-600" />, bg: 'bg-emerald-50' },
            { label: 'Upcoming', value: summary.upcoming, icon: <CalendarClock size={18} className="text-sky-600" />, bg: 'bg-sky-50' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Layout: Filters + Grid + Sidebar ── */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {/* Filter bar */}
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all border ${
                  activeFilter === f.key
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.emoji} {f.label}
                {f.key !== 'ALL' && summary?.by_type?.[f.key] ? (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeFilter === f.key ? 'bg-white/20' : 'bg-slate-100'}`}>
                    {summary.by_type[f.key]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <Lock size={24} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Login to Access Documents</h3>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : passes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <span className="text-4xl">🗂️</span>
              <h3 className="text-base font-bold text-slate-900">No Documents Yet</h3>
              <p className="text-sm text-slate-500">Click &ldquo;Add Document&rdquo; to upload your first travel document.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Array.isArray(passes) ? passes : []).map((pass) => (
                <TravelPassCard
                  key={pass.id}
                  pass={pass}
                  isOwner={!!user}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Linked Trips */}
        {isAuthenticated && trips.length > 0 && (
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-28 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                🗺️ Linked Trips
              </h3>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setActiveTripFilter('')}
                  className={`w-full text-left rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    !activeTripFilter
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Trips
                </button>
                {(Array.isArray(trips) ? trips : []).slice(0, 8).map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => setActiveTripFilter(trip.id)}
                    className={`w-full text-left rounded-xl px-3 py-2 transition-all ${
                      activeTripFilter === trip.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <p className={`text-xs font-semibold leading-tight truncate ${activeTripFilter === trip.id ? 'text-blue-800' : 'text-slate-700'}`}>
                      {trip.destination}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${activeTripFilter === trip.id ? 'text-blue-600' : 'text-slate-400'}`}>
                      {trip.start_date && new Date(trip.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {showUpload && (
        <UploadPassModal
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
          trips={(Array.isArray(trips) ? trips : []).map((t) => ({ id: t.id, destination: t.destination }))}
        />
      )}
    </div>
  );
}
