import { describe, it, expect } from 'vitest';
import { visitStatusLabel } from '../../../src/lib/visitStatusLabel';
import type { VisitActor } from '../../../src/lib/visitActors';

describe('visitStatusLabel', () => {
  it('returns "Pre-approved" for approved status', () => {
    const result = visitStatusLabel({ status: 'approved' });
    expect(result).toBe('Pre-approved');
  });

  it('returns "Walk-in approved by [name] ([role])" for walkin_approved with actor', () => {
    const actor: VisitActor = { name: 'Jane Doe', role: 'hod' };
    const result = visitStatusLabel({ status: 'walkin_approved', actor });
    expect(result).toBe('Walk-in approved by Jane Doe (Host)');
  });

  it('returns "Walk-in approved" for walkin_approved without actor', () => {
    const result = visitStatusLabel({ status: 'walkin_approved' });
    expect(result).toBe('Walk-in approved');
  });

  it('returns "Walk-in approved" for walkin_approved with actor undefined', () => {
    const result = visitStatusLabel({ status: 'walkin_approved', actor: undefined });
    expect(result).toBe('Walk-in approved');
  });

  it('returns "Rejected by [name] ([role])" for rejected with actor', () => {
    const actor: VisitActor = { name: 'John Smith', role: 'guard' };
    const result = visitStatusLabel({ status: 'rejected', actor });
    expect(result).toBe('Rejected by John Smith (Guard)');
  });

  it('returns "Rejected" for rejected without actor', () => {
    const result = visitStatusLabel({ status: 'rejected' });
    expect(result).toBe('Rejected');
  });

  it('returns "Rejected" for rejected with actor null', () => {
    const result = visitStatusLabel({ status: 'rejected', actor: null });
    expect(result).toBe('Rejected');
  });

  it('returns status with underscores replaced by spaces for checked_in', () => {
    const result = visitStatusLabel({ status: 'checked_in' });
    expect(result).toBe('checked in');
  });

  it('returns status with underscores replaced by spaces for checked_out', () => {
    const result = visitStatusLabel({ status: 'checked_out' });
    expect(result).toBe('checked out');
  });

  it('returns status with underscores replaced by spaces for pending_approval', () => {
    const result = visitStatusLabel({ status: 'pending_approval' });
    expect(result).toBe('pending approval');
  });

  it('returns status with underscores replaced by spaces for cancelled', () => {
    const result = visitStatusLabel({ status: 'cancelled' });
    expect(result).toBe('cancelled');
  });

  it('returns status with underscores replaced by spaces for no_show', () => {
    const result = visitStatusLabel({ status: 'no_show' });
    expect(result).toBe('no show');
  });

  it('maps guard role to "Guard"', () => {
    const actor: VisitActor = { name: 'Alice', role: 'guard' };
    const result = visitStatusLabel({ status: 'rejected', actor });
    expect(result).toContain('(Guard)');
  });

  it('maps hod role to "Host"', () => {
    const actor: VisitActor = { name: 'Bob', role: 'hod' };
    const result = visitStatusLabel({ status: 'walkin_approved', actor });
    expect(result).toContain('(Host)');
  });

  it('maps admin role to "Admin"', () => {
    const actor: VisitActor = { name: 'Charlie', role: 'admin' };
    const result = visitStatusLabel({ status: 'rejected', actor });
    expect(result).toContain('(Admin)');
  });

  it('maps super_admin role to "Admin"', () => {
    const actor: VisitActor = { name: 'Dave', role: 'super_admin' };
    const result = visitStatusLabel({ status: 'walkin_approved', actor });
    expect(result).toContain('(Admin)');
  });

  it('maps staff role to "Staff"', () => {
    const actor: VisitActor = { name: 'Eve', role: 'staff' };
    const result = visitStatusLabel({ status: 'rejected', actor });
    expect(result).toContain('(Staff)');
  });

  it('falls back to raw role string for unrecognized role', () => {
    const actor: VisitActor = { name: 'Frank', role: 'delegate' };
    const result = visitStatusLabel({ status: 'walkin_approved', actor });
    expect(result).toBe('Walk-in approved by Frank (delegate)');
  });
});
