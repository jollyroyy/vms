import React from 'react';
import type { DailyVisitor } from './DailyVisitorTypes';
import { TYPE_META, getInitials, formatDate } from './DailyVisitorTypes';

export default function VisitorCard({
  visitor,
  onRemove,
}: {
  visitor: DailyVisitor;
  onRemove: (id: string) => void;
}) {
  const meta = TYPE_META[visitor.type];

  return (
    <div className="card-hover p-5 group relative">
      <div className="flex items-start gap-4">
        {visitor.photo_url ? (
          <img
            src={visitor.photo_url}
            alt={visitor.full_name}
            className="h-12 w-12 rounded-2xl object-cover shrink-0 ring-2 ring-white/60 dark:ring-white/10"
          />
        ) : (
          <div className="h-12 w-12 rounded-2xl avatar-gradient flex items-center justify-center text-sm font-bold shrink-0">
            {getInitials(visitor.full_name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-navy-900 truncate">{visitor.full_name}</p>
            {visitor.checked_in_today && (
              <span className="status-badge bg-success-50 text-success-700 border border-success-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse-soft" />
                In
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <span className={`status-badge ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-xs text-navy-400">{visitor.department}</span>
          </div>

          <div className="flex items-center gap-3 mt-2.5 text-xs text-navy-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {formatDate(visitor.last_visit_date)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {visitor.phone}
            </span>
          </div>
        </div>

        <button
          onClick={() => onRemove(visitor.id)}
          className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 btn-icon h-7 w-7 text-navy-300 hover:text-danger-500 hover:bg-danger-50 transition-all duration-200"
          title={`Remove ${visitor.full_name}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
