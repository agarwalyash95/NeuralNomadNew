import { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import { X, Loader2 } from 'lucide-react';
import { RichDetailPanel } from './rich-detail-panel';
import { useEffect } from 'react';

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: Suggestion | null;
  loading: boolean;
}

export function DetailsModal({ isOpen, onClose, details, loading }: DetailsModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col transform transition-all">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-colors"
        >
          <X size={20} />
        </button>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
            <Loader2 size={48} className="animate-spin text-primary mb-4" />
            <p className="text-slate-500 font-medium animate-pulse">Fetching rich details from Google Places...</p>
          </div>
        ) : details ? (
          <div className="flex-1 overflow-hidden">
            <RichDetailPanel place={details} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Failed to load details.
          </div>
        )}
      </div>
    </div>
  );
}

