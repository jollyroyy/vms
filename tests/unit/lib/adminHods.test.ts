// TDD: HOD (head-of-department) management used by the Admin Panel.
// An admin types an HOD's name + email against a department. If a profile with that
// email already exists it is promoted; otherwise a new account is invited and promoted.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeHodInput,
  validateHod,
  addHod,
  updateHod,
  removeHod,
} from '../../../src/lib/adminHods';
import type { Profile } from '../../../src/types/index';

/* ─── Recording supabase mock ───────────────────────────── */

const state = vi.hoisted(() => ({
  calls: [] as any[],
  lookupProfile: null as any, // profile returned when searching by email
  error: null as string | null,
  signUpUserId: 'new-user-id' as string | null,
  signUpError: null as string | null,
}));

function thenable(result: any, extra: Record<string, any> = {}) {
  return Object.assign(Promise.resolve(result), extra);
}

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: (args: any) => {
        state.calls.push({ op: 'signUp', email: args.email, meta: args.options?.data, password: args.password });
        return Promise.resolve(
          state.signUpError
            ? { data: { user: null }, error: { message: state.signUpError } }
            : { data: { user: { id: state.signUpUserId } }, error: null },
        );
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: any) => ({
          maybeSingle: () => {
            state.calls.push({ table, op: 'select', col, val });
            return Promise.resolve({ data: state.lookupProfile, error: null });
          },
        }),
      }),
      update: (payload: any) => ({
        eq: (col: string, val: any) => {
          state.calls.push({ table, op: 'update', payload, col, val });
          return thenable(state.error ? { error: { message: state.error } } : { error: null });
        },
      }),
      upsert: (payload: any) => {
        state.calls.push({ table, op: 'upsert', payload });
        return thenable(state.error ? { error: { message: state.error } } : { error: null });
      },
    }),
  },
}));

beforeEach(() => {
  state.calls = [];
  state.lookupProfile = null;
  state.error = null;
  state.signUpUserId = 'new-user-id';
  state.signUpError = null;
});

const hod = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1', email: 'asha@corp.com', full_name: 'Asha Rao', role: 'hod',
  department_id: 'd1', delegate_id: null, avatar_url: null, created_at: 'now', ...over,
});

/* ─── normalizeHodInput ─────────────────────────────────── */

describe('normalizeHodInput', () => {
  it('trims the name and lowercases + trims the email', () => {
    expect(normalizeHodInput({ fullName: '  Asha Rao ', email: '  Asha@Corp.COM ' }))
      .toEqual({ fullName: 'Asha Rao', email: 'asha@corp.com' });
  });

  it('collapses internal whitespace in the name', () => {
    expect(normalizeHodInput({ fullName: 'Asha    Rao', email: 'a@b.com' }).fullName).toBe('Asha Rao');
  });
});

/* ─── validateHod ───────────────────────────────────────── */

describe('validateHod', () => {
  it('returns null for a valid, unique HOD', () => {
    expect(validateHod({ fullName: 'Ravi Kumar', email: 'ravi@corp.com' }, [hod()])).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(validateHod({ fullName: '  ', email: 'ravi@corp.com' }, [])).toMatch(/name is required/i);
  });

  it('rejects an empty email', () => {
    expect(validateHod({ fullName: 'Ravi', email: '' }, [])).toMatch(/email is required/i);
  });

  it.each(['not-an-email', 'missing@domain', 'no-at-sign.com', 'a b@corp.com', '@corp.com'])(
    'rejects the malformed email %s',
    (bad) => {
      expect(validateHod({ fullName: 'Ravi', email: bad }, [])).toMatch(/valid email/i);
    },
  );

  it('rejects an email already used by an HOD of this department, case-insensitively', () => {
    const msg = validateHod({ fullName: 'Someone Else', email: 'ASHA@corp.com' }, [hod()]);
    expect(msg).toMatch(/already an? (HOD|approver)/i);
    expect(msg).toContain('Asha Rao');
  });

  it('ignores the HOD being edited via excludeId', () => {
    expect(validateHod({ fullName: 'Asha Rao', email: 'asha@corp.com' }, [hod()], 'p1')).toBeNull();
  });

  it('still rejects a clash with a different HOD when excludeId is given', () => {
    const existing = [hod(), hod({ id: 'p2', email: 'ravi@corp.com', full_name: 'Ravi Kumar' })];
    expect(validateHod({ fullName: 'Xavier Lee', email: 'ravi@corp.com' }, existing, 'p1')).toMatch(/already/i);
  });

  it('rejects a name containing digits', () => {
    expect(validateHod({ fullName: 'Bugfix Test 2', email: 'ravi@corp.com' }, [])).toMatch(/cannot contain/i);
  });

  it('rejects a name containing a script tag', () => {
    expect(validateHod({ fullName: '<script>', email: 'ravi@corp.com' }, [])).toMatch(/cannot contain/i);
  });

  it('rejects an email longer than 254 characters', () => {
    const long = `${'a'.repeat(250)}@b.com`;
    expect(validateHod({ fullName: 'Ravi Kumar', email: long }, [])).toMatch(/254 characters/i);
  });

  it.each(["O'Brien", 'Mary-Jane Watson', 'Dr. Rao'])(
    'accepts the real-world name %s',
    (name) => {
      expect(validateHod({ fullName: name, email: 'ravi@corp.com' }, [])).toBeNull();
    },
  );
});

/* ─── addHod ────────────────────────────────────────────── */

describe('addHod', () => {
  it('promotes an EXISTING profile found by email instead of creating a new account', async () => {
    state.lookupProfile = { id: 'p7' };
    const result = await addHod('d1', { fullName: 'Ravi Kumar', email: 'Ravi@Corp.com' });

    expect(result.created).toBe(false);
    // looked the user up by the normalized (lowercased) email
    expect(state.calls[0]).toEqual({ table: 'profiles', op: 'select', col: 'email', val: 'ravi@corp.com' });
    expect(state.calls[1]).toEqual({
      table: 'profiles',
      op: 'update',
      payload: { role: 'hod', department_id: 'd1', full_name: 'Ravi Kumar' },
      col: 'id',
      val: 'p7',
    });
    expect(state.calls.some((c) => c.op === 'signUp')).toBe(false);
  });

  it('invites a NEW user when no profile matches the email', async () => {
    state.lookupProfile = null;
    const result = await addHod('d1', { fullName: 'Ravi Kumar', email: 'ravi@corp.com' });

    expect(result.created).toBe(true);
    const signUp = state.calls.find((c) => c.op === 'signUp');
    expect(signUp).toBeDefined();
    expect(signUp.email).toBe('ravi@corp.com');
    expect(signUp.meta).toMatchObject({ full_name: 'Ravi Kumar' });
    // never ships a predictable password
    expect(typeof signUp.password).toBe('string');
    expect(signUp.password.length).toBeGreaterThanOrEqual(12);
  });

  // Must be an UPDATE, never an upsert: there is NO insert policy on profiles
  // (migration 013 drops "profiles: admin can insert"), so `INSERT .. ON CONFLICT`
  // would be refused by RLS. The handle_new_user trigger (migration 010) already
  // created the row inside the signUp transaction, so the row is there to update.
  it('updates the newly invited user\'s profile to HOD of the department', async () => {
    state.lookupProfile = null;
    await addHod('d1', { fullName: 'Ravi Kumar', email: 'ravi@corp.com' });

    expect(state.calls.some((c) => c.op === 'upsert')).toBe(false);

    const update = state.calls.find((c) => c.op === 'update');
    expect(update).toBeDefined();
    expect(update.table).toBe('profiles');
    expect(update.col).toBe('id');
    expect(update.val).toBe('new-user-id');
    expect(update.payload).toMatchObject({
      full_name: 'Ravi Kumar',
      role: 'hod',
      department_id: 'd1',
    });
  });

  it('throws when the invite fails', async () => {
    state.lookupProfile = null;
    state.signUpError = 'User already registered';
    await expect(addHod('d1', { fullName: 'R', email: 'r@corp.com' })).rejects.toThrow(/already registered/i);
  });

  it('shows a helpful message when signUp is rate-limited', async () => {
    state.lookupProfile = null;
    state.signUpError = 'Email rate limit exceeded';
    await expect(addHod('d1', { fullName: 'R', email: 'r@corp.com' })).rejects.toThrow(/rate-limited/i);
  });

  it('throws when promoting an existing profile fails', async () => {
    state.lookupProfile = { id: 'p7' };
    state.error = 'permission denied';
    await expect(addHod('d1', { fullName: 'R', email: 'r@corp.com' })).rejects.toThrow(/permission denied/);
  });
});

/* ─── updateHod ─────────────────────────────────────────── */

describe('updateHod', () => {
  it('updates the name and email of the profile, normalized', async () => {
    await updateHod('p1', { fullName: '  Asha  Rao ', email: ' ASHA@corp.com ' });
    expect(state.calls).toEqual([
      {
        table: 'profiles',
        op: 'update',
        payload: { full_name: 'Asha Rao', email: 'asha@corp.com' },
        col: 'id',
        val: 'p1',
      },
    ]);
  });

  it('throws when the update fails', async () => {
    state.error = 'permission denied';
    await expect(updateHod('p1', { fullName: 'A', email: 'a@b.com' })).rejects.toThrow(/permission denied/);
  });
});

/* ─── removeHod ─────────────────────────────────────────── */

describe('removeHod', () => {
  // It withdraws the DEPARTMENT and leaves the job title alone: 'staff' is an
  // approver role too, so the old rewrite withdrew nothing and erased the only
  // record of what the person actually is.
  it('clears the department and delegate WITHOUT rewriting the role', async () => {
    await removeHod('p1');
    expect(state.calls).toEqual([
      {
        table: 'profiles',
        op: 'update',
        payload: { department_id: null, delegate_id: null },
        col: 'id',
        val: 'p1',
      },
    ]);
  });

  it('throws when the detach fails', async () => {
    state.error = 'permission denied';
    await expect(removeHod('p1')).rejects.toThrow(/permission denied/);
  });
});
