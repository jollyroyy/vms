import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import UtilizationRows from '../../../src/components/charts/UtilizationRows';

afterEach(cleanup);

const ROWS = [
  { label: 'Asha Rao', value: 6 },
  { label: 'Ben Iyer', value: 2 },
];

describe('UtilizationRows', () => {
  it('renders all three headers and one row per entry with its label and value', () => {
    render(<UtilizationRows rows={ROWS} headers={['Host', 'Share', 'Visitors']} emptyMessage="none" />);
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Ben Iyer')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders no middle column when only two headers are given', () => {
    render(<UtilizationRows rows={ROWS} headers={['Host', 'Visitors']} emptyMessage="none" />);
    expect(screen.queryByText('Share')).toBeNull();
  });

  it('shows share as a percentage of the TOTAL while scaling the bar to the LARGEST row — two different questions, both answered', () => {
    const { container } = render(
      <UtilizationRows rows={ROWS} headers={['Host', 'Share', 'Visitors']} showShare emptyMessage="none" />,
    );
    // Share: 6/(6+2) = 75%, 2/8 = 25%.
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    // Bar width: scaled against the peak row (6), not the total (8) — the
    // larger row is a full-width bar, not 75%.
    const bars = container.querySelectorAll('li span[style*="width"]');
    expect((bars[0] as HTMLElement).style.width).toBe('100%');
    expect((bars[1] as HTMLElement).style.width).toBe(`${(2 / 6) * 100}%`);
  });

  it('renders the empty message for an empty list', () => {
    render(<UtilizationRows rows={[]} headers={['A', 'B']} emptyMessage="Nobody to rank" />);
    expect(screen.getByText('Nobody to rank')).toBeInTheDocument();
  });

  // REGRESSION GUARD (client report, 2026-08-17): "Top Hosts Today" headings
  // were invisible and overlapping. `flex-1 + w-40 + w-24` was 280px of FIXED
  // width inside a card that is one third of a three-column grid — about
  // 270px of inner width — so the label column was squeezed to nothing and the
  // row overflowed. The proportional flex-[2]/flex-1/w-16 split cannot overflow
  // at any width because every column shrinks with the card. The per-row unit
  // word ("3 visitors") also duplicated the column header and was itself part
  // of what overflowed the fixed count cell, so it moved to the cell's
  // aria-label instead of its visible text.
  it('prints the bare number in the count cell, with the unit only in its aria-label, and carries no fixed-width column classes', () => {
    const { container } = render(
      <UtilizationRows rows={[{ label: 'Asha Rao', value: 3 }]} headers={['Host', 'Share', 'Visitors']}
                       unit="visitors" emptyMessage="none" />,
    );
    expect(screen.queryByText('3 visitors')).toBeNull();
    expect(screen.getByLabelText('3 visitors')).toBeInTheDocument();
    expect(screen.getByLabelText('3 visitors').textContent).toBe('3');

    expect(container.querySelector('.w-40')).toBeNull();
    expect(container.querySelector('.w-24')).toBeNull();
  });
});
