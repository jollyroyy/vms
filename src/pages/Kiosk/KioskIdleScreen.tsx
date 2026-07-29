import React from 'react';
import AuroraBackdrop, { DARK_STAGE } from './KioskAuroraBackdrop';
import Logo from '../../components/Logo';

type Props = { onStart: () => void };

export default function KioskIdleScreen({ onStart }: Props): React.ReactElement {
  return (
    <div className={`${DARK_STAGE} flex flex-col items-center justify-center p-8`}>
      <AuroraBackdrop />
      <div className="relative animate-fade-in text-center max-w-lg">
        <Logo size="lg" className="mx-auto mb-8 shadow-glow-mix ring-4 ring-white/10" />
        <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">Quest Mall Secure Gate</h1>
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
