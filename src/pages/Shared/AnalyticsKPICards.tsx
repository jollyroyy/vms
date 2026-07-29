import React from 'react';

type Props = {
  totalVisits: number;
  approvalRate: number;
  peakHour: number;
  avgDurationMins: number;
};

export default function AnalyticsKPICards({ totalVisits, approvalRate, peakHour, avgDurationMins }: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="stat-card card-hover animate-slide-up stagger-1">
        <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center mb-2 ring-1 ring-brand-500/10">
          <svg className="w-4.5 h-4.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
        </div>
        <p className="stat-value">{totalVisits}</p>
        <p className="stat-label">Total Visitors</p>
      </div>
      <div className="stat-card card-hover animate-slide-up stagger-2">
        <div className="h-9 w-9 rounded-xl bg-success-50 flex items-center justify-center mb-2 ring-1 ring-success-500/10">
          <svg className="w-4.5 h-4.5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="stat-value">{approvalRate}%</p>
        <p className="stat-label">Approval Rate</p>
      </div>
      <div className="stat-card card-hover animate-slide-up stagger-3">
        <div className="h-9 w-9 rounded-xl bg-warning-50 flex items-center justify-center mb-2 ring-1 ring-warning-500/10">
          <svg className="w-4.5 h-4.5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="stat-value">{peakHour > 0 ? `${peakHour}:00` : '--'}</p>
        <p className="stat-label">Peak Hour</p>
      </div>
      <div className="stat-card card-hover animate-slide-up stagger-4">
        <div className="h-9 w-9 rounded-xl bg-brand-100 flex items-center justify-center mb-2 ring-1 ring-brand-500/10">
          <svg className="w-4.5 h-4.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /></svg>
        </div>
        <p className="stat-value">{avgDurationMins > 0 ? `${avgDurationMins}m` : '--'}</p>
        <p className="stat-label">Avg Duration</p>
      </div>
    </div>
  );
}
