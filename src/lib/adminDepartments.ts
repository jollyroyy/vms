// Department CRUD for the Admin Panel.
// Validation is pure so it can run before any network call; the write helpers throw
// on failure so the UI only has to try/catch. Tested by tests/unit/lib/adminDepartments.test.ts.
import { supabase } from '../supabaseClient';
import type { Department } from '../types/index';

export type DepartmentInput = { name: string; code: string };

export const DEPT_CODE_MAX = 10;

const squash = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Trims the name and uppercases the code (codes are stored uppercase, whitespace-free). */
export function normalizeDepartmentInput(input: DepartmentInput): DepartmentInput {
  return {
    name: squash(input.name),
    code: input.code.replace(/\s+/g, '').toUpperCase(),
  };
}

/**
 * Returns a human-readable error, or null when the input is valid.
 * `excludeId` is the row being edited — it never counts as its own duplicate.
 */
export function validateDepartment(
  input: DepartmentInput,
  existing: Department[],
  excludeId?: string,
): string | null {
  const { name, code } = normalizeDepartmentInput(input);

  if (!name) return 'Department name is required.';
  if (!code) return 'Department code is required.';
  if (code.length > DEPT_CODE_MAX) {
    return `Department code must be ${DEPT_CODE_MAX} characters or fewer.`;
  }

  const others = existing.filter((d) => d.id !== excludeId);

  const nameClash = others.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (nameClash) return `A department named "${nameClash.name}" already exists.`;

  const codeClash = others.find((d) => d.code.toUpperCase() === code);
  if (codeClash) return `Department code "${codeClash.code}" is already used by "${codeClash.name}".`;

  return null;
}

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  const payload = normalizeDepartmentInput(input);
  const { data, error } = await supabase.from('departments').insert(payload).select().single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Failed to add department.');
  return data as Department;
}

export async function updateDepartment(id: string, input: DepartmentInput): Promise<Department> {
  const payload = normalizeDepartmentInput(input);
  const { data, error } = await supabase.from('departments').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Failed to update department.');
  return data as Department;
}

export const DELETE_BLOCKED =
  'Nothing was deleted. Your account is not allowed to delete departments, or the '
  + 'department was already removed. Sign out and back in, then try again.';

/**
 * Deletes a department. Members are unlinked first — the FK from profiles would
 * otherwise block the delete, and a dangling department_id would leave an HOD
 * approving for a department that no longer exists.
 *
 * The delete is verified with `.select()`: a DELETE filtered out by RLS comes back
 * with error === null and zero rows, so without this check the UI would report a
 * cheerful success while the row was still there.
 */
export async function deleteDepartment(id: string): Promise<void> {
  const { error: unlinkError } = await supabase
    .from('profiles')
    .update({ department_id: null, role: 'staff', delegate_id: null })
    .eq('department_id', id);
  if (unlinkError) throw new Error(describeDeleteError(unlinkError.message));

  const { data, error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw new Error(describeDeleteError(error.message));
  if (!data || data.length === 0) throw new Error(DELETE_BLOCKED);
}

/** Turns a raw Postgres error into something an admin can act on. */
export function describeDeleteError(message: string): string {
  if (/foreign key|violates foreign/i.test(message)) {
    return 'Cannot delete: visits, gate passes or users are still linked to this department. Reassign them first.';
  }
  if (/infinite recursion/i.test(message)) {
    return 'Database access rules for profiles are misconfigured (policy recursion). '
      + 'Apply migration 040_fix_profiles_select_recursion.sql.';
  }
  return message;
}
