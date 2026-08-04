// Department filter for the register (`/reports`).
//
// The options are DERIVED FROM THE ROWS ALREADY ON SCREEN, not fetched from
// `departments`. Two reasons: the register is already fully loaded for the
// chosen range, so filtering is instant and needs no round trip; and a picker
// built from the data can never offer a department that would open an empty
// table. It also means no second realtime subscription on a read-only page —
// `useDepartments()` stays the source for pickers that *write* a department.
import type { ReportVisit } from './reportRow';

export const ALL_DEPTS = 'all';

export type DeptOption = {
  id: string;
  name: string;
  code: string | null;
  count: number;
};

/** Departments present in the given visits, alphabetical, each with its visit count. */
export function deptOptions(visits: ReportVisit[]): DeptOption[] {
  const byId = new Map<string, DeptOption>();
  for (const v of visits) {
    const id = v.department_id;
    const existing = byId.get(id);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byId.set(id, {
      id,
      // `department_id` is NOT NULL, but the join is dropped when the department
      // row is unreadable. Naming it keeps the visit filterable instead of
      // stranding it under a blank label.
      name: v.department?.name ?? 'Unknown department',
      code: v.department?.code ?? null,
      count: 1,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The visits belonging to `deptId`, or every visit when `deptId` is ALL_DEPTS. */
export function filterVisitsByDept(visits: ReportVisit[], deptId: string): ReportVisit[] {
  if (deptId === ALL_DEPTS) return visits;
  return visits.filter((v) => v.department_id === deptId);
}

/** What the filter control reads. Unknown ids degrade to "All Departments". */
export function deptFilterLabel(options: DeptOption[], deptId: string): string {
  return options.find((o) => o.id === deptId)?.name ?? 'All Departments';
}
