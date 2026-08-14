import React from 'react';

type Props = {
  onClose: () => void;
  /** 'light' sits on a white/glass modal body (navy icon) — the default, used
   * by every plain popup. 'dark' sits on a dark gradient header, like
   * VisitorDetails' banner, where a navy icon would vanish. */
  variant?: 'light' | 'dark';
  className?: string;
};

// The one close (×) control every popup in the app should render, top-right,
// so it looks and behaves identically everywhere — VisitorDetails.tsx had
// this exact markup hand-rolled first; every other popup now reuses it.
export default function ModalCloseButton({ onClose, variant = 'light', className = '' }: Props): React.ReactElement {
  // Client instruction (2026-08-14): the close (×) in the top-right of every
  // popup must be clearly visible. The circular plate is kept opaque enough to
  // stand out from the panel, and the icon uses a high-contrast tone.
  const tone = variant === 'dark'
    ? 'bg-white/15 hover:bg-white/25 text-white hover:text-white'
    : 'bg-surface-100 hover:bg-surface-200 text-navy-600 hover:text-navy-800 dark:bg-white/15 dark:hover:bg-white/25 dark:text-white dark:hover:text-white';

  return (
    <button
      type="button"
      aria-label="Close"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      className={`absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full transition-all z-30 ${tone} ${className}`}
    >
      <svg className="pointer-events-none w-[0.95rem] h-[0.95rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
