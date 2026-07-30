import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { safeErrorMessage } from '../../lib/errors';

export function useVisitDecisions(deptId: string | null) {
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const onReasonChange = (id: string, val: string) => setReasons((r) => ({ ...r, [id]: val }));

  const flash = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const decide = async (visitId: string, approved: boolean) => {
    const reason = reasons[visitId]?.trim();
    if (!approved && !reason) { setError('Please enter a rejection reason.'); return; }
    setActing(visitId); setError('');
    try {
      const rpc = (supabase as any).rpc.bind(supabase);
      const { error: err } = approved
        ? await rpc('approve_visit', { visit_id: visitId })
        : await rpc('reject_visit', { visit_id: visitId, reason: reason || 'Rejected by HOD' });
      if (err) { setError(safeErrorMessage(err, 'Action failed.')); return; }
      flash(approved ? 'Visitor approved successfully.' : 'Visit rejected.');
    } catch (err) { setError(safeErrorMessage(err, 'Action failed.')); }
    finally { setActing(null); }
  };

  // Must go through the cancel_visit SECURITY DEFINER RPC: public.visits has no
  // hod UPDATE policy, so a direct .update() matches zero rows and PostgREST
  // reports no error — the cancel silently did nothing. See migration 045.
  const cancelVisit = async (visitId: string): Promise<boolean> => {
    if (!confirm('Cancel this pre-approval? The visitor will no longer be able to check in.')) return false;
    setActing(visitId); setError('');
    try {
      const rpc = (supabase as any).rpc.bind(supabase);
      const { error: err } = await rpc('cancel_visit', { visit_id: visitId });
      if (err) { setError(safeErrorMessage(err, 'Failed to cancel.')); return false; }
      flash('Pre-approval cancelled.');
      return true;
    } catch (err) { setError(safeErrorMessage(err, 'Failed to cancel.')); return false; }
    finally { setActing(null); }
  };

  const clearAllApproved = async (): Promise<boolean> => {
    if (!deptId) return false;
    if (!confirm('Cancel ALL pre-approved visitors? They will no longer be able to check in.')) return false;
    setActing('clear-all'); setError('');
    try {
      const rpc = (supabase as any).rpc.bind(supabase);
      const { error: err } = await rpc('cancel_all_pre_approved', { p_department_id: deptId });
      if (err) { setError(safeErrorMessage(err, 'Failed to clear.')); return false; }
      flash('All pre-approvals cancelled.');
      return true;
    } catch (err) { setError(safeErrorMessage(err, 'Failed to clear.')); return false; }
    finally { setActing(null); }
  };

  return {
    acting, error, successMsg, reasons,
    setError, setSuccessMsg, onReasonChange,
    decide, cancelVisit, clearAllApproved,
  };
}
