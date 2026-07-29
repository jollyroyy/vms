import React from 'react';
import AuroraBackdrop, { DARK_STAGE } from './KioskAuroraBackdrop';

type PreApprovedVisit = {
  id: string;
  ref_number: string;
  visitor_name: string;
  dept_name: string;
  purpose: string;
  photo_data: string | null;
};

type Props = {
  phone: string;
  onPhoneChange: (value: string) => void;
  onPhoneKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onSubmit: () => void;
  recalledName: string | null;
  blacklistHit: string | null;
  preApprovedVisit: PreApprovedVisit | null;
  checkingInPreApproved: boolean;
  onCheckInPreApproved: () => void;
  error: string;
};

export default function KioskPhoneScreen({
  phone, onPhoneChange, onPhoneKeyDown, onBack, onSubmit,
  recalledName, blacklistHit, preApprovedVisit, checkingInPreApproved, onCheckInPreApproved, error,
}: Props): React.ReactElement {
  return (
    <div className={`${DARK_STAGE} flex flex-col items-center justify-center p-8`}>
      <AuroraBackdrop />
      <div className="relative w-full max-w-md animate-fade-in">
        <button onClick={onBack} className="text-brand-200 hover:text-white text-sm mb-8 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back
        </button>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white font-display mb-2">Welcome</h2>
          <p className="text-brand-200/80">Enter your mobile number to check in</p>
        </div>
        <input type="tel" autoFocus maxLength={20} value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          onKeyDown={onPhoneKeyDown}
          placeholder="+91 98765 43210"
          className="w-full text-center text-2xl bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl px-6 py-5 text-white placeholder-white/30 outline-none focus:border-brand-300 focus:bg-white/15 transition-all" />
        <div className="flex gap-3 mt-6">
          <button onClick={onBack} className="flex-1 bg-white/10 backdrop-blur border border-white/10 text-white rounded-xl px-6 py-4 text-lg font-semibold hover:bg-white/20 active:scale-[0.98] transition-all">Cancel</button>
          <button onClick={onSubmit} className="flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl px-6 py-4 text-lg font-bold active:scale-[0.98] shadow-glow transition-all">Check In</button>
        </div>
        {recalledName && !blacklistHit && !preApprovedVisit && (
          <div className="mt-6 p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 text-center">
            <p className="text-white font-medium">Welcome back, {recalledName}</p>
            <p className="text-brand-200 text-sm mt-1">Fill in the details to continue</p>
          </div>
        )}
        {preApprovedVisit && (
          <div className="mt-6 p-6 bg-success-500/10 backdrop-blur-xl rounded-2xl border border-success-500/30 space-y-4 text-center">
            <div className="h-14 w-14 rounded-full bg-success-500/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-white text-xl font-bold">{preApprovedVisit.visitor_name}</p>
              <p className="text-success-500 text-sm mt-1">Pre-approved for {preApprovedVisit.dept_name}</p>
              <p className="text-white/50 text-xs mt-1">Ref: {preApprovedVisit.ref_number}</p>
            </div>
            <button onClick={onCheckInPreApproved} disabled={checkingInPreApproved}
              className="w-full bg-gradient-to-r from-success-500 to-success-600 text-white rounded-xl px-6 py-4 text-lg font-bold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all">
              {checkingInPreApproved ? 'Checking in...' : 'Tap to Check In'}
            </button>
          </div>
        )}
        {blacklistHit && (
          <div className="mt-6 p-4 bg-danger-500/10 backdrop-blur-xl rounded-xl border border-danger-500/30 text-center">
            <p className="text-danger-500 font-bold">ACCESS DENIED</p>
            <p className="text-white/60 text-sm mt-1">{blacklistHit}</p>
          </div>
        )}
        {error && (
          <div className="mt-6 p-4 bg-danger-500/10 backdrop-blur-xl rounded-xl border border-danger-500/30 text-center">
            <p className="text-danger-500">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
