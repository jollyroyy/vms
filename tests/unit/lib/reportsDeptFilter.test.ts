import { describe, it, expect } from 'vitest';
import { ALL_DEPTS, deptOptions, filterVisitsByDept, deptFilterLabel } from '../../../src/lib/reportsDeptFilter';
import type { ReportVisit } from '../../../src/lib/reportRow';

const visit = (id: string, deptId: string, deptName: string | null, code: string | null = null): ReportVisit =>
  ({
    id,
    department_id: deptId,
    department: deptName ? { id: deptId, name: deptName, code } : null,
  }) as unknown as ReportVisit;

describe('reportsDeptFilter', () => {
  describe('deptOptions', () => {
    it('returns no options for an empty register', () => {
      expect(deptOptions([])).toEqual([]);
    });

    it('lists each department once, with the number of visits it holds', () => {
      const opts = deptOptions([
        visit('a', 'd1', 'IT', 'IT'),
        visit('b', 'd2', 'Finance', 'FIN'),
        visit('c', 'd1', 'IT', 'IT'),
      ]);
      expect(opts).toEqual([
        { id: 'd2', name: 'Finance', code: 'FIN', count: 1 },
        { id: 'd1', name: 'IT', code: 'IT', count: 2 },
      ]);
    });

    it('sorts alphabetically by name so the list is scannable', () => {
      const opts = deptOptions([
        visit('a', 'd3', 'Security'),
        visit('b', 'd1', 'Admin'),
        visit('c', 'd2', 'Finance'),
      ]);
      expect(opts.map((o) => o.name)).toEqual(['Admin', 'Finance', 'Security']);
    });

    // The join can come back null when a department row is unreadable; the visit
    // still belongs to a real department_id, so it must remain selectable rather
    // than silently vanishing from every filtered view.
    it('keeps visits whose department join is missing, under a named placeholder', () => {
      const opts = deptOptions([visit('a', 'd9', null)]);
      expect(opts).toEqual([{ id: 'd9', name: 'Unknown department', code: null, count: 1 }]);
    });

    it('counts sum to the register total', () => {
      const visits = [visit('a', 'd1', 'IT'), visit('b', 'd2', 'HR'), visit('c', 'd2', 'HR')];
      const total = deptOptions(visits).reduce((n, o) => n + o.count, 0);
      expect(total).toBe(visits.length);
    });
  });

  describe('filterVisitsByDept', () => {
    const visits = [visit('a', 'd1', 'IT'), visit('b', 'd2', 'HR'), visit('c', 'd1', 'IT')];

    it('returns every visit when the filter is All', () => {
      expect(filterVisitsByDept(visits, ALL_DEPTS)).toHaveLength(3);
    });

    it('returns the same array reference when unfiltered, so the table does not re-render needlessly', () => {
      expect(filterVisitsByDept(visits, ALL_DEPTS)).toBe(visits);
    });

    it('returns only the selected department', () => {
      expect(filterVisitsByDept(visits, 'd1').map((v) => v.id)).toEqual(['a', 'c']);
    });

    it('returns nothing for a department with no visits in range', () => {
      expect(filterVisitsByDept(visits, 'd404')).toEqual([]);
    });
  });

  describe('deptFilterLabel', () => {
    const opts = deptOptions([visit('a', 'd1', 'IT')]);

    it('reads "All Departments" when nothing is selected', () => {
      expect(deptFilterLabel(opts, ALL_DEPTS)).toBe('All Departments');
    });

    it('reads the department name when one is selected', () => {
      expect(deptFilterLabel(opts, 'd1')).toBe('IT');
    });

    // A stale selection (the department dropped out of the new date range) must
    // not leave the button labelled with a department the table no longer shows.
    it('falls back to All Departments when the selection is no longer in range', () => {
      expect(deptFilterLabel(opts, 'gone')).toBe('All Departments');
    });
  });
});
