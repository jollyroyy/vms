import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ReportsDeptFilter from '../../../src/pages/Shared/ReportsDeptFilter';
import type { DeptOption } from '../../../src/lib/reportsDeptFilter';

const opts = (n: number): DeptOption[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `d${i}`,
    name: `Department ${i}`,
    code: null,
    count: i + 1,
  }));

function renderFilter(overrides: Partial<React.ComponentProps<typeof ReportsDeptFilter>> = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  const props = {
    options: opts(3),
    value: 'all',
    total: 42,
    ...overrides,
    onChange,
  };
  const utils = render(<ReportsDeptFilter {...props} />);
  return { ...utils, onChange };
}

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Filter by department' }));
}

describe('ReportsDeptFilter', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders "All Departments" and the total count when value is all', () => {
    renderFilter({ total: 42 });
    expect(screen.getByText('All Departments')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('panel is closed initially, so department names are not in the document', () => {
    renderFilter({ options: opts(3) });
    expect(screen.queryByText('Department 0')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clicking the trigger opens the listbox and lists every option name and count', () => {
    renderFilter({ options: opts(3) });
    openPanel();
    expect(screen.getByRole('listbox')).toBeTruthy();
    for (let i = 0; i < 3; i++) {
      expect(screen.getByText(`Department ${i}`)).toBeTruthy();
      expect(screen.getByText(String(i + 1))).toBeTruthy();
    }
  });

  it('clicking an option calls onChange with that department id and closes the panel', () => {
    const { onChange } = renderFilter({ options: opts(3) });
    openPanel();
    fireEvent.click(screen.getByText('Department 1'));
    expect(onChange).toHaveBeenCalledWith('d1');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('when value is a department id, the trigger shows that department name and its own count', () => {
    renderFilter({ options: opts(3), value: 'd1', total: 42 });
    expect(screen.getByText('Department 1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('42')).toBeNull();
  });

  it('shows a Clear department filter button only when a department is selected, and clears on click', () => {
    const { onChange, rerender } = renderFilter({ options: opts(3), value: 'all' });
    expect(screen.queryByRole('button', { name: 'Clear department filter' })).toBeNull();

    rerender(<ReportsDeptFilter options={opts(3)} value="d0" total={42} onChange={onChange} />);
    const clearBtn = screen.getByRole('button', { name: 'Clear department filter' });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('marks the currently selected option aria-selected true and others false', () => {
    renderFilter({ options: opts(3), value: 'd1' });
    openPanel();
    const options = screen.getAllByRole('option');
    const selected = options.find((o) => o.textContent?.includes('Department 1'));
    const others = options.filter((o) => o !== selected);
    expect(selected?.getAttribute('aria-selected')).toBe('true');
    others.forEach((o) => expect(o.getAttribute('aria-selected')).toBe('false'));
  });

  it('closes the panel on Escape', () => {
    renderFilter({ options: opts(3) });
    openPanel();
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not render a search box with 3 options', () => {
    renderFilter({ options: opts(3) });
    openPanel();
    expect(screen.queryByLabelText('Search departments')).toBeNull();
  });

  it('renders a search box with 6+ options, narrows by name, and shows a no-match message', () => {
    renderFilter({ options: opts(6) });
    openPanel();
    const search = screen.getByLabelText('Search departments');
    expect(search).toBeTruthy();

    fireEvent.change(search, { target: { value: 'Department 3' } });
    expect(screen.getByText('Department 3')).toBeTruthy();
    expect(screen.queryByText('Department 0')).toBeNull();

    fireEvent.change(search, { target: { value: 'nope' } });
    expect(screen.getByText('No department matches “nope”')).toBeTruthy();
  });

  it('with zero options, opening the panel still offers All Departments and shows the empty message', () => {
    renderFilter({ options: [] });
    openPanel();
    expect(screen.getAllByText('All Departments').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: /All Departments/ })).toBeTruthy();
    expect(screen.getByText('No departments in this range')).toBeTruthy();
  });

  it('carries a z-50 stacking class on its root so the panel clears backdrop-filter register cards', () => {
    const { container } = renderFilter({ options: opts(3) });
    expect(container.firstElementChild?.className).toContain('z-50');
  });
});
