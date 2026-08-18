// The job title on a department's approver row.
//
// A department is headed by whoever heads it, and since 2026-08-18 that person
// may be an `hod`, a `senior_manager` or a `staff` account — one permission,
// three job titles (lib/hodRoles.ts). The roster therefore has to SAY which,
// or three different people read as the same thing on the one screen an admin
// uses to check who is responsible for a department. The wording and the chip
// colours come from `lib/userStatus.ts`, the same pair Settings → Users prints,
// so a person is never named one thing here and another thing there.
import React from 'react';
import { ROLE_CHIP, ROLE_LABEL, type DirectoryRole } from '../../lib/userStatus';

export default function HodRoleChip({ role }: { role: string | null | undefined }): React.ReactElement | null {
  if (!role) return null;
  const key = role as DirectoryRole;
  const label = ROLE_LABEL[key];
  if (!label) return null;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_CHIP[key]}`}>
      {label}
    </span>
  );
}
