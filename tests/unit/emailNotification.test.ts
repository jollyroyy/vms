/**
 * M22-EMAIL: Email notification to host when visitor checks in.
 * Tests the email template generation logic (pure function, no network).
 */
import { describe, it, expect } from 'vitest';

// Helper function to build email content (will be extracted from edge function)
function buildCheckInEmail(params: {
  hostName: string;
  visitorName: string;
  visitorCompany: string | null;
  refNumber: string;
  purpose: string;
  checkedInAt: string;
}) {
  const { hostName, visitorName, visitorCompany, refNumber, purpose, checkedInAt } = params;
  const purposeLabel = purpose.charAt(0).toUpperCase() + purpose.slice(1);
  const timeStr = new Date(checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const subject = `Visitor arrived: ${visitorName} (${refNumber})`;
  const bodyText = [
    `Hi ${hostName},`,
    '',
    `Your visitor ${visitorName}${visitorCompany ? ` from ${visitorCompany}` : ''} has arrived at the gate and checked in.`,
    '',
    `Reference: ${refNumber}`,
    `Purpose: ${purposeLabel}`,
    `Check-in time: ${timeStr}`,
    '',
    'Please proceed to the reception area.',
    '',
    '-- SecureGate VMS',
  ].join('\n');

  return { subject, bodyText };
}

describe('M22-EMAIL: Check-in email builder', () => {
  it('generates correct subject with visitor name and ref number', () => {
    const { subject } = buildCheckInEmail({
      hostName: 'Priya Sharma',
      visitorName: 'Rohan Desai',
      visitorCompany: 'TechSoft Pvt Ltd',
      refNumber: 'VIS-20260721-0001',
      purpose: 'meeting',
      checkedInAt: '2026-07-21T10:30:00Z',
    });
    expect(subject).toBe('Visitor arrived: Rohan Desai (VIS-20260721-0001)');
  });

  it('includes visitor company in body when provided', () => {
    const { bodyText } = buildCheckInEmail({
      hostName: 'Priya Sharma',
      visitorName: 'Rohan Desai',
      visitorCompany: 'TechSoft Pvt Ltd',
      refNumber: 'VIS-20260721-0001',
      purpose: 'meeting',
      checkedInAt: '2026-07-21T10:30:00Z',
    });
    expect(bodyText).toContain('from TechSoft Pvt Ltd');
  });

  it('omits "from company" when company is null', () => {
    const { bodyText } = buildCheckInEmail({
      hostName: 'Priya Sharma',
      visitorName: 'Courier Guy',
      visitorCompany: null,
      refNumber: 'VIS-20260721-0002',
      purpose: 'delivery',
      checkedInAt: '2026-07-21T11:00:00Z',
    });
    expect(bodyText).not.toContain('from null');
    expect(bodyText).not.toContain('from undefined');
    expect(bodyText).toContain('Courier Guy has arrived');
  });

  it('capitalizes purpose in body', () => {
    const { bodyText } = buildCheckInEmail({
      hostName: 'Ravi Kumar',
      visitorName: 'Test User',
      visitorCompany: null,
      refNumber: 'VIS-20260721-0003',
      purpose: 'vendor',
      checkedInAt: '2026-07-21T09:00:00Z',
    });
    expect(bodyText).toContain('Purpose: Vendor');
  });

  it('includes ref number in body', () => {
    const { bodyText } = buildCheckInEmail({
      hostName: 'Anita Singh',
      visitorName: 'Bob Smith',
      visitorCompany: 'Acme Corp',
      refNumber: 'VIS-20260721-0042',
      purpose: 'audit',
      checkedInAt: '2026-07-21T14:00:00Z',
    });
    expect(bodyText).toContain('VIS-20260721-0042');
  });

  it('addresses host by name', () => {
    const { bodyText } = buildCheckInEmail({
      hostName: 'Meera Nair',
      visitorName: 'John Doe',
      visitorCompany: null,
      refNumber: 'VIS-20260721-0005',
      purpose: 'maintenance',
      checkedInAt: '2026-07-21T08:00:00Z',
    });
    expect(bodyText).toContain('Hi Meera Nair');
  });
});

// Export for potential reuse in edge function tests
export { buildCheckInEmail };
