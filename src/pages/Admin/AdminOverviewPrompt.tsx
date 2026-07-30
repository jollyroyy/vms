// Collapsed state prompt shown until the admin clicks a count to reveal records.
import React from 'react';

type Props = {
  id: string;
};

export default function AdminOverviewPrompt({ id }: Props): React.ReactElement {
  return (
    <div id={id} className="empty-state card animate-fade-in">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10 border border-brand-500/20 flex items-center justify-center mb-3">
        <svg
          className="w-6 h-6 text-brand-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-navy-500">Pick a count to begin</p>
      <p className="text-xs text-navy-300 mt-1">Click any count above to see the records behind it.</p>
    </div>
  );
}
