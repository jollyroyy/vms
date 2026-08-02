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
        <span className="font-display font-bold text-sm text-navy-900 dark:text-white tabular-nums">
          {v.scheduled_for ? formatTime(v.scheduled_for) : 'Anytime'}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-navy-900 dark:text-white truncate">{v.visitor?.full_name ?? '—'}</p>
        <p className="text-xs text-navy-400 truncate">
          {v.host?.full_name ? `Host: ${v.host.full_name}` : ''}{v.department?.name ? ` · ${v.department.name}` : ''}
        </p>
      </div>
      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    </div>
  );
}
