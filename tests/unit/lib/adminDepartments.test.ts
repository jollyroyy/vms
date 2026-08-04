// TDD: department CRUD used by the Admin Panel (src/lib/adminDepartments.ts).
// Validation is pure and tested directly; the Supabase calls are asserted through
// a recording mock so we verify the exact table/payload/filter that gets sent.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeDepartmentInput,
  validateDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  describeDeleteError,
  DEPT_CODE_MAX,
  DELETE_BLOCKED,
} from '../../../src/lib/adminDepartments';
import type { Department } from '../../../src/types/index';

/* ─── Recording supabase mock ───────────────────────────── */

type Call = { table: string; op: string; payload?: any; col?: string; val?: any };

const state = vi.hoisted(() => ({
  calls: [] as any[],
  error: null as string | null,
  row: null as any,
  deletedRows: [{ id: 'd1' }] as any[] | null,
}));

/** A promise that also exposes `.select()` so both `await q` and `q.select().single()` work. */
function thenable(result: any, extra: Record<string, any> = {}) {
  return Object.assign(Promise.resolve(result), extra);
}

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: any) => {
        state.calls.push({ table, op: 'insert', payload });
        const result = state.error
          ? { data: null, error: { message: state.error } }
          : { data: state.row ?? { id: 'new-id', created_at: 'now', ...payload }, error: null };
        return { select: () => ({ single: () => Promise.resolve(result) }) };
      },
      update: (payload: any) => ({
        eq: (col: string, val: any) => {
          state.calls.push({ table, op: 'update', payload, col, val });
          const result = state.error
            ? { data: null, error: { message: state.error } }
            : { data: state.row ?? { id: val, created_at: 'now', ...payload }, error: null };
          return thenable(result, { select: () => ({ single: () => Promise.resolve(result) }) });
        },
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          state.calls.push({ table, op: 'delete', col, val });
          const result = state.error
            ? { data: null, error: { message: state.error } }
            : { data: state.deletedRows, error: null };
          return thenable(result, { select: () => Promise.resolve(result) });
        },
      }),
    }),
  },
}));

beforeEach(() => {
  state.calls = [];
  state.error = null;
  state.row = null;
  state.deletedRows = [{ id: 'd1' }];
});

const dept = (over: Partial<Department> = {}): Department => ({
  id: 'd1', name: 'Human Resources', code: 'HR', created_at: 'now', ...over,
});

/* ─── normalizeDepartmentInput ──────────────────────────── */

describe('normalizeDepartmentInput', () => {
  it('trims the name and uppercases + trims the code', () => {
    expect(normalizeDepartmentInput({ name: '  Finance  ', code: ' fin ' }))
      .toEqual({ name: 'Finance', code: 'FIN' });
  });

  it('collapses internal whitespace in the name', () => {
    expect(normalizeDepartmentInput({ name: 'Human   Resources', code: 'hr' }).name)
      .toBe('Human Resources');
  });

  it('strips whitespace inside the code', () => {
    expect(normalizeDepartmentInput({ name: 'X', code: 'i t' }).code).toBe('IT');
  });
});

/* ─── validateDepartment ────────────────────────────────── */

describe('validateDepartment', () => {
  it('returns null for a valid, unique department', () => {
    expect(validateDepartment({ name: 'Finance', code: 'FIN' }, [dept()])).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(validateDepartment({ name: '   ', code: 'FIN' }, [])).toMatch(/name is required/i);
  });

  it('rejects an empty code', () => {
    expect(validateDepartment({ name: 'Finance', code: '  ' }, [])).toMatch(/code is required/i);
  });

  it(`rejects a code longer than ${DEPT_CODE_MAX} characters`, () => {
    const long = 'A'.repeat(DEPT_CODE_MAX + 1);
    expect(validateDepartment({ name: 'Finance', code: long }, [])).toMatch(/10 characters/i);
  });

  it('rejects a duplicate name regardless of case', () => {
    const msg = validateDepartment({ name: 'human resources', code: 'HRX' }, [dept()]);
    expect(msg).toMatch(/already exists/i);
    expect(msg).toContain('Human Resources');
  });

  it('rejects a duplicate code regardless of case', () => {
    const msg = validateDepartment({ name: 'Totally New', code: 'hr' }, [dept()]);
    expect(msg).toMatch(/already used/i);
    expect(msg).toContain('HR');
  });

  it('ignores the row being edited via excludeId (renaming a dept to its own name is allowed)', () => {
    expect(validateDepartment({ name: 'Human Resources', code: 'HR' }, [dept()], 'd1')).toBeNull();
  });

  it('still rejects a clash with a DIFFERENT row when excludeId is given', () => {
    const existing = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    expect(validateDepartment({ name: 'Finance', code: 'HR' }, existing, 'd1')).toMatch(/already exists/i);
  });

  it('rejects a name containing a script tag', () => {
    expect(validateDepartment({ name: '<script>alert(1)</script>', code: 'X' }, [])).toMatch(/cannot contain/i);
  });

  it('rejects a name shaped like a SQL injection payload', () => {
    expect(validateDepartment({ name: "'; DROP TABLE departments;--", code: 'X' }, [])).toMatch(/cannot contain/i);
  });

  it('rejects a name longer than 60 characters', () => {
    const long = 'A'.repeat(61);
    expect(validateDepartment({ name: long, code: 'X' }, [])).toMatch(/60 characters/i);
  });

  it('rejects an emoji name', () => {
    expect(validateDepartment({ name: '🎉 Party Dept', code: 'X' }, [])).toMatch(/cannot contain/i);
  });

  it('rejects an invalid code character', () => {
    expect(validateDepartment({ name: 'Finance', code: 'H@R' }, [])).toMatch(/cannot contain/i);
  });

  it('accepts an ampersand in both name and code (R&D)', () => {
    expect(validateDepartment({ name: 'R&D', code: 'R&D' }, [])).toBeNull();
  });

  it('accepts Human Resources / HR', () => {
    expect(validateDepartment({ name: 'Human Resources', code: 'HR' }, [])).toBeNull();
  });

  it('accepts a slash in the name (Legal/Compliance)', () => {
    expect(validateDepartment({ name: 'Legal/Compliance', code: 'LC' }, [])).toBeNull();
  });

  it('reports the charset error rather than the duplicate error when a name is both invalid AND a duplicate', () => {
    const existing = [dept({ name: '<script>x</script>' })];
    const msg = validateDepartment({ name: '<script>x</script>', code: 'HRX' }, existing);
    expect(msg).toMatch(/cannot contain/i);
    expect(msg).not.toMatch(/already exists/i);
  });
});

/* ─── createDepartment ──────────────────────────────────── */

describe('createDepartment', () => {
  it('inserts the normalized name and code into departments', async () => {
    await createDepartment({ name: '  Finance ', code: 'fin' });
    expect(state.calls).toEqual([
      { table: 'departments', op: 'insert', payload: { name: 'Finance', code: 'FIN' } },
    ]);
  });

  it('returns the created row', async () => {
    state.row = dept({ id: 'd9', name: 'Finance', code: 'FIN' });
    await expect(createDepartment({ name: 'Finance', code: 'FIN' })).resolves.toEqual(state.row);
  });

  it('throws with the database message when the insert fails', async () => {
    state.error = 'duplicate key value violates unique constraint';
    await expect(createDepartment({ name: 'Finance', code: 'FIN' })).rejects.toThrow(/duplicate key/);
  });
});

/* ─── updateDepartment ──────────────────────────────────── */

describe('updateDepartment', () => {
  it('updates the row matched by id with normalized values', async () => {
    await updateDepartment('d1', { name: ' People Ops ', code: 'po' });
    expect(state.calls).toEqual([
      { table: 'departments', op: 'update', payload: { name: 'People Ops', code: 'PO' }, col: 'id', val: 'd1' },
    ]);
  });

  it('throws when the update fails', async () => {
    state.error = 'permission denied';
    await expect(updateDepartment('d1', { name: 'X', code: 'X' })).rejects.toThrow(/permission denied/);
  });
});

/* ─── deleteDepartment ──────────────────────────────────── */

describe('deleteDepartment', () => {
  it('unlinks member profiles BEFORE deleting the department', async () => {
    await deleteDepartment('d1');
    expect(state.calls).toHaveLength(2);
    expect(state.calls[0]).toEqual({
      table: 'profiles',
      op: 'update',
      payload: { department_id: null, role: 'staff', delegate_id: null },
      col: 'department_id',
      val: 'd1',
    });
    expect(state.calls[1]).toEqual({ table: 'departments', op: 'delete', col: 'id', val: 'd1' });
  });

  it('translates a foreign-key violation into an actionable message', async () => {
    state.error = 'update or delete on table "departments" violates foreign key constraint';
    await expect(deleteDepartment('d1')).rejects.toThrow(/visits, gate passes or users/i);
  });

  it('rethrows other errors unchanged', async () => {
    state.error = 'permission denied for table departments';
    await expect(deleteDepartment('d1')).rejects.toThrow(/permission denied/);
  });

  it('resolves when the delete returns a row', async () => {
    state.deletedRows = [{ id: 'd1' }];
    await expect(deleteDepartment('d1')).resolves.toBeUndefined();
  });

  it('throws DELETE_BLOCKED when the delete returns an empty array (RLS silently filtered it)', async () => {
    state.deletedRows = [];
    await expect(deleteDepartment('d1')).rejects.toThrow(/Nothing was deleted/i);
    state.deletedRows = [];
    await expect(deleteDepartment('d1')).rejects.toThrow(DELETE_BLOCKED);
  });

  it('throws DELETE_BLOCKED when the delete returns null data', async () => {
    state.deletedRows = null;
    await expect(deleteDepartment('d1')).rejects.toThrow(DELETE_BLOCKED);
  });
});

/* ─── describeDeleteError ───────────────────────────────── */

describe('describeDeleteError', () => {
  it('translates a foreign-key violation into an actionable message', () => {
    const msg = describeDeleteError(
      'update or delete on table "departments" violates foreign key constraint',
    );
    expect(msg).toMatch(/visits, gate passes or users/i);
  });

  it('translates a profiles RLS recursion error into a migration hint', () => {
    const msg = describeDeleteError('infinite recursion detected in policy for relation "profiles"');
    expect(msg).toMatch(/policy recursion/i);
    expect(msg).toContain('040');
  });

  it('passes an unrecognised message through unchanged', () => {
    expect(describeDeleteError('some other database error')).toBe('some other database error');
  });
});
