import React from 'react';

import { Link } from 'react-router-dom';

// Overdue strip below the Pre-Registered Arrivals grid (reference screen 3):
// appears when visitors have passed their expected slot; links to the live
// queue for quick check-in.

type OverdueBannerProps = {
  count: number;
};

export default function OverdueBanner({ count }: OverdueBannerProps): React.ReactElement | null {
  if (count <= 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-warning-400/30 bg-warning-500/10 px-5 py-3.5 flex items-center gap-3">
      <svg className="w-5 h-5 shrink-0 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span className="font-display font-semibold text-warning-400">
        {count} visitor{count === 1 ? '' : 's'} overdue from expected time
      </span>
      <Link to="/guard/live-queue" className="ml-auto text-warning-400 hover:text-warning-300 transition-colors" aria-label="Go to live queue">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    </div>
  );
}
