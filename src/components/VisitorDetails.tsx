import type { Visit } from '../types/index';
import { formatDateTime, formatTime, formatDuration } from '../lib/formatDate';

interface Props {
  visit: Visit;
  onClose: () => void;
}

export default function VisitorDetails({ visit: v, onClose }: Props) {
  const dur = v.checked_in_at ? formatDuration(v.checked_in_at) : null;
  return (
    <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-modal space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-navy-900 text-base">Visitor Details</h3>
          <button onClick={onClose} className="btn-ghost p-1 -mr-1 -mt-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-3 items-start">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="w-16 h-20 object-cover rounded-xl shadow-soft shrink-0" />
          ) : (
            <div className="w-16 h-20 bg-surface-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-navy-900 text-base truncate">{v.visitor?.full_name ?? '—'}</p>
            <p className="text-xs text-navy-500">{v.visitor?.company ?? ''}</p>
            <p className="text-xs text-navy-400">{v.visitor?.phone ?? ''}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <p className="text-navy-300 text-[10px] uppercase tracking-wide">Ref No.</p>
            <p className="font-mono text-navy-700 font-medium">{v.ref_number}</p>
          </div>
          <div>
            <p className="text-navy-300 text-[10px] uppercase tracking-wide">Status</p>
            <p className="capitalize text-navy-700 font-medium">{v.status.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-navy-300 text-[10px] uppercase tracking-wide">Department</p>
            <p className="text-navy-700">{v.department?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-navy-300 text-[10px] uppercase tracking-wide">Meeting</p>
            <p className="text-navy-700">{v.host?.full_name ?? '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-navy-300 text-[10px] uppercase tracking-wide">Purpose</p>
            <p className="text-navy-700 capitalize">{v.purpose}</p>
          </div>
          {v.visitor?.id_type && (
            <div className="col-span-2">
              <p className="text-navy-300 text-[10px] uppercase tracking-wide">ID</p>
              <p className="text-navy-700">{v.visitor.id_type}{v.visitor.id_last4 ? ` (xxxx${v.visitor.id_last4})` : ''}</p>
            </div>
          )}
          {v.carrying_material && (
            <div className="col-span-2">
              <p className="text-navy-300 text-[10px] uppercase tracking-wide">Carrying Material</p>
              <p className="text-navy-700">Yes</p>
            </div>
          )}
        </div>

        <div className="border-t border-surface-200 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-navy-300">Registered</span>
            <span className="text-navy-700 font-medium">{formatDateTime(v.created_at)}</span>
          </div>
          {v.checked_in_at && (
            <div className="flex justify-between">
              <span className="text-navy-300">Checked In</span>
              <span className="text-navy-700 font-medium">{formatDateTime(v.checked_in_at)}</span>
            </div>
          )}
          {v.checked_out_at && (
            <div className="flex justify-between">
              <span className="text-navy-300">Checked Out</span>
              <span className="text-navy-700 font-medium">{formatDateTime(v.checked_out_at)}</span>
            </div>
          )}
          {dur && v.status === 'checked_in' && (
            <div className={`flex justify-between ${dur.isOvertime ? 'text-danger-600 font-bold' : 'text-navy-500'}`}>
              <span>Duration</span>
              <span>{dur.text}{dur.isOvertime ? ' ⚠️' : ''}</span>
            </div>
          )}
          {v.rejection_reason && (
            <div className="flex justify-between">
              <span className="text-danger-500">Rejection Reason</span>
              <span className="text-danger-600 font-medium">{v.rejection_reason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
