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

  const cancelVisit = async (visitId: string) => {
    if (!confirm('Cancel this pre-approval? The visitor will no longer be able to check in.')) return;
    setActing(visitId); setError('');
    try {
      const { error: err } = await supabase.from('visits').update({ status: 'cancelled' as any }).eq('id', visitId);
      if (err) { setError(safeErrorMessage(err, 'Failed to cancel.')); return; }
      flash('Pre-approval cancelled.');
    } catch (err) { setError(safeErrorMessage(err, 'Failed to cancel.')); }
    finally { setActing(null); }
  };

  const clearAllApproved = async () => {
    if (!deptId) return;
    if (!confirm('Cancel ALL pre-approved visitors? They will no longer be able to check in.')) return;
    setActing('clear-all'); setError('');
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { error: err } = await supabase.from('visits')
        .update({ status: 'cancelled' as any }).eq('department_id', deptId)
        .eq('status', 'approved').gte('created_at', todayStart.toISOString());
      if (err) { setError(safeErrorMessage(err, 'Failed to clear.')); return; }
      flash('All pre-approvals cancelled.');
    } catch (err) { setError(safeErrorMessage(err, 'Failed to clear.')); }
    finally { setActing(null); }
  };

  return {
    acting, error, successMsg, reasons,
    setError, setSuccessMsg, onReasonChange,
    decide, cancelVisit, clearAllApproved,
  };
}
