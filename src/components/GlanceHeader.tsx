import React from 'react';

// "Today at a Glance" — the one line that states a board's WINDOW, so no tile
// under it has to (client instruction, 2026-08-17: put it on top and take
// "Today" off the individual cards).
//
// The tiles were each carrying the word: "Expected Today", "Checked In Today",
// "Checked Out Today", "Visitors Today", "Declined Today". Five cards on one
// screen restating the same qualifier is the no-duplicate-renders rule at
// board scale — it spent the widest word on every card on the one fact that is
// identical across all of them, and it still left the reader unsure about the
// cards that did NOT say it ("In Premises", "Overstaying"), which are live and
// not day-bounded at all. Said once here, the qualifier scopes the board and
// the tiles get their labels back.
//
// IT IS AN h2, NOT A PAGE HEADING, and that distinction is load-bearing. The
// guard dashboard has no <h1> by instruction (2026-08-13) and
// GuardDashboard.test.tsx asserts it, the admin Dashboard passes no
// AdminPageHeader, and the HOD board dropped its "HOD COMMAND VIEW" strip — in
// every case because the sidebar item just clicked already names the page.
// This names a SECTION and its window, which the sidebar cannot.
//
// THE CAPTION IS PER-BOARD AND IT IS NOT DECORATION. "Today" is not the whole
// truth on any of these three screens: every one of them carries open rows
// from earlier days on purpose — a visitor still inside from last night, a
// walk-in raised at 23:50 and answered at 00:05. A bare "Today at a Glance"
// over a lane that legitimately holds yesterday's people would be exactly the
// kind of confident-but-wrong framing this project has deleted elsewhere, so
// each caller says in one sentence what its board actually spans.
//
// NO DATE HERE. The topbar carries the IST date and clock on every screen
// (AppShell's TopbarClock), so printing it again would be the duplicate this
// component exists to remove.

type Props = {
  /** One sentence naming what this board's "today" actually covers. */
  caption: string;
};

export default function GlanceHeader({ caption }: Props): React.ReactElement {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="font-display text-h2 text-navy-950 dark:text-white flex items-center gap-2">
        {/* A calendar, the same glyph the Pre-Registered rail's own "Today at a
            Glance" carries — one heading, one mark, on whichever screen a
            reader meets it first. */}
        <svg
          className="w-5 h-5 text-brand-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
        Today at a Glance
      </h2>
      {/* One navy step, no `dark:` override — the scale is inverted per theme. */}
      <p className="text-xs text-navy-700">{caption}</p>
    </div>
  );
}
