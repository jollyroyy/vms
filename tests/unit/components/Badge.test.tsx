import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Badge from '../../../src/components/Badge';
import type { Visit } from '../../../src/types/index';

afterEach(cleanup);

const baseVisit: Visit = {
  id: 'v1',
  ref_number: 'VIS-20260720-0001',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'checked_in',
  checked_in_at: '2026-07-20T10:00:00Z',
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  expected_duration_minutes: 90,
  consent_privacy: true,
  consent_site_rules: true,
  nda_signature: null,
  privacy_signature: null,
  site_rules_signature: null,
  created_at: '2026-07-20T09:00:00Z',
  visitor: { id: 'vis1', phone: '9876543210', full_name: 'Rohan Desai', company: 'TechSoft Pvt Ltd', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z' },
  department: { id: 'dept1', name: 'Information Technology', code: 'IT', created_at: '2026-01-01T00:00:00Z' },
  host: { id: 'h1', full_name: 'Priya Sharma' },
  photo_url: null,
};

describe('M11-BADGE: Badge component', () => {
  it('renders visitor name and ref number', () => {
    render(<Badge visit={baseVisit} />);
    expect(screen.getByText('Rohan Desai')).toBeInTheDocument();
    expect(screen.getByText('VIS-20260720-0001')).toBeInTheDocument();
  });

  it('renders department name and host name', () => {
    render(<Badge visit={baseVisit} />);
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  });

  it('renders status text', () => {
    render(<Badge visit={baseVisit} />);
    expect(screen.getByText('checked in')).toBeInTheDocument();
  });

  it('renders company name', () => {
    render(<Badge visit={baseVisit} />);
    expect(screen.getByText('TechSoft Pvt Ltd')).toBeInTheDocument();
  });

  it('renders fallback placeholder when no photo', () => {
    render(<Badge visit={baseVisit} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders date in Indian locale format', () => {
    render(<Badge visit={baseVisit} />);
    expect(screen.getByText(/20\/7\/2026/)).toBeInTheDocument();
  });

  it('handles null visitor gracefully', () => {
    const noVisitor = { ...baseVisit, visitor: undefined };
    render(<Badge visit={noVisitor as any} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('handles null department gracefully', () => {
    const noDept = { ...baseVisit, department: undefined };
    render(<Badge visit={noDept as any} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  // NEW TESTS - Purpose display
  it('renders purpose label capitalized', () => {
    render(<Badge visit={baseVisit} />);
    expect(screen.getByText('Meeting')).toBeInTheDocument();
  });

  it('renders vendor purpose correctly', () => {
    render(<Badge visit={{ ...baseVisit, purpose: 'vendor' }} />);
    expect(screen.getByText('Vendor')).toBeInTheDocument();
  });

  // NEW TESTS - Expected duration display
  it('renders 90 minutes as "1h 30m"', () => {
    render(<Badge visit={{ ...baseVisit, expected_duration_minutes: 90 }} />);
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('renders 60 minutes as "1 hour"', () => {
    render(<Badge visit={{ ...baseVisit, expected_duration_minutes: 60 }} />);
    expect(screen.getByText('1 hour')).toBeInTheDocument();
  });

  it('renders 30 minutes as "30 min"', () => {
    render(<Badge visit={{ ...baseVisit, expected_duration_minutes: 30 }} />);
    expect(screen.getByText('30 min')).toBeInTheDocument();
  });

  it('renders null duration as "Not specified"', () => {
    render(<Badge visit={{ ...baseVisit, expected_duration_minutes: null }} />);
    expect(screen.getByText('Not specified')).toBeInTheDocument();
  });

  it('renders 120 minutes as "2 hours"', () => {
    render(<Badge visit={{ ...baseVisit, expected_duration_minutes: 120 }} />);
    expect(screen.getByText('2 hours')).toBeInTheDocument();
  });
});
