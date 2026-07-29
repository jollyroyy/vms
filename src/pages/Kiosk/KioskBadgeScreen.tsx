import React from 'react';
import Badge from '../../components/Badge';
import type { Visit } from '../../types/index';

type Props = {
  badgeVisit: Visit | null;
  successMsg: string;
  resetCountdown: number;
};

export default function KioskBadgeScreen({ badgeVisit, successMsg, resetCountdown }: Props): React.ReactElement {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-8">
      <div className="animate-fade-in text-center max-w-md">
        {badgeVisit ? (
          <div className="mb-6 flex justify-center scale-125 origin-top">
            <Badge visit={badgeVisit} />
          </div>
        ) : (
          <div className="mb-8">
            <div className="h-20 w-20 rounded-full bg-success-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{successMsg}</h2>
          </div>
        )}
        <div className="space-y-4">
          <button onClick={() => window.print()} className="w-64 bg-white/10 text-white rounded-xl px-6 py-4 text-lg font-semibold hover:bg-white/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mx-auto">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
            Print Badge
          </button>
          <div className="flex items-center justify-center gap-2 text-navy-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            <span>Resetting in {resetCountdown}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
