import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { AuditLog } from '../../types/index';

export default function ActivityPage(): React.ReactElement {
  const [logs, setLogs] = useState<(AuditLog & { profile?: { full_name: string; email: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*, profile:user_id(id, full_name, email)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); } else { setLogs((data ?? []) as any); }
        setLoading(false);
      });
  }, []);

  const actionLabel = (a: string): { text: string; color: string } => {
    const map: Record<string, { text: string; color: string }> = {
      visit_approved:     { text: 'Visit Approved', color: 'bg-success-50 text-success-700' },
      visit_rejected:     { text: 'Visit Rejected', color: 'bg-danger-50 text-danger-700' },
      visit_checked_in:   { text: 'Checked In', color: 'bg-brand-50 text-brand-700' },
      visit_checked_out:  { text: 'Checked Out', color: 'bg-navy-50 text-navy-700' },
    };
    return map[a] ?? { text: a, color: 'bg-surface-100 text-navy-600' };
  };

  return (
    <div className="space-y-6">
      <div className="page-header !mb-6">
        <h1 className="page-title">Activity Log</h1>
        <p className="page-subtitle">Audit trail of all visit actions</p>
      </div>

      {error && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-5">
              <div className="flex gap-3 items-center">
                <div className="h-10 w-10 skeleton rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton w-1/3" />
                  <div className="h-3 skeleton w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && logs.length === 0 && !error && (
        <div className="empty-state py-20">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
            <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-lg font-semibold text-navy-600">No activity yet</p>
          <p className="text-sm text-navy-400 mt-1">Visit actions will appear here</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="space-y-2">
          {logs.map((log) => {
            const lbl = actionLabel(log.action);
            const det = log.details as Record<string, unknown> | null;
            return (
              <div key={log.id} className="card p-4 flex items-start gap-4 animate-fade-in">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${lbl.color}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {log.action.includes('approved') ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : log.action.includes('checked_out') ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-navy-900">{log.profile?.full_name ?? log.user_id.slice(0, 8)}</span>
                    <span className={`status-badge text-xs ${lbl.color}`}>{lbl.text}</span>
                  </div>
                  <p className="text-xs text-navy-400 mt-0.5">
                    {det?.ref_number ? `${String(det.ref_number)} · ` : ''}
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </p>
                    {det?.reason ? (
                    <p className="text-xs text-danger-600 mt-1 italic">Reason: {String(det.reason)}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
