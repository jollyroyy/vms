import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { useVisitDecisions } from './useVisitDecisions';
import PreApproveForm from './PreApproveForm';
import VisitorDetails from '../../components/VisitorDetails';
import ApprovalsPendingList from './ApprovalsPendingList';

type Tab = 'pending' | 'pre-approve';

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pending',     label: 'Pending',     icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'pre-approve', label: 'Pre-Approve', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
];

export default function HODApprovals(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['pending', 'pre-approve'];
  const tabParam = searchParams.get('tab');
  const tab: Tab = validTabs.includes(tabParam as Tab) ? (tabParam as Tab) : 'pending';
  const setTab = useCallback((t: Tab) => {
    setSearchParams({ tab: t }, { replace: true });
  }, [setSearchParams]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();

  const { acting, error: actionError, successMsg, reasons, onReasonChange, decide } = useVisitDecisions(userDeptId);

  useEffect(() => {
    try {
      supabase.auth.getUser().then((res) => {
        const user = res?.data?.user;
        if (!user) { setError('Not authenticated.'); return; }
        const deptId = user.app_metadata?.department_id as string | undefined;
        if (!deptId) {
          setError('Your account is not assigned to any department. Contact admin.');
          return;
        }
        setUserDeptId(deptId);
      });
    } catch { /* auth not available */ }
  }, []);

  const loadPending = useCallback(async () => {
    if (!userDeptId) return;
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('department_id', userDeptId)
      .in('status', ['pending_approval'] as const)
      .order('created_at', { ascending: false });
    if (err) { setError(safeErrorMessage(err, 'Failed to load approvals.')); setLoading(false); return; }
    let raw = ((data as unknown as Visit[]) ?? []);
    raw = await attachHostNames(raw);
    setVisits(raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    setLoading(false);
  }, [userDeptId]);

  const loadPendingCount = useCallback(async () => {
    if (!userDeptId) return;
    const { count } = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', userDeptId)
      .eq('status', 'pending_approval');
    setPendingCount(count ?? 0);
  }, [userDeptId]);

  useEffect(() => { if (userDeptId) void loadPending(); }, [userDeptId, loadPending]);
  useEffect(() => { if (userDeptId) void loadPendingCount(); }, [userDeptId, loadPendingCount]);

  useEffect(() => {
    if (!userDeptId) return;
    const ch = supabase.channel('hod-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        void loadPending();
        void loadPendingCount();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userDeptId, loadPending, loadPendingCount]);

  return (
    <div className="animate-fade-in space-y-6">
      {detailVisit && (
        <VisitorDetails
          visit={detailVisit}
          onClose={() => setDetailVisit(null)}
          acting={acting}
          reason={reasons[detailVisit.id] ?? ''}
          onReasonChange={(val) => onReasonChange(detailVisit.id, val)}
          onApprove={() => { void decide(detailVisit.id, true); setDetailVisit(null); }}
          onReject={() => { void decide(detailVisit.id, false); setDetailVisit(null); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Approvals</h1>
            <p className="page-subtitle">Visitor approvals &amp; activity</p>
          </div>
        </div>
        <button onClick={() => { void loadPending(); void loadPendingCount(); }} className="btn-icon" title="Refresh">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {successMsg && (
        <div className="alert-success">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{successMsg}</span>
        </div>
      )}
      {(error || actionError) && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{error || actionError}</span>
        </div>
      )}

      <div className="tab-group w-full mb-5">
        {TAB_CONFIG.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 flex-1 justify-center ${tab === key ? 'tab-active' : 'tab-inactive'}`}>
            {icon}
            <span className="hidden sm:inline">{label}</span>
            {key === 'pending' && pendingCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-sm">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <ApprovalsPendingList visits={visits} loading={loading} error={error} acting={acting} reasons={reasons}
          onReasonChange={onReasonChange} onDecide={decide} onViewDetails={setDetailVisit} />
      )}
      {tab === 'pre-approve' && (
        <div className="animate-fade-in">
          {/* The form already shows one green success popup. Dismissing it hands
              off straight to the pre-approved list rather than raising a second
              banner here, so there is exactly one success confirmation. */}
          <PreApproveForm onPreApproved={() => navigate('/overview?filter=approved')} />
        </div>
      )}
    </div>
  );
}
