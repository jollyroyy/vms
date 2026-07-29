import React from 'react';
import AuroraBackdrop, { DARK_STAGE } from './KioskAuroraBackdrop';

type Props = { onStart: () => void };

export default function KioskIdleScreen({ onStart }: Props): React.ReactElement {
  return (
    <div className={`${DARK_STAGE} flex flex-col items-center justify-center p-8`}>
      <AuroraBackdrop />
      <div className="relative animate-fade-in text-center max-w-lg">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center mx-auto shadow-glow-mix ring-4 ring-white/10 mb-8">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">SecureGate</h1>
        <p className="text-lg text-brand-200/80 mb-2">Visitor Self Check-in Kiosk</p>
        <p className="text-sm text-white/50 mb-12">Touch the screen to begin</p>
        <button onClick={onStart}
          className="w-64 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-2xl px-8 py-5 text-xl font-bold hover:shadow-glow-accent active:scale-[0.97] shadow-glow-mix transition-all duration-200 animate-pulse-soft">
          Tap to Start
        </button>
        <p className="text-xs text-white/40 mt-8">Tap anywhere or press any key</p>
      </div>
    </div>
  );
}
