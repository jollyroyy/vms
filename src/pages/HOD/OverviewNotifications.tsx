import React from 'react';
import type { Notification } from '../../types/index';

type Props = {
  loading: boolean;
  notifs: Notification[];
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  // Same bug as OverviewUpcoming's "Open details": this used to be a blanket
  // <Link to="/approvals">, which carries no identity and lands on the empty
  // pre-approve FORM. A notification only carries `related_id` (a visit id,
  // or a gate-pass id for the two gate-pass notification types — VMS has no
  // gate-pass surface, so those never resolve to anything), not the full
  // visit — resolving it is HODOverview's job, since it already owns the
  // supabase client and the other detail-popup wiring. Omitted entirely
  // hides the control rather than rendering a link to nowhere.
  onOpenDetails?: (relatedId: string) => void;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime24 = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function OverviewNotifications({ loading, notifs, onMarkRead, onDismiss, onOpenDetails }: Props): React.ReactElement {
  return (
    <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.05]">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Status &amp; Notifications</h2>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">Real-time visitor arrivals</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-navy-500 dark:text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-500" />
          </span>
          Live
        </span>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-[84px] w-full rounded-xl" />)}
        </div>
      ) : notifs.length === 0 ? (
        <div className="py-14 px-5 flex flex-col items-center text-center">
          <svg className="w-10 h-10 text-surface-300 dark:text-navy-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <p className="text-sm font-semibold text-navy-500 dark:text-navy-400">No notifications</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">Visitor arrivals will appear here in real-time.</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-100 dark:divide-white/[0.04] overflow-y-auto max-h-[520px]">
          {notifs.map((n) => {
            const isArrival = n.type === 'visitor_checked_in';
            const isUnread = !n.is_read;
            return (
              <div key={n.id} className={`px-5 py-4 transition-colors ${isUnread ? 'bg-brand-50/40 dark:bg-brand-500/[0.04]' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 mt-0.5 ${isArrival ? 'bg-success-500' : 'bg-amber-500'}`} />
                    <span className="text-xs font-bold text-navy-900 dark:text-white truncate">{n.title}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => onMarkRead(n.id)} title="Mark as read"
                      className="p-1.5 rounded-lg text-navy-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button onClick={() => onDismiss(n.id)} title="Dismiss"
                      className="p-1.5 rounded-lg text-navy-300 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-navy-500 dark:text-navy-400 ml-4">
                  {fmtDate(n.created_at)} {fmtTime24(n.created_at)}
                </p>
                <p className="text-xs text-navy-600 dark:text-navy-300 mt-1.5 ml-4 leading-relaxed">{n.body}</p>
                {n.related_id && onOpenDetails && (
                  <button
                    type="button"
                    onClick={() => onOpenDetails(n.related_id as string)}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline mt-1.5 ml-4 block"
                  >
                    More information →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
