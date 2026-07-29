import React from 'react';
import PhotoCapture from '../../components/PhotoCapture';
import type { MatchItem } from './CheckInPanel';

type Props = {
  selectedMatch: MatchItem;
  photoBlob: Blob | null;
  error: string;
  checkingIn: boolean;
  onBack: () => void;
  onCapture: (blob: Blob) => void;
  onRetake: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function CheckInPhotoStep({
  selectedMatch, photoBlob, error, checkingIn, onBack, onCapture, onRetake, onCancel, onConfirm,
}: Props): React.ReactElement {
  if (photoBlob === null) {
    return (
      <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
        <button onClick={onBack} className="text-sm text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to search
        </button>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
          <div>
            <p className="text-xl font-bold text-navy-900">{selectedMatch.visitorName}</p>
            <p className="text-sm text-navy-400">{selectedMatch.departmentName} · {selectedMatch.purpose}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
              selectedMatch.source === 'pre_approved' ? 'bg-success-50 text-success-700' : 'bg-accent-50 text-accent-700'
            }`}>
              {selectedMatch.source === 'pre_approved' ? 'Pre-Approved' : 'Regular Visitor'}
            </span>
          </div>
          <p className="text-sm font-semibold text-navy-700">Take a photo to check in</p>
          <PhotoCapture onCapture={onCapture} />
        </div>
        {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
        <div className="flex items-center gap-3">
          <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl ring-2 ring-success-200" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-navy-900">{selectedMatch.visitorName}</p>
            <p className="text-sm text-navy-400 truncate">{selectedMatch.departmentName}</p>
            <p className="text-xs text-success-600 font-semibold mt-1">Photo captured</p>
          </div>
          <button onClick={onRetake} className="text-danger-600 hover:text-danger-700 text-sm font-semibold shrink-0">Retake</button>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-3 text-sm transition-all">Cancel</button>
          <button onClick={onConfirm} disabled={checkingIn}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {checkingIn ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Checking in...</>
            ) : 'Check In'}
          </button>
        </div>
      </div>
      {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
    </div>
  );
}
