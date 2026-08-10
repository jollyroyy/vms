import React from 'react';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { formatTime } from '../../lib/formatDate';

type Props = {
  visit: Visit;
};

export default function PreApprovalRow({ visit: v }: Props): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="shrink-0 w-16 text-center">
        <span className="text-body font-semibold text-navy-900 dark:text-white tabular-nums">
          {v.scheduled_for ? formatTime(v.scheduled_for) : 'Anytime'}
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
