import React from 'react';
import type { Visit } from '../../types/index';
import GuardConsoleVisitorRow from './GuardConsoleVisitorRow';

type Props = {
  checkedIn: Visit[];
  showInsideList: boolean;
  onToggle: () => void;
  onCheckOut: (v: Visit) => void;
};

export default function GuardConsoleInsideCard({ checkedIn, showInsideList, onToggle, onCheckOut }: Props): React.ReactElement {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
      <button onClick={onToggle}
        className="w-full p-5 text-center hover:bg-surface-50/50 transition-colors">
        <p className="text-4xl font-bold text-brand-600 tracking-tight">{checkedIn.length}</p>
        <p className="text-sm text-navy-400 font-medium mt-0.5">People Inside</p>
        <svg className={`w-4 h-4 mx-auto mt-2 text-navy-300 transition-transform ${showInsideList ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {showInsideList && (
        <div className="border-t border-surface-200">
          {checkedIn.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-navy-400 text-sm font-medium">No visitors inside right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {checkedIn.map((v) => <GuardConsoleVisitorRow key={v.id} visit={v} action={{ label: 'Check Out', onClick: () => onCheckOut(v) }} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
