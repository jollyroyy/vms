import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ReportsPrintHeader from '../../../src/pages/Shared/ReportsPrintHeader';

afterEach(() => {
  cleanup();
});

describe('M12-REPORTS: ReportsPrintHeader', () => {
  it('renders the report title heading', () => {
    render(<ReportsPrintHeader rangeLabel="2026-08-03" entryCount={0} />);
    expect(screen.getByRole('heading', { name: 'Visitor Register' })).toBeInTheDocument();
  });

  it('renders the entry count', () => {
    render(<ReportsPrintHeader rangeLabel="2026-08-03" entryCount={12} />);
    expect(screen.getByText('12 entries')).toBeInTheDocument();
  });

  it('renders a single entry in the singular', () => {
    render(<ReportsPrintHeader rangeLabel="2026-08-03" entryCount={1} />);
    expect(screen.getByText('1 entry')).toBeInTheDocument();
  });

  it('renders the range label as a sub-heading', () => {
    render(<ReportsPrintHeader rangeLabel="2026-07-27 to 2026-08-03" entryCount={3} />);
    expect(screen.getByText('2026-07-27 to 2026-08-03')).toBeInTheDocument();
  });

  it('gives the logo an alt attribute', () => {
    render(<ReportsPrintHeader rangeLabel="2026-08-03" entryCount={0} />);
    const logo = screen.getByAltText('Quest Mall');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/quest-mall-logo.jpg');
  });
});
