import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from '../../../src/pages/NotFound';

afterEach(cleanup);

describe('M12-NOTFOUND: NotFoundPage', () => {
  it('renders 404 heading', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders "Page not found" message', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders link to dashboard', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    const link = screen.getByText('Go to dashboard');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/');
  });
});
