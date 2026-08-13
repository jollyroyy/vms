import React from 'react';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { formatDateTime } from '../../lib/formatDate';

type Props = {
  visit: Visit;
};

export default function PreApprovalRow({ visit: v }: Props): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {/* Wide enough for the date as well as the time (client instruction,
          2026-08-13). The column was w-16 — a time-only slot — and the date is
          what says whether "03:30" is now or a fortnight away. */}
      <div className="shrink-0 w-32 text-center">
        <span className="text-caption font-semibold text-navy-900 dark:text-white tabular-nums">
          {v.scheduled_for ? formatDateTime(v.scheduled_for) : 'Anytime'}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-h3 text-navy-900 dark:text-white truncate">{v.visitor?.full_name ?? '—'}</p>
        {v.host?.full_name && (
          <p className="text-caption text-navy-500 dark:text-navy-400 truncate">Person to Meet: {v.host.full_name}</p>
        )}
        {v.host?.full_name && v.department?.name && (
          <p className="text-caption text-navy-500 dark:text-navy-400 truncate">{v.department.name}</p>
        )}
      </div>
      <span className={`status-badge shrink-0 ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    </div>
  );
}
