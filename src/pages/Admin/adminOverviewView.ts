// Which of the three admin stat counts the user has drilled into. `null` means
// nothing has been clicked yet — the panel below the tiles stays collapsed until
// then, so the page opens as a summary rather than a wall of records.
export type AdminOverviewView = 'departments' | 'hods' | 'unassigned';

// Direct lookup, never an includes() chain over the view key.
export const ADMIN_OVERVIEW_TITLES: Record<AdminOverviewView, string> = {
  departments: 'Departments',
  hods: 'Heads of Department',
  unassigned: 'Awaiting an HOD',
};

export const ADMIN_OVERVIEW_HINTS: Record<AdminOverviewView, string> = {
  departments: 'Add, rename or remove a department and manage its HOD roster.',
  hods: 'Every head of department currently assigned, grouped by department.',
  unassigned: 'Departments with no head of department yet — assign one to close the gap.',
};
