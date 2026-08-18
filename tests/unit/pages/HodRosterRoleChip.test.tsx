// A department's approver roster prints each person's OWN job title.
//
// Since 2026-08-18 a department is headed by whoever heads it: an `hod`, a
// `senior_manager` or a `staff` account, all three holding the HOD's
// permissions exactly (src/lib/hodRoles.ts, migration 100's `effective_role()`).
// One permission with three job titles is only legible if the screen says which
// — otherwise the one place an admin checks who is responsible for a department
// renders three different people identically.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import HodList from '../../../src/pages/Admin/HodList';
import HodDirectory from '../../../src/pages/Admin/HodDirectory';
import type { Department, Profile } from '../../../src/types/index';

afterEach(cleanup);

const person = (over: Partial<Profile>): Profile => ({
  id: 'p1',
  full_name: 'Asha Rao',
  email: 'asha@example.com',
  role: 'hod',
  department_id: 'd1',
  created_at: 'now',
  ...over,
} as Profile);

const dept: Department = { id: 'd1', name: 'Facilities', code: 'FAC' } as Department;

const noop = () => {};

function renderList(hods: Profile[]) {
  return render(
    <HodList
      departmentId="d1"
      departmentName="Facilities"
      hods={hods}
      slot={null}
      busy={false}
      onOpenAdd={noop}
      onOpenEdit={noop}
      onCancel={noop}
      onSubmit={noop}
      onRequestRemove={noop}
    />,
  );
}

describe('the approver roster names each person by their own role', () => {
  it('prints Senior Manager beside a senior manager who heads the department', () => {
    renderList([person({ id: 'p1', full_name: 'Asha Rao', role: 'senior_manager' })]);
    expect(screen.getByText('Senior Manager')).toBeTruthy();
    expect(screen.queryByText('HOD')).toBeNull();
  });

  it('tells three approvers of the same department apart', () => {
    renderList([
      person({ id: 'p1', full_name: 'Asha Rao', role: 'hod' }),
      person({ id: 'p2', full_name: 'Bala Iyer', role: 'senior_manager' }),
      person({ id: 'p3', full_name: 'Chetan Roy', role: 'staff' }),
    ]);
    expect(screen.getByText('HOD')).toBeTruthy();
    expect(screen.getByText('Senior Manager')).toBeTruthy();
    expect(screen.getByText('Staff')).toBeTruthy();
  });

  it('carries the same titles into the Heads of Department directory', () => {
    const hodsByDept = new Map<string, Profile[]>([
      ['d1', [person({ id: 'p2', full_name: 'Bala Iyer', role: 'staff' })]],
    ]);
    const { container } = render(
      <HodDirectory id="panel" departments={[dept]} hodsByDept={hodsByDept} />,
    );
    const card = container.querySelector('.card') as HTMLElement;
    expect(within(card).getByText('Bala Iyer')).toBeTruthy();
    expect(within(card).getByText('Staff')).toBeTruthy();
  });
});
