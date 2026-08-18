// The red line at the top of the guard, admin and HOD boards (client
// instruction, 2026-08-18: "apart from showing in the overstaying field, flag
// it in red on the top … if a particular visitor is overstaying for a long
// time").
//
// The rule under test is not the colour — it is that this banner and the
// Overstaying TILE are one answer. It runs `isOverstaying` over whatever list
// the board already loaded, so a banner that named somebody the tile did not
// count would be the two-sources-for-one-count defect, on the one figure that
// is about a person still being in the building.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import OverstayAlertBanner from '../../../src/components/OverstayAlertBanner';
import { isOverstaying } from '../../../src/lib/visitExpiry';
import type { Visit } from '../../../src/types/index';

const NOW = new Date('2026-08-18T12:00:00Z');

function visit(over: Partial<Visit> & { id: string }): Visit {
  return {
    id: over.id,
    ref_number: `VIS-20260818-${over.id}`,
    visitor_id: `vis-${over.id}`,
    department_id: 'dept1',
    host_id: 'h1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'checked_in',
    checked_in_at: null,
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: null,
    created_at: '2026-08-18T01:00:00Z',
    ...over,
  } as Visit;
}

const named = (id: string, name: string, checkedInAt: string, host?: string) =>
  visit({
    id,
    checked_in_at: checkedInAt,
    visitor: { full_name: name } as Visit['visitor'],
    host: host ? ({ id: 'h1', full_name: host } as Visit['host']) : undefined,
  });

afterEach(cleanup);

describe('OverstayAlertBanner', () => {
  it('renders nothing when nobody is overdue', () => {
    // Two hours inside, well under the twelve-hour default.
    const { container } = render(
      <OverstayAlertBanner visits={[named('1', 'Alice', '2026-08-18T10:00:00Z')]} now={NOW} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('names the overdue visitor, the overrun and the host', () => {
    render(<OverstayAlertBanner visits={[named('1', 'Alice', '2026-08-17T21:30:00Z', 'Jane Smith')]} now={NOW} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('1 visitor is overstaying')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/over by 2h 30m/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  // Colour is never the only carrier of status: the count, each name and the
  // overrun are all text, and the box is an alert.
  it('says what it means in words, not only in red', () => {
    render(<OverstayAlertBanner visits={[named('1', 'Alice', '2026-08-17T20:00:00Z')]} now={NOW} />);
    expect(screen.getByRole('alert').textContent).toMatch(/overstaying/i);
  });

  it('counts every overdue visitor and lists the worst first', () => {
    const rows = [
      named('1', 'Alice', '2026-08-17T22:00:00Z'), // 2h over
      named('2', 'Bob', '2026-08-17T18:00:00Z'),   // 6h over
      named('3', 'Cara', '2026-08-18T11:00:00Z'),  // not over
    ];
    render(<OverstayAlertBanner visits={rows} now={NOW} />);
    expect(screen.getByText('2 visitors are overstaying')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items[0]).toContain('Bob');
    expect(items[1]).toContain('Alice');
    expect(screen.queryByText('Cara')).not.toBeInTheDocument();
  });

  it('trims the least urgent rows and says how many it kept back', () => {
    const rows = ['1', '2', '3', '4', '5'].map((id, i) =>
      named(id, `V${id}`, new Date(NOW.getTime() - (13 + i) * 3_600_000).toISOString()),
    );
    render(<OverstayAlertBanner visits={rows} now={NOW} max={2} />);
    expect(screen.getByText(/and 3 more/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  // A visitor who has LEFT is not overstaying, whatever their stay looked like.
  it('ignores anyone who is no longer inside', () => {
    const gone = visit({
      id: '9',
      status: 'checked_out',
      checked_in_at: '2026-08-17T06:00:00Z',
      checked_out_at: '2026-08-18T09:00:00Z',
      visitor: { full_name: 'Departed' } as Visit['visitor'],
    });
    const { container } = render(<OverstayAlertBanner visits={[gone]} now={NOW} />);
    expect(container.innerHTML).toBe('');
  });

  // The approver's own deadline beats the twelve-hour fallback, in the banner
  // exactly as in the tile — one `overstayDeadline`, never two.
  it('honours expected_departure', () => {
    const booked = visit({
      id: '7',
      checked_in_at: '2026-08-18T08:00:00Z',
      expected_departure: '2026-08-18T09:00:00Z',
      visitor: { full_name: 'Contractor' } as Visit['visitor'],
    });
    render(<OverstayAlertBanner visits={[booked]} now={NOW} />);
    expect(screen.getByText(/over by 3h 0m/)).toBeInTheDocument();
  });

  it('flags exactly the rows the Overstaying tile counts', () => {
    const rows = [
      named('1', 'Alice', '2026-08-17T22:00:00Z'),
      named('2', 'Bob', '2026-08-18T11:00:00Z'),
      named('3', 'Cara', '2026-08-17T02:00:00Z'),
    ];
    const byPredicate = rows.filter((v) => isOverstaying(v, NOW));
    render(<OverstayAlertBanner visits={rows} now={NOW} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(byPredicate.length);
  });
});
