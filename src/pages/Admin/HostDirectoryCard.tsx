import React from 'react';
import { initialsOf } from '../../lib/initials';
import type { HostSummary } from '../../lib/adminHosts';

type Props = { host: HostSummary };

// One card in the Hosts Directory grid: a face, the host's name, their
// department, and this week's arrival count. Four facts, none repeated — the
// name is not also printed as a heading elsewhere on the card, and the
// department is not also carried by a colour, matching the no-duplicate-
// renders rule the rest of the admin surface follows.
//
// The photo (`host.avatarUrl`) is preferred where `hostDirectory()` found
// one; the round initials face every board in the app already uses
// (`initialsOf`) is not being replaced, only demoted to a fallback — a host
// who never uploaded a photo, or one that is not an HOD and whose name only
// a visit's own join could supply, must still render a face rather than an
// empty circle.

export default function HostDirectoryCard({ host }: Props): React.ReactElement {
  return (
    <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07]
                    px-4 py-3.5 flex items-center gap-3 shadow-glow-sm">
      {host.avatarUrl ? (
        <img
          src={host.avatarUrl}
          alt=""
          className="shrink-0 w-11 h-11 rounded-full object-cover ring-2 ring-brand-500/25"
        />
      ) : (
        <span className="shrink-0 w-11 h-11 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400
                         text-sm font-semibold flex items-center justify-center">
          {initialsOf(host.name)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy-950 dark:text-white truncate">{host.name}</span>
        <span className="block text-xs text-navy-700 truncate">{host.departmentName}</span>
        <span className="block text-xs text-navy-500 mt-0.5">
          This week: {host.visitsThisWeek} visit{host.visitsThisWeek === 1 ? '' : 's'}
        </span>
      </span>
    </div>
  );
}
