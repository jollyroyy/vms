import type { Visit } from '../types/index';
import { formatDateTime, formatTime, formatDuration } from '../lib/formatDate';

interface Props {
  visit: Visit;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending_approval: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-500/30' },
  approved:         { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-500/30' },
  walkin_approved:  { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-500/30' },
  checked_in:       { bg: 'bg-brand-50',   text: 'text-brand-700',   border: 'border-brand-500/30' },
  checked_out:      { bg: 'bg-surface-100', text: 'text-navy-500',   border: 'border-surface-300' },
  rejected:         { bg: 'bg-danger-50',  text: 'text-danger-700',  border: 'border-danger-500/30' },
};

export default function VisitorDetails({ visit: v, onClose }: Props) {
  const dur = v.checked_in_at ? formatDuration(v.checked_in_at) : null;
  const statusStyle = STATUS_COLORS[v.status] ?? { bg: 'bg-surface-100', text: 'text-navy-500', border: 'border-surface-300' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Gradient header strip */}
        <div className="relative h-20 bg-gradient-to-r from-navy-900 via-navy-800 to-brand-900">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(51,150,255,0.15),transparent)]" />
          {/* Close button as floating pill */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-white/15 backdrop-blur-sm text-white/90 hover:bg-white/25 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>

        {/* Photo overlapping header */}
        <div className="px-5 -mt-10 relative z-10">
          <div className="flex gap-4 items-end">
            {v.photo_url ? (
              <img src={v.photo_url} alt="" className="w-[72px] h-[90px] object-cover rounded-2xl shadow-elevated ring-4 ring-white shrink-0" />
            ) : (
              <div className="w-[72px] h-[90px] bg-gradient-to-br from-surface-100 to-surface-200 rounded-2xl flex items-center justify-center shrink-0 ring-4 ring-white shadow-elevated">
                <svg className="w-7 h-7 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <p className="font-bold text-navy-950 text-lg truncate leading-tight">{v.visitor?.full_name ?? '—'}</p>
              <p className="text-sm text-navy-500 truncate">{v.visitor?.company ?? ''}</p>
            </div>
          </div>
        </div>

        {/* Status banner */}
        <div className={`mx-5 mt-4 px-4 py-2.5 rounded-xl border ${statusStyle.bg} ${statusStyle.border} flex items-center justify-between`}>
          <span className={`text-sm font-semibold ${statusStyle.text} capitalize`}>{v.status.replace(/_/g, ' ')}</span>
          <span className="text-xs text-navy-400 font-mono">{v.ref_number}</span>
        </div>

        {/* Info grid with icon labels */}
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-navy-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
              <div>
                <p className="text-navy-300 text-[10px] uppercase tracking-wide">Phone</p>
                <p className="text-navy-700 font-medium">{v.visitor?.phone ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-navy-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
              <div>
                <p className="text-navy-300 text-[10px] uppercase tracking-wide">Department</p>
                <p className="text-navy-700 font-medium">{v.department?.name ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-navy-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
              <div>
                <p className="text-navy-300 text-[10px] uppercase tracking-wide">Meeting</p>
                <p className="text-navy-700 font-medium">{v.host?.full_name ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-navy-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
              <div>
                <p className="text-navy-300 text-[10px] uppercase tracking-wide">Purpose</p>
                <p className="text-navy-700 font-medium capitalize">{v.purpose}</p>
              </div>
            </div>
          </div>
          {v.visitor?.id_type && (
            <div className="flex items-start gap-2 mt-3">
              <svg className="w-3.5 h-3.5 text-navy-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>
              <div>
                <p className="text-navy-300 text-[10px] uppercase tracking-wide">ID</p>
                <p className="text-navy-700 font-medium">{v.visitor.id_type}{v.visitor.id_last4 ? ` (xxxx${v.visitor.id_last4})` : ''}</p>
              </div>
            </div>
          )}
          {v.carrying_material && (
            <div className="flex items-start gap-2 mt-3">
              <svg className="w-3.5 h-3.5 text-warning-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              <div>
                <p className="text-navy-300 text-[10px] uppercase tracking-wide">Carrying Material</p>
                <p className="text-warning-700 font-medium">Yes</p>
              </div>
            </div>
          )}
        </div>

        {/* Timeline for timestamps */}
        <div className="mx-5 mt-2 mb-5 rounded-xl bg-surface-50 border border-surface-200/60 p-4">
          <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wider mb-3">Timeline</p>
          <div className="space-y-3 relative">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-surface-200" />

            <div className="flex items-start gap-3 relative">
              <div className="w-[11px] h-[11px] rounded-full bg-navy-300 border-2 border-white shrink-0 mt-0.5 z-10" />
              <div className="flex-1 flex justify-between items-baseline">
                <span className="text-[11px] text-navy-400 font-medium">Registered</span>
                <span className="text-[11px] text-navy-700 font-medium">{formatDateTime(v.created_at)}</span>
              </div>
            </div>
            {v.checked_in_at && (
              <div className="flex items-start gap-3 relative">
                <div className="w-[11px] h-[11px] rounded-full bg-brand-500 border-2 border-white shrink-0 mt-0.5 z-10" />
                <div className="flex-1 flex justify-between items-baseline">
                  <span className="text-[11px] text-navy-400 font-medium">Checked In</span>
                  <span className="text-[11px] text-navy-700 font-medium">{formatDateTime(v.checked_in_at)}</span>
                </div>
              </div>
            )}
            {v.checked_out_at && (
              <div className="flex items-start gap-3 relative">
                <div className="w-[11px] h-[11px] rounded-full bg-success-500 border-2 border-white shrink-0 mt-0.5 z-10" />
                <div className="flex-1 flex justify-between items-baseline">
                  <span className="text-[11px] text-navy-400 font-medium">Checked Out</span>
                  <span className="text-[11px] text-navy-700 font-medium">{formatDateTime(v.checked_out_at)}</span>
                </div>
              </div>
            )}
            {dur && v.status === 'checked_in' && (
              <div className="flex items-start gap-3 relative">
                <div className={`w-[11px] h-[11px] rounded-full border-2 border-white shrink-0 mt-0.5 z-10 ${dur.isOvertime ? 'bg-danger-500' : 'bg-brand-400'}`} />
                <div className={`flex-1 flex justify-between items-baseline ${dur.isOvertime ? 'text-danger-600 font-bold' : 'text-navy-500'}`}>
                  <span className="text-[11px]">Duration</span>
                  <span className="text-[11px]">{dur.text}{dur.isOvertime ? ' ⚠️' : ''}</span>
                </div>
              </div>
            )}
            {v.rejection_reason && (
              <div className="flex items-start gap-3 relative">
                <div className="w-[11px] h-[11px] rounded-full bg-danger-500 border-2 border-white shrink-0 mt-0.5 z-10" />
                <div className="flex-1">
                  <span className="text-[11px] text-danger-500 font-medium block">Rejection Reason</span>
                  <span className="text-[11px] text-danger-600 font-medium">{v.rejection_reason}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
