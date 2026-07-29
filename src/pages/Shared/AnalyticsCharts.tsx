import React from 'react';

export type TimeSlot = { hour: number; count: number };
export type DeptStat = { name: string; total: number; approved: number; rejected: number; avgApprovalMins: number };

type Props = {
  dailyTrend: [string, number][];
  maxDaily: number;
  topHours: TimeSlot[];
  topPurposes: [string, number][];
  totalVisits: number;
  userRole: string;
  deptStats: DeptStat[];
};

export default function AnalyticsCharts({
  dailyTrend,
  maxDaily,
  topHours,
  topPurposes,
  totalVisits,
  userRole,
  deptStats,
}: Props): React.ReactElement {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Daily trend */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-navy-800 mb-4">Daily Visitor Trend</h3>
        {dailyTrend.length === 0 ? (
          <p className="text-sm text-navy-300 text-center py-8">No data available</p>
        ) : (
          <div className="space-y-1.5">
            {dailyTrend.slice(-14).map(([day, count]) => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-[10px] text-navy-400 font-mono w-16 shrink-0">{day.slice(5)}</span>
                <div className="flex-1 h-5 bg-surface-100 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-md transition-all duration-500"
                    style={{ width: `${(count / maxDaily) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-navy-600 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Peak hours */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-navy-800 mb-4">Peak Hours</h3>
        {topHours.length === 0 ? (
          <p className="text-sm text-navy-300 text-center py-8">No data available</p>
        ) : (
          <div className="space-y-2">
            {topHours.map(({ hour, count }) => {
              const maxCount = topHours[0]?.count ?? 1;
              return (
                <div key={hour} className="flex items-center gap-3">
                  <span className="text-xs text-navy-500 font-medium w-14 shrink-0">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 h-6 bg-surface-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-warning-500 to-warning-600 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    >
                      {count > 2 && <span className="text-[10px] font-bold text-white">{count}</span>}
                    </div>
                  </div>
                  {count <= 2 && <span className="text-xs font-medium text-navy-500 w-5">{count}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purpose breakdown */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-navy-800 mb-4">Visit Purpose Breakdown</h3>
        {topPurposes.length === 0 ? (
          <p className="text-sm text-navy-300 text-center py-8">No data available</p>
        ) : (
          <div className="space-y-3">
            {topPurposes.map(([purpose, count]) => {
              const pct = Math.round((count / totalVisits) * 100);
              return (
                <div key={purpose} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                    <span className="text-sm text-navy-700 capitalize">{purpose}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-navy-400">{count}</span>
                    <span className="text-xs font-semibold text-navy-600 bg-surface-100 px-2 py-0.5 rounded-md">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Department comparison (admin only) */}
      {userRole === 'admin' && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-navy-800 mb-4">Department Comparison</h3>
          {deptStats.length === 0 ? (
            <p className="text-sm text-navy-300 text-center py-8">No data available</p>
          ) : (
            <div className="space-y-3">
              {deptStats.map((dept) => (
                <div key={dept.name} className="flex items-center justify-between py-2 border-b border-surface-200/50 dark:border-white/[0.05] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-navy-800">{dept.name}</p>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[10px] text-success-600 font-medium">{dept.approved} approved</span>
                      <span className="text-[10px] text-danger-600 font-medium">{dept.rejected} rejected</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-navy-900">{dept.total}</p>
                    <p className="text-[10px] text-navy-400">visitors</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
