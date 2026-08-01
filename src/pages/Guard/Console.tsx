import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import GuardConsoleInsideCard from './GuardConsoleInsideCard';
import GuardConsoleModeTabs from './GuardConsoleModeTabs';
import GuardConsoleModeContent from './GuardConsoleModeContent';
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
  const cancelledOrRejected = useMemo(() => visits.filter((v) => v.status === 'rejected' || v.status === 'cancelled'), [visits]);
  const noShows = useMemo(() => visits.filter((v) => v.status === 'no_show'), [visits]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-navy-900">Guard Console</h1>

      {/* People Inside — always visible */}
      <GuardConsoleInsideCard
        checkedIn={checkedIn}
        showInsideList={showInsideList}
        onToggle={() => setShowInsideList((prev) => !prev)}
        onCheckOut={logExit}
      />

      {/* Mode toggle */}
      <GuardConsoleModeTabs mode={mode} onModeChange={setMode} checkedInCount={checkedIn.length} />

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
      <GuardConsoleModeContent
        mode={mode}
        today={today}
        onCheckInSuccess={(name) => { setSuccessMsg(`"${name}" checked in successfully.`); void loadVisits(); setTimeout(() => setSuccessMsg(''), 6000); }}
        loading={loading}
        visits={visits}
        checkedIn={checkedIn}
        checkedOut={checkedOut}
        cancelledOrRejected={cancelledOrRejected}
        noShows={noShows}
        onCheckOut={logExit}
      />

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
