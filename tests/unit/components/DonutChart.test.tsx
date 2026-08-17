import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DonutChart from '../../../src/components/charts/DonutChart';

afterEach(cleanup);

describe('DonutChart', () => {
  it('renders one legend row per positive slice, with its label and rounded percentage, and drops zero-valued slices', () => {
    render(
      <DonutChart
        slices={[
          { label: 'Meeting', value: 3 },
          { label: 'Delivery', value: 1 },
          { label: 'Interview', value: 0 },
        ]}
      />,
    );
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.queryByText('Interview')).toBeNull();
  });

  it('computes each percentage against the total of POSITIVE slices only, ignoring the zero-valued one', () => {
    // Total of positive slices is 3 + 1 = 4, not 3 + 1 + 0. If the zero slice
    // were counted the percentages would still add to 100 by coincidence here,
    // so the values themselves (75% / 25%) are the assertion that catches a
    // wrong denominator.
    render(
      <DonutChart
        slices={[
          { label: 'Meeting', value: 3 },
          { label: 'Delivery', value: 1 },
          { label: 'Interview', value: 0 },
        ]}
      />,
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('draws a single slice as a full ring — a circle, not a path', () => {
    // A 360° arc has identical start and end points, which SVG resolves as a
    // zero-length path: the one-purpose day would have rendered an empty card.
    const { container } = render(<DonutChart slices={[{ label: 'Only', value: 5 }]} />);
    expect(container.querySelector('circle')).not.toBeNull();
    expect(container.querySelector('path')).toBeNull();
  });

  it('draws multiple slices as paths, not a circle', () => {
    const { container } = render(
      <DonutChart slices={[{ label: 'A', value: 1 }, { label: 'B', value: 1 }]} />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('circle')).toBeNull();
  });

  it('renders the empty message when every slice is zero', () => {
    render(<DonutChart slices={[{ label: 'A', value: 0 }, { label: 'B', value: 0 }]} emptyMessage="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });

  it('renders the default empty message when no slices are given at all', () => {
    render(<DonutChart slices={[]} />);
    expect(screen.getByText('No data for this period')).toBeInTheDocument();
  });

  // REGRESSION GUARD (client report, 2026-08-17): the donut overflowed its
  // card. `flex-col sm:flex-row` asked the wrong question — this card is one
  // third of a three-column grid, so at a 1280px viewport (which IS `sm` and
  // up, so the row layout was in force) its inner width is ~270px and the
  // 176px donut plus the legend could not fit side by side. The fix wraps on
  // the CARD's own width (`flex-wrap`, no `sm:row` breakpoint) and lets the
  // legend drop under the donut whenever there is no room beside it.
  it('wraps on its own width rather than a viewport breakpoint, and lets the legend shrink', () => {
    const { container } = render(<DonutChart slices={[{ label: 'Meeting', value: 1 }]} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('flex-wrap');
    expect(root.className).not.toContain('sm:flex-row');

    const list = container.querySelector('ul') as HTMLElement;
    expect(list.className).toContain('min-w-0');
  });

  it('has an svg aria-label naming the total and the number of categories', () => {
    render(
      <DonutChart
        slices={[{ label: 'Meeting', value: 3 }, { label: 'Delivery', value: 1 }]}
        unit="arrivals"
      />,
    );
    expect(screen.getByRole('img', { name: 'Breakdown of 4 arrivals across 2 categories' })).toBeInTheDocument();
  });
});
