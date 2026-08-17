// Regression guard for the admin KPI cards overflowing their own boxes
// (client report, 2026-08-17: "the numbers should properly appear within their
// respective divs").
//
// Six of these sit in one row on the admin Dashboard, and two of the six print
// a SENTENCE rather than a count — "Not measured" when no check-in was timed,
// "No ratings" when nobody has rated. Set at the display size a count is set
// in, and in a card whose text column had already lost 64px to the icon plate
// beside it, those two wrapped straight out through the border while the labels
// truncated to "Oversta…".
//
// The two structural fixes are what this file pins: the value's type size is
// DERIVED from the string, and nothing in the card truncates.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminKpiTile from '../../../src/components/AdminKpiTile';

const ICON = 'M12 6v12';

afterEach(cleanup);

// The label is the tile's only stable handle — AdminDashboard.test.tsx finds
// every figure through `getByText(label).closest('div')`, so that ancestor must
// stay the card root.
function tileOf(label: string): HTMLElement {
  return screen.getByText(label).closest('div')!;
}

describe('AdminKpiTile', () => {
  it('sets a count at the display size and a fallback sentence smaller', () => {
    render(<AdminKpiTile label="Visitors Today" value="2" icon={ICON} />);
    render(<AdminKpiTile label="Avg Check-in Time" value="Not measured" icon={ICON} />);

    expect(screen.getByText('2').className).toContain('text-[2rem]');
    expect(screen.getByText('Not measured').className).not.toContain('text-[2rem]');
  });

  it('sets a two-figure split between the two — it is still numerals', () => {
    render(<AdminKpiTile label="Pre-registered" value="2 / 0" icon={ICON} />);
    const value = screen.getByText('2 / 0').className;
    expect(value).toContain('text-[1.5rem]');
  });

  it('never truncates the label, the value or the caption', () => {
    render(
      <AdminKpiTile
        label="Guest Satisfaction"
        value="No ratings"
        icon={ICON}
        caption="No visitor has rated today"
      />,
    );
    const tile = tileOf('Guest Satisfaction');
    expect(tile.className).not.toContain('truncate');
    expect(tile.innerHTML).not.toContain('truncate');

    // Everything wraps instead, so a long string is fully readable rather than
    // clipped into something indistinguishable from a short one.
    for (const text of ['Guest Satisfaction', 'No ratings', 'No visitor has rated today']) {
      expect(screen.getByText(text).className).toContain('break-words');
    }
  });

  it('keeps the label, the value and the caption inside one card root', () => {
    render(
      <AdminKpiTile label="Overstays" value="0" icon={ICON} caption="Nobody is overdue" />,
    );
    const tile = tileOf('Overstays');
    expect(tile.textContent).toContain('0');
    expect(tile.textContent).toContain('Nobody is overdue');
  });

  it('sizes the loading em dash as a numeral, not as the value it is standing in for', () => {
    render(<AdminKpiTile label="Avg Check-in Time" value="Not measured" icon={ICON} loading />);
    expect(screen.queryByText('Not measured')).toBeNull();
    expect(screen.getByText('—').className).toContain('text-[2rem]');
  });

  it('carries no dark: navy override — one step resolves in both themes', () => {
    render(<AdminKpiTile label="Currently Inside" value="1" icon={ICON} caption="Live in facility" />);
    expect(tileOf('Currently Inside').innerHTML).not.toContain('dark:text-navy-');
  });
});
