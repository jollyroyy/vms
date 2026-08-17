import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AdminRangeBar from '../../../src/pages/Admin/AdminRangeBar';
import AdminPageHeader from '../../../src/pages/Admin/AdminPageHeader';

// The date-range control shared by every historical admin tab, and the
// live/historical chip beside every admin title (client instruction,
// 2026-08-17). Both exist to answer one question a table of visits cannot
// answer on its own face — WHICH PERIOD AM I LOOKING AT — so the tests here are
// about what the reader is told, not about how it is laid out.

afterEach(cleanup);

function renderBar(over: Partial<React.ComponentProps<typeof AdminRangeBar>> = {}) {
  const onPresetChange = vi.fn();
  const onEndDateChange = vi.fn();
  render(
    <AdminRangeBar
      preset="30d"
      endDate="2026-08-17"
      today="2026-08-17"
      onPresetChange={onPresetChange}
      onEndDateChange={onEndDateChange}
      noun="visits"
      {...over}
    />,
  );
  return { onPresetChange, onEndDateChange };
}

describe('AdminRangeBar', () => {
  // The six the client asked for: date-wise, plus 7 / 30 / 60 / 90 days and a
  // year. They come from RANGE_PRESETS, so a tab cannot quietly offer its own.
  it('offers every preset in the shared vocabulary', () => {
    renderBar();
    for (const label of ['Selected Day', 'Last 7 Days', 'Last 30 Days',
      'Last 60 Days', 'Last 90 Days', 'Last 1 Year']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks only the active preset as pressed', () => {
    renderBar({ preset: '90d' });
    expect(screen.getByRole('button', { name: 'Last 90 Days' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Last 30 Days' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports a preset choice rather than holding a range of its own', () => {
    const { onPresetChange } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Last 60 Days' }));
    expect(onPresetChange).toHaveBeenCalledWith('60d');
  });

  // WHICH BUTTON IS LIT AND WHAT PERIOD YOU GOT ARE DIFFERENT FACTS. A "Last 90
  // Days" pill says nothing about whether the visit an admin is hunting for
  // falls inside the window, so the resolved dates are printed too.
  it('prints the resolved period, not just the preset name', () => {
    renderBar({ preset: '7d', endDate: '2026-08-17' });
    expect(screen.getByText(/11 Aug 2026/)).toBeInTheDocument();
    expect(screen.getByText(/17 Aug 2026/)).toBeInTheDocument();
  });

  it('names what is being ranged so the period reads as a statement', () => {
    renderBar({ noun: 'badge prints' });
    expect(screen.getByText(/Showing badge prints from/)).toBeInTheDocument();
  });

  // A window whose end is in the future would report an empty tail as "no
  // visits", which is a different claim from "not yet".
  it('will not let the end date be set past today', () => {
    renderBar({ today: '2026-08-17' });
    expect(screen.getByLabelText('Up to')).toHaveAttribute('max', '2026-08-17');
  });

  it('reports an end-date change', () => {
    const { onEndDateChange } = renderBar();
    fireEvent.change(screen.getByLabelText('Up to'), { target: { value: '2026-08-01' } });
    expect(onEndDateChange).toHaveBeenCalledWith('2026-08-01');
  });
});

describe('AdminPageHeader scope chip', () => {
  it('says Live for a tab describing the day running now', () => {
    render(<AdminPageHeader title="Live Check-In" scope="live" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Historical')).toBeNull();
  });

  it('says Historical for a tab describing a period that has ended', () => {
    render(<AdminPageHeader title="Visitors Log" scope="historical" />);
    expect(screen.getByText('Historical')).toBeInTheDocument();
    expect(screen.queryByText('Live')).toBeNull();
  });

  // The chip is opt-in: a tab that is neither (Settings, Hosts before its
  // window was named) must not be labelled with a guess.
  it('renders no chip when the tab declares no scope', () => {
    render(<AdminPageHeader title="Settings" />);
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByText('Historical')).toBeNull();
  });
});
