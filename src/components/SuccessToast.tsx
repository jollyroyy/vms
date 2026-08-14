import React from 'react';

// Fully opaque success toast fixed at the top-centre of the viewport.
// Reused by the guard lanes that show inline action confirmations.

type SuccessToastProps = {
  message: string | null;
  onDismiss: () => void;
};

export default function SuccessToast({ message, onDismiss }: SuccessToastProps): React.ReactElement | null {
  if (!message) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-success-500/40 px-5 py-2.5 shadow-glow-sm animate-fade-in bg-[rgb(18_42_30)] bg-opacity-100">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-white">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
      <span className="text-sm font-medium text-success-600 dark:text-success-400 whitespace-nowrap">{message}</span>
      <button onClick={onDismiss} className="ml-2 text-success-600/70 hover:text-success-600 transition-colors" aria-label="Dismiss">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
