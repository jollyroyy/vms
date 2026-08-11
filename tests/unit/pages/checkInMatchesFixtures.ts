// Shared row builders for checkInMatches.test.ts and checkInMatchesFilters.test.ts.
// Not a *.test.ts file itself — vitest only collects files matching its test glob,
// so this stays a plain helper module.
import type { PreApprovedVisit, RecurringWithDept } from '../../../src/pages/Guard/checkInMatches';
import { istDayStart } from '../../../src/lib/visitExpiry';

// Anchored to the moment the suite runs rather than a fixed literal, so the
// default row is always "due today" under buildMatchItems' real default
// `now = new Date()` — callers that need a specific day (e.g. testing the
// due-today/omitted-when-not-searching rule) override scheduled_for AND pass
// an explicit `now` that agrees with it.
//
// Anchored to the IST day, NOT the UTC one. `d.setUTCHours(10)` looks
// equivalent and is not: between 18:30 and 24:00 UTC (00:00-05:30 IST) the UTC
// date is still yesterday in IST terms, so the row landed BEFORE
// istDayStart(now), isVisitExpired fired, and every fixture silently stopped
// being due today. That is the same UTC-vs-IST boundary bug documented all over
// lib/visitExpiry.ts — a suite that passes all day and fails after 00:00 IST.
// Midday IST is far from either edge.
export function todayIso(hoursIntoIstDay = 12): string {
  return new Date(istDayStart(new Date()).getTime() + hoursIntoIstDay * 3_600_000).toISOString();
}

export function makeVisit(overrides: Partial<PreApprovedVisit> = {}): PreApprovedVisit {
  return {
    id: 'visit-1',
    ref_number: 'VMS-2026-0001',
    visitor_id: 'visitor-1',
    department_id: 'dept-1',
    host_id: 'host-1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'approved',
    checked_in_at: null,
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: todayIso(),
    qr_token: 'tok-1',
    qr_expires_at: null,
    created_at: '2026-08-01T08:00:00Z',
    visitor: {
      id: 'visitor-1',
      phone: '9876543210',
      full_name: 'Asha Rao',
      vendor_name: 'Acme Co',
      id_type: null,
      id_last4: null,
      vehicle_number: null,
      is_blacklisted: false,
      blacklist_reason: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    department: { id: 'dept-1', name: 'Finance', code: 'FIN', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'host-1', full_name: 'Ravi Kumar' },
    ...overrides,
  };
}

export function makeRecurring(overrides: Partial<RecurringWithDept> = {}): RecurringWithDept {
  return {
    id: 'rec-1',
    department_id: 'dept-1',
    host_id: 'host-1',
    created_by: 'user-1',
    visitor_name: 'Priya Singh',
    visitor_phone: '8765432109',
    visitor_vendor_name: 'Beta Ltd',
    purpose: 'vendor',
    recurrence_type: 'weekly',
    recurrence_day: 3,
    start_date: '2026-01-01',
    end_date: null,
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    department: { id: 'dept-1', name: 'Finance', code: 'FIN', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'host-1', full_name: 'Ravi Kumar' },
    ...overrides,
  };
}
