import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { formatTime } from '../../lib/formatDate';
import CheckInPanel from './CheckInPanel';
import Badge from '../../components/Badge';

type Mode = 'checkin' | 'exit' | 'checked-out' | 'no-show' | 'rejected' | 'all';

const TAB_MODE_MAP: Record<string, Mode> = {
  inside: 'exit',
  expected: 'checkin',
  'checked-out': 'checked-out',
  'no-show': 'no-show',
  all: 'all',
  rejected: 'rejected',
};

export default function GuardConsole(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialMode: Mode = (tabParam && tabParam in TAB_MODE_MAP) ? TAB_MODE_MAP[tabParam]! : 'checkin';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [preApproved, setPreApproved] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [badgeVisit, setBadgeVisit] = useState<Visit | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg, setSuccessMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [showInsideList, setShowInsideList] = useState(false);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false });
    if (error) { console.error('[Console] loadVisits error:', error.message); }
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    setVisits(rows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));

    const { data: preData } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('status', 'approved')
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: true });
    let preRows = ((preData as unknown as Visit[]) ?? []);
    preRows = await attachHostNames(preRows);
    setPreApproved(preRows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));

    setLoading(false);
  }, [today]);

  useEffect(() => {
    void loadVisits();
    const channel = supabase
      .channel('guard-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void loadVisits(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadVisits]);

  const logExit = async (visit: Visit) => {
    if (visit.status !== 'checked_in') { setActionErr('Visitor is not checked in.'); return; }
    setActionErr('');
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('visits').update({ status: 'checked_out', checked_out_at: now, exit_verified: true }).eq('id', visit.id);
      if (error) { setActionErr(safeErrorMessage(error, 'Failed to log exit.')); return; }
      setSuccessMsg(`"${visit.visitor?.full_name ?? 'Visitor'}" checked out.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadVisits();
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to log exit.')); }
  };

  const checkedIn = useMemo(() => visits.filter((v) => v.status === 'checked_in'), [visits]);
  const checkedOut = useMemo(() => visits.filter((v) => v.status === 'checked_out'), [visits]);
  const rejected = useMemo(() => visits.filter((v) => v.status === 'rejected'), [visits]);
  const noShows = useMemo(() => visits.filter((v) => v.status === 'no_show'), [visits]);

  const renderVisitorRow = (v: Visit, action?: { label: string; onClick: () => void }) => (
    <div key={v.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors">
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
      {action && (
        <button onClick={action.onClick}
          className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all">
          {action.label}
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-navy-900">Guard Console</h1>

      {/* People Inside — always visible */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        <button onClick={() => setShowInsideList((prev) => !prev)}
          className="w-full p-5 text-center hover:bg-surface-50/50 transition-colors">
          <p className="text-4xl font-bold text-brand-600 tracking-tight">{checkedIn.length}</p>
          <p className="text-sm text-navy-400 font-medium mt-0.5">People Inside</p>
          <svg className={`w-4 h-4 mx-auto mt-2 text-navy-300 transition-transform ${showInsideList ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {showInsideList && (
          <div className="border-t border-surface-200">
            {checkedIn.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-navy-400 text-sm font-medium">No visitors inside right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-100">
                {checkedIn.map((v) => renderVisitorRow(v, { label: 'Check Out', onClick: () => logExit(v) }))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setMode('checkin')}
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
        <button onClick={() => setMode('exit')}
          className={`p-4 rounded-2xl text-center font-bold text-lg transition-all relative ${
            mode === 'exit'
              ? 'bg-brand-600 text-white shadow-lg'
              : 'bg-surface-50 text-navy-500 border border-surface-200 hover:bg-surface-100'
          }`}>
          <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Check Out
          {checkedIn.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] text-xs font-bold px-1.5 rounded-full bg-white/20">{checkedIn.length}</span>
          )}
        </button>
      </div>

      {/* Success / Error messages */}
      {successMsg && (
        <div className="bg-success-50 text-success-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-success-500 hover:text-success-700 text-xs font-bold">Dismiss</button>
        </div>
      )}
      {actionErr && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{actionErr}</span>
          <button onClick={() => setActionErr('')} className="text-danger-500 hover:text-danger-700 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Mode content */}
      {mode === 'checkin' && (
        <CheckInPanel
          today={today}
          onCheckInSuccess={(name) => { setSuccessMsg(`"${name}" checked in successfully.`); void loadVisits(); setTimeout(() => setSuccessMsg(''), 6000); }}
        />
      )}

      {mode === 'exit' && (
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}</div>
          ) : checkedIn.length === 0 ? (
            <div className="text-center py-16 bg-surface-50 rounded-2xl">
              <p className="text-navy-400 text-lg font-medium">No one inside right now.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl divide-y divide-surface-100 border border-surface-200">
              {checkedIn.map((v) => renderVisitorRow(v, { label: 'Check Out', onClick: () => logExit(v) }))}
            </div>
          )}
        </div>
      )}

      {mode === 'checked-out' && (
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
              {checkedOut.map((v) => renderVisitorRow(v))}
            </div>
          )}
        </div>
      )}

      {mode === 'no-show' && (
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
              {noShows.map((v) => renderVisitorRow(v))}
            </div>
          )}
        </div>
      )}

      {mode === 'rejected' && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-danger-600 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            Rejected ({rejected.length})
          </p>
          {rejected.length === 0 ? (
            <div className="text-center py-12 bg-surface-50 rounded-2xl">
              <p className="text-navy-400 text-sm font-medium">No rejected visitors.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl divide-y divide-surface-100 border border-surface-200">
              {rejected.map((v) => renderVisitorRow(v))}
            </div>
          )}
        </div>
      )}

      {mode === 'all' && (
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
      )}

      {badgeVisit && (
        <div className="modal-overlay">
          <div className="modal-content p-6 space-y-5">
            <Badge visit={badgeVisit} />
            <div className="flex gap-3 justify-end no-print">
              <button onClick={() => setBadgeVisit(null)} className="btn-secondary">Close</button>
              <button onClick={() => window.print()} className="btn-primary">Print Badge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
