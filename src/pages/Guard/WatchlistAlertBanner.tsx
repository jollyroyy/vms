import React from 'react';

import { Link } from 'react-router-dom';

// Row 3 of the guard dashboard (reference screen 1): the red WATCHLIST
// ALERT banner that links to the Watchlist tab when flagged visitor
// matches were recorded today.

type WatchlistAlertBannerProps = {
  watchlistCount: number;
};

export default function WatchlistAlertBanner({ watchlistCount }: WatchlistAlertBannerProps): React.ReactElement | null {
  if (watchlistCount <= 0) return null;

  return (
    <Link
      to="/guard/watchlist"
      className="block rounded-2xl bg-danger-600/10 border border-danger-500/30 px-5 py-4 flex items-center gap-4 hover:bg-danger-600/15 transition-colors">
      <span className="text-danger-400">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </span>
      <span className="font-bold uppercase tracking-wide text-danger-400 text-sm whitespace-nowrap">Watchlist Alert:</span>
      <span className="text-danger-100 dark:text-navy-200 text-sm">{watchlistCount} flagged visitor match today</span>
      <svg className="w-5 h-5 ml-auto text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}
