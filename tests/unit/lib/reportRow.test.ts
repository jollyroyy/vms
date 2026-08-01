import { describe, it, expect } from 'vitest';
import { toReportRow, toReportRows } from '../../../src/lib/reportRow';
import type { Visit } from '../../../src/types/index';

function makeVisit(overrides: Partial<Visit> = {}): Visit {
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
    checked_in_at: '2026-08-01T14:30:00Z',
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    carrying_remarks: null,
    scheduled_for: '2026-08-01T10:00:00Z',
    qr_token: 'tok-secret-xyz',
    qr_expires_at: null,
    created_at: '2026-08-01T08:00:00Z',
    visitor: {
      id: 'visitor-1',
      phone: '9876543210',
      full_name: 'Asha Rao',
      company: 'Acme Co',
      id_type: 'Aadhaar',
      id_last4: '9646',
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

describe('reportRow', () => {
  describe('toReportRow', () => {
    it('includes exactly 14 keys in the correct order', () => {
      const row = toReportRow(makeVisit(), 0);
      const keys = Object.keys(row);
      expect(keys).toEqual([
        '#', 'Ref', 'Name', 'Company', 'Phone', 'Department', 'Host', 'ID Proof',
        'Purpose', 'Approved At', 'Checked In At', 'Checked Out At', 'Carrying', 'Status',
      ]);
    });

    it('formats # as 1-based index', () => {
      const row0 = toReportRow(makeVisit(), 0);
      const row2 = toReportRow(makeVisit(), 2);
      expect(row0['#']).toBe('1');
      expect(row2['#']).toBe('3');
    });

    it('includes ref_number in Ref field', () => {
      const row = toReportRow(makeVisit({ ref_number: 'VMS-2026-1234' }), 0);
      expect(row['Ref']).toBe('VMS-2026-1234');
    });

    it('masks phone number — raw phone does not appear in row values', () => {
      const row = toReportRow(makeVisit(), 0);
      const joined = Object.values(row).join('|');
      expect(joined).not.toContain('9876543210');
      expect(row['Phone']).toBe('••••••3210');
    });

    it('masks ID proof — raw ID last4 does not appear in row values', () => {
      const row = toReportRow(makeVisit(), 0);
      const joined = Object.values(row).join('|');
      expect(joined).not.toContain('9646');
      expect(row['ID Proof']).toBe('Aadhaar ••••46');
    });

    it('does not include photo_data in row keys or values', () => {
      const row = toReportRow(
        makeVisit({ photo_data: 'iVBORw0KGgoAAAANSUhEUgAAAAUA...' }),
        0,
      );
      expect(Object.keys(row)).not.toContain('photo_data');
      const joined = Object.keys(row).join('|') + Object.values(row).join('|');
      expect(joined).not.toContain('iVBORw0KGgo');
    });

    it('does not include qr_token in row keys or values', () => {
      const row = toReportRow(makeVisit({ qr_token: 'tok-secret-xyz' }), 0);
      expect(Object.keys(row)).not.toContain('qr_token');
      const joined = Object.values(row).join('|');
      expect(joined).not.toContain('tok-secret-xyz');
    });

    it('null checked_out_at formats to empty string', () => {
      const row = toReportRow(makeVisit({ checked_out_at: null }), 0);
      expect(row['Checked Out At']).toBe('');
    });

    it('unparseable timestamp formats to empty string, never "Invalid Date"', () => {
      const row = toReportRow(makeVisit({ checked_in_at: 'not-a-date' }), 0);
      expect(row['Checked In At']).toBe('');
      expect(row['Checked In At']).not.toMatch(/Invalid/);
    });

    it('formats valid timestamp to "en-IN" locale (date + time)', () => {
      const row = toReportRow(makeVisit({ checked_in_at: '2026-08-01T14:30:00Z' }), 0);
      expect(row['Checked In At']).toMatch(/\d+\/\d+\/\d+ \d+:\d+/);
    });

    it('Carrying shows remarks text when carrying_remarks is set', () => {
      const row = toReportRow(
        makeVisit({
          carrying_material: true,
          carrying_remarks: '  Laptop and documents  ',
        }),
        0,
      );
      expect(row['Carrying']).toBe('Laptop and documents');
    });

    it('Carrying shows "Yes (unspecified)" when carrying_material is true but remarks are null', () => {
      const row = toReportRow(
        makeVisit({
          carrying_material: true,
          carrying_remarks: null,
        }),
        0,
      );
      expect(row['Carrying']).toBe('Yes (unspecified)');
    });

    it('Carrying shows "Yes (unspecified)" when carrying_material is true but remarks are blank', () => {
      const row = toReportRow(
        makeVisit({
          carrying_material: true,
          carrying_remarks: '   ',
        }),
        0,
      );
      expect(row['Carrying']).toBe('Yes (unspecified)');
    });

    it('Carrying is empty string when carrying_material is false and no remarks', () => {
      const row = toReportRow(
        makeVisit({
          carrying_material: false,
          carrying_remarks: null,
        }),
        0,
      );
      expect(row['Carrying']).toBe('');
    });

    it('missing visitor join degrades Name to empty string', () => {
      const row = toReportRow(makeVisit({ visitor: undefined }), 0);
      expect(row['Name']).toBe('');
      expect(row['Name']).not.toMatch(/undefined/);
    });

    it('missing visitor join degrades Company to empty string', () => {
      const row = toReportRow(makeVisit({ visitor: undefined }), 0);
      expect(row['Company']).toBe('');
    });

    it('missing visitor join degrades Phone to redaction dash', () => {
      const row = toReportRow(makeVisit({ visitor: undefined }), 0);
      expect(row['Phone']).toBe('—');
    });

    it('missing visitor join degrades ID Proof to redaction dash', () => {
      const row = toReportRow(makeVisit({ visitor: undefined }), 0);
      expect(row['ID Proof']).toBe('—');
    });

    it('missing department join degrades Department to empty string', () => {
      const row = toReportRow(makeVisit({ department: undefined }), 0);
      expect(row['Department']).toBe('');
      expect(row['Department']).not.toMatch(/undefined/);
    });

    it('missing host join degrades Host to empty string', () => {
      const row = toReportRow(makeVisit({ host: undefined }), 0);
      expect(row['Host']).toBe('');
      expect(row['Host']).not.toMatch(/undefined/);
    });

    it('all values are strings, never null or undefined', () => {
      const row = toReportRow(
        makeVisit({ visitor: undefined, department: undefined, host: undefined }),
        0,
      );
      expect(Object.values(row).every((v) => typeof v === 'string')).toBe(true);
    });

    it('Status field uses visitStatusLabel', () => {
      const row = toReportRow(makeVisit({ status: 'checked_in' }), 0);
      expect(row['Status']).toBe('checked in');
    });
  });

  describe('toReportRows', () => {
    it('maps an array of Visits to an array of ReportRows', () => {
      const visits = [
        makeVisit({ ref_number: 'VMS-2026-0001' }),
        makeVisit({ ref_number: 'VMS-2026-0002' }),
        makeVisit({ ref_number: 'VMS-2026-0003' }),
      ];
      const rows = toReportRows(visits);
      expect(rows).toHaveLength(3);
      expect(rows[0]['Ref']).toBe('VMS-2026-0001');
      expect(rows[1]['Ref']).toBe('VMS-2026-0002');
      expect(rows[2]['Ref']).toBe('VMS-2026-0003');
    });

    it('numbers a 3-element array as 1, 2, 3', () => {
      const visits = [
        makeVisit(),
        makeVisit(),
        makeVisit(),
      ];
      const rows = toReportRows(visits);
      expect(rows[0]['#']).toBe('1');
      expect(rows[1]['#']).toBe('2');
      expect(rows[2]['#']).toBe('3');
    });

    it('maps empty array to empty array', () => {
      const rows = toReportRows([]);
      expect(rows).toEqual([]);
    });
  });
});
