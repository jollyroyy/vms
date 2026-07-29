import React from 'react';

type Mode = 'checkin' | 'exit' | 'checked-out' | 'no-show' | 'rejected' | 'all';

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  checkedInCount: number;
};

export default function GuardConsoleModeTabs({ mode, onModeChange, checkedInCount }: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => onModeChange('checkin')}
        className={`p-4 rounded-2xl text-center font-bold text-lg transition-all ${
          mode === 'checkin'
            ? 'bg-brand-600 text-white shadow-lg'
            : 'bg-surface-50 text-navy-500 border border-surface-200 hover:bg-surface-100'
        }`}>
        <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Check In
      </button>
      <button onClick={() => onModeChange('exit')}
        className={`p-4 rounded-2xl text-center font-bold text-lg transition-all relative ${
          mode === 'exit'
            ? 'bg-brand-600 text-white shadow-lg'
            : 'bg-surface-50 text-navy-500 border border-surface-200 hover:bg-surface-100'
        }`}>
        <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
        Check Out
        {checkedInCount > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] text-xs font-bold px-1.5 rounded-full bg-white/20">{checkedInCount}</span>
        )}
      </button>
    </div>
  );
}
