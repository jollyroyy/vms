import React from 'react';
import { Link } from 'react-router-dom';
import DepartmentsManager from './DepartmentsManager';

// Settings → Departments: departments, their heads of department, HOD password
// resets and the activity log.
//
// THIS IS THE OLD ADMIN PANEL, MOVED RATHER THAN REBUILT. `/admin` was a page
// of its own until the admin surface was rebuilt; `DepartmentsManager` is
// rendered unchanged — it owns the create/edit/delete flows, the confirm
// dialogs and the HOD invite path (`addHod` promotes an existing profile by
// email or invites a new account, and writing `profiles.role` is enough because
// migration 010's trigger mirrors it into the JWT). Redrawing working CRUD to
// fit a new frame would put the one part of this screen that already worked at
// risk for a change of margin.
//
// It was called "Roles & Users" until 2026-08-17, which was always half a name
// for it: it administers departments and the one role attached to a department.
// Accounts as accounts — every role, including the guards and staff hosts that
// have no department card to sit on — are the Users section beside it. The
// blurb that used to sit here now lives on AdminSettings, where it is printed
// once for whichever section is open.

export default function SettingsDepartments(): React.ReactElement {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Link
          to="/admin/activity"
          className="glass-chip text-navy-600 hover:text-brand-600 hover:border-brand-500/30 transition-all shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity Log
        </Link>
      </div>

      <DepartmentsManager />
    </div>
  );
}
