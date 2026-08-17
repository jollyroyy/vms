import React from 'react';

type Props = {
  title: string;
  /** One line under the title. Omitted where it would restate the title — the
   *  sidebar item the admin just clicked already names the page. */
  blurb?: string;
  /** Controls on the trailing edge: a range picker, an export button. */
  action?: React.ReactNode;
};

// The heading row every admin tab opens with.
//
// The guard and HOD dashboards deliberately have NO page heading — the sidebar
// item just clicked already says it, and the page restating its own name spends
// the widest line on screen on the one fact the reader cannot be in doubt
// about. The admin tabs keep theirs because seven of the nine carry a control
// on that row (a date range, an export, a filter reset), so the line exists
// regardless and the title is what stops it reading as a floating toolbar.
//
// THE ADMIN DASHBOARD IS THE EXCEPTION and passes no header at all, for exactly
// the guard-dashboard reason: it has no toolbar, so the row would be a title
// and nothing else.

export default function AdminPageHeader({ title, blurb, action }: Props): React.ReactElement {
  return (
    <div className="flex flex-wrap items-start gap-4 mb-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-h1 text-navy-950 dark:text-white">{title}</h1>
        {blurb && <p className="text-sm text-navy-500 mt-1">{blurb}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
