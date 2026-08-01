import React from 'react';
import type { Visit } from '../../types/index';
import CheckInPanel from './CheckInPanel';
import GuardConsoleVisitorRow from './GuardConsoleVisitorRow';

type Mode = 'checkin' | 'exit' | 'checked-out' | 'no-show' | 'rejected' | 'all';

type Props = {
  mode: Mode;
  today: string;
  onCheckInSuccess: (name: string) => void;
  loading: boolean;
  visits: Visit[];
  checkedIn: Visit[];
  checkedOut: Visit[];
  cancelledOrRejected: Visit[];
  noShows: Visit[];
  onCheckOut: (v: Visit) => void;
};

export default function GuardConsoleModeContent({
  mode, today, onCheckInSuccess, loading, visits, checkedIn, checkedOut, cancelledOrRejected, noShows, onCheckOut,
}: Props): React.ReactElement | null {
  if (mode === 'checkin') {
    return <CheckInPanel today={today} onCheckInSuccess={onCheckInSuccess} />;
  }

  if (mode === 'exit') {
    return (
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}</div>
        ) : checkedIn.length === 0 ? (
          <div className="text-center py-16 bg-surface-50 rounded-2xl">
            <p className="text-navy-400 text-lg font-medium">No one inside right now.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-surface-100 border border-surface-200">
            {checkedIn.map((v) => <GuardConsoleVisitorRow key={v.id} visit={v} action={{ label: 'Check Out', onClick: () => onCheckOut(v) }} />)}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'checked-out') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-bold text-navy-500 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
          Checked Out ({checkedOut.length})
        </p>
        {checkedOut.length === 0 ? (
          <div className="text-center py-12 bg-surface-50 rounded-2xl">
            <p className="text-navy-400 text-sm font-medium">No visitors checked out today yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-surface-100 border border-surface-200">
            {checkedOut.map((v) => <GuardConsoleVisitorRow key={v.id} visit={v} />)}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'no-show') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          No Show ({noShows.length})
        </p>
        {noShows.length === 0 ? (
          <div className="text-center py-12 bg-surface-50 rounded-2xl">
            <p className="text-navy-400 text-sm font-medium">All expected visitors showed up.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-surface-100 border border-surface-200">
            {noShows.map((v) => <GuardConsoleVisitorRow key={v.id} visit={v} />)}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'rejected') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-bold text-danger-600 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          Cancelled / Rejected ({cancelledOrRejected.length})
        </p>
        {cancelledOrRejected.length === 0 ? (
          <div className="text-center py-12 bg-surface-50 rounded-2xl">
            <p className="text-navy-400 text-sm font-medium">No cancelled or rejected visitors.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-surface-100 border border-surface-200">
            {cancelledOrRejected.map((v) => <GuardConsoleVisitorRow key={v.id} visit={v} showStatus />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-navy-500 flex items-center gap-1.5">
        Today's Visitors ({visits.length})
      </p>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}</div>
      ) : visits.length === 0 ? (
        <div className="text-center py-12 bg-surface-50 rounded-2xl">
          <p className="text-navy-400 text-sm font-medium">No visits today yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl divide-y divide-surface-100 border border-surface-200">
          {visits.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-5 py-3.5">
              {v.photo_url ? (
                <img src={v.photo_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 ring-1 ring-black/5" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-surface-100 shrink-0 flex items-center justify-center ring-1 ring-black/5">
                  <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-navy-900 truncate">{v.visitor?.full_name ?? '—'}</p>
                <p className="text-xs text-navy-400 truncate">{v.department?.name ?? ''}{v.purpose ? ` · ${v.purpose}` : ''}</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md capitalize status-badge status-{v.status}">
                {v.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
