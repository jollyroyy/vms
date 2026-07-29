import React from 'react';
import type { GatePass } from '../../types/index';

type Props = {
  gatePasses: GatePass[];
};

export default function AnalyticsGatePassSummary({ gatePasses }: Props): React.ReactElement {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-navy-800 mb-4">Gate Pass Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <p className="text-2xl font-bold text-navy-900">{gatePasses.length}</p>
          <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Total Passes</p>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <p className="text-2xl font-bold text-brand-600">{gatePasses.filter((g) => g.type === 'RGP').length}</p>
          <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Returnable</p>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <p className="text-2xl font-bold text-navy-600">{gatePasses.filter((g) => g.type === 'NRGP').length}</p>
          <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Non-Returnable</p>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <p className="text-2xl font-bold text-danger-600">{gatePasses.filter((g) => g.status === 'awaiting_return' || g.status === 'partially_returned').length}</p>
          <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Open Returns</p>
        </div>
      </div>
    </div>
  );
}
