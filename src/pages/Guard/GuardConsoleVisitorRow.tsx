import React from 'react';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';

type Props = {
  visit: Visit;
  action?: { label: string; onClick: () => void };
  showStatus?: boolean;
};

export default function GuardConsoleVisitorRow({ visit: v, action, showStatus }: Props): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  return (
    <div key={v.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors">
      {v.photo_url ? (
        <img src={v.photo_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 ring-1 ring-black/5" />
      ) : (
        <div className="w-11 h-11 rounded-xl bg-surface-100 shrink-0 flex items-center justify-center ring-1 ring-black/5">
          <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-navy-900 truncate">{v.visitor?.full_name ?? '—'}</p>
        <p className="text-xs text-navy-400 truncate">{v.department?.name ?? ''}{v.purpose ? ` · ${v.purpose}` : ''}</p>
      </div>
      {showStatus && (
        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${style.bg} ${style.text}`}>{style.label}</span>
      )}
      {action && (
        <button onClick={action.onClick}
          className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all">
          {action.label}
        </button>
      )}
    </div>
  );
}
