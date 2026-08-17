import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import VisitorDetails from '../../../src/components/VisitorDetails';
import type { Visit } from '../../../src/types/index';

vi.mock('../../../src/lib/formatDate', () => ({
  formatDateTime: () => '30 Jul 2026, 10:00 AM',
  formatDuration: () => ({ text: '30m', isOvertime: false }),
  formatElapsed: () => ({ text: '30m', isOvertime: false }),
}));

const visit = {
  id: 'v1',
  ref_number: 'VIS-20260730-0001',
  status: 'approved',
  qr_token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  created_at: '2026-07-30T09:00:00Z',
  checked_in_at: null,
  checked_out_at: null,
  rejection_reason: null,
  carrying_material: false,
  purpose: 'meeting',
  visitor: { full_name: 'John Doe', phone: '9999999999', vendor_name: 'Acme Corp', id_type: null, id_last4: null },
  department: { name: 'Engineering' },
  host: { full_name: 'Jane Smith' },
} as unknown as Visit;

afterEach(() => cleanup());

describe('VisitorDetails — closing the popup', () => {
  it('exposes the corner cross as an accessible "Close" button', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClose when the corner cross is clicked', () => {
    const onClose = vi.fn();
    render(<VisitorDetails visit={visit} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ONE SURFACE, TOP TO BOTTOM (client report, 2026-08-15). The popup used to
  // open with a navy→brand gradient band plus a radial highlight behind the
  // visitor's name, and a white profile card lifted on top of it — three tones
  // stacked in the first 120px, which in dark mode read as a light patch on an
  // otherwise dark panel. Nothing above the tabs may paint its own background.
  it('paints no gradient band or tinted card behind the name', () => {
    const { container } = render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    const html = container.innerHTML;
    expect(html).not.toContain('bg-gradient-to-br');
    expect(html).not.toContain('radial-gradient');
    // The white lift behind the name is the other half of the same complaint.
    // Walked from the name upwards, so the tab bar's selected pill — a control
    // state, which must stay distinguishable — is out of scope.
    for (let el = screen.getByText('John Doe').parentElement; el; el = el.parentElement) {
      expect(el.className).not.toMatch(/(^|\s)bg-white(\s|$)/);
      expect(el.className).not.toContain('bg-gradient');
    }
  });

  // The cross sits in the header row's own reserved space rather than floating
  // over a banner, so nothing can grow underneath it — but it must still
  // out-rank whatever it shares that row with.
  it('keeps the close button clickable above the header row', () => {
    const onClose = vi.fn();
    render(<VisitorDetails visit={visit} onClose={onClose} />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.className).toContain('z-30');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<VisitorDetails visit={visit} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not when the panel is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<VisitorDetails visit={visit} onClose={onClose} />);
    fireEvent.click(container.querySelector('.modal-content')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// Which timestamps each viewer may see lives in VisitorDetailsTimeline.test.tsx
// — split out 2026-08-17 when the arrival/audit rules took this file past 300.

describe('VisitorDetails — reopening the entry pass', () => {
  afterEach(() => cleanup());

  it('offers a View Pass toggle for a pre-approved visit', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
  });

  it('reveals the QR pass on click and hides it again on a second click', async () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="hod" />);
    const toggle = screen.getByRole('button', { name: /view pass/i });

    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByAltText('Entry pass QR code')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /hide pass/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide pass/i }));
    expect(screen.queryByAltText('Entry pass QR code')).not.toBeInTheDocument();
  });

  // 2026-08-10 client report: the expanded pass re-showed the name, company
  // and ID the popup header and Details rows already display. The pass must
  // show the QR and timing only — each identity fact exactly once, from the
  // popup, not twice.
  it('expanded pass repeats none of the identity shown in the popup — no second name, vendor or ID', async () => {
    const withId = {
      ...visit,
      visitor: { ...visit.visitor, id_type: 'Aadhaar', id_last4: '9646' },
    } as unknown as Visit;
    render(<VisitorDetails visit={withId} onClose={vi.fn()} viewerRole="admin" />);

    fireEvent.click(screen.getByRole('button', { name: /view pass/i }));
    await waitFor(() => expect(screen.getByAltText('Entry pass QR code')).toBeInTheDocument());

    expect(screen.getAllByText('John Doe')).toHaveLength(1);
    expect(screen.getAllByText('Acme Corp')).toHaveLength(1);
    // The ID moved to its own tab (2026-08-15), so on the Overview tab it must
    // appear NOWHERE — including inside the pass, which is what
    // identityShownElsewhere strips.
    expect(screen.queryByText('Aadhaar ••••46')).not.toBeInTheDocument();
    // "Valid For" was one mislabelled row; the pass now shows two, Scheduled
    // At and Valid Until (2026-08-15 client report).
    expect(screen.getByText('Scheduled At')).toBeInTheDocument();
    expect(screen.getByText('Valid Until')).toBeInTheDocument();
  });

  it('offers a pass for a walk-in approval so the badge can still be printed', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'walkin_approved' }} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
  });

  // Previously the pass disappeared the moment the guard checked the visitor
  // in, which is precisely when a lost or unprinted badge needs reissuing.
  it('still offers the pass once the visitor has checked in', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'checked_in', checked_in_at: '2026-07-30T09:30:00Z' }} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
  });

  // viewerRole is stated on both of these so they keep testing the *status*
  // gate. Left off, they would pass because of the role gate instead and stop
  // covering what they were written for.
  it('does not offer a pass while the visit is still awaiting approval', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'pending_approval' }} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.queryByRole('button', { name: /view pass/i })).not.toBeInTheDocument();
  });

  it('does not offer a pass once the visit has ended', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'checked_out', checked_out_at: '2026-07-30T17:00:00Z' }} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.queryByRole('button', { name: /view pass/i })).not.toBeInTheDocument();
  });
});

// A pre-approval is final once the HOD has given it. There is no un-approving
// a visit from this popup, from the approved list, or from anywhere else in
// the HOD surface — a visitor told they are cleared must not be turned away by
// a decision reversed behind their back. See src/pages/HOD/useVisitDecisions.ts.
describe('VisitorDetails — an approval cannot be taken back', () => {
  afterEach(() => cleanup());

  it.each(['approved', 'walkin_approved'])(
    'offers no cancel action for a %s visit',
    (status) => {
      render(<VisitorDetails visit={{ ...visit, status } as unknown as Visit} onClose={vi.fn()} viewerRole="hod" />);
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    },
  );

  it('still offers Approve and Reject while the visit is pending', () => {
    render(
      <VisitorDetails
        visit={{ ...visit, status: 'pending_approval' } as unknown as Visit}
        onClose={vi.fn()} viewerRole="hod" reason="" onApprove={vi.fn()} onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
  });
});

// A guard must never be able to open, print or download an entry pass: that
// would let one be issued without the visitor ever being at the gate. The rest
// of the record stays readable — checking the person against it is the job.
describe('VisitorDetails — the pass is never shown to a guard', () => {
  afterEach(() => cleanup());

  it.each(['approved', 'walkin_approved', 'checked_in'])(
    'hides the View Pass toggle from a guard for a %s visit',
    (status) => {
      render(<VisitorDetails visit={{ ...visit, status } as unknown as Visit} onClose={vi.fn()} viewerRole="guard" />);
      expect(screen.queryByRole('button', { name: /view pass/i })).not.toBeInTheDocument();
    },
  );

  it('hides the QR and both downloads from a guard, not just the toggle', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.queryByAltText('Entry pass QR code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download png/i })).not.toBeInTheDocument();
  });

  // The point of the popup for a guard is confirming the person in front of
  // them against the record. Removing the pass must not remove that.
  it('still shows a guard the visitor details behind the pass', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('9999999999')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  // Fails closed: a caller that forgets viewerRole hides the pass.
  it('hides the pass when no viewer role is supplied at all', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /view pass/i })).not.toBeInTheDocument();
  });
});

// The host field's label reads "Person to Meet", and their department renders
// directly beneath their name rather than as its own separate row — folding
// it in avoids showing the same department value twice on one card.
describe('VisitorDetails — Person to Meet shows the host\'s department beneath their name', () => {
  afterEach(() => cleanup());

  it('labels the host field "Person to Meet" and shows their department under their name', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.getByText('Person to Meet')).toBeInTheDocument();
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
    const hostName = screen.getByText('Jane Smith');
    // The department line is the very next sibling under the host's name.
    expect(hostName.nextElementSibling?.textContent).toBe('Engineering');
  });

  it('does not render the department as its own separate field anymore', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.queryByText('Department')).not.toBeInTheDocument();
  });

  it('omits the department line when there is no host to show it under', () => {
    const noHost = { ...visit, host: undefined } as unknown as Visit;
    render(<VisitorDetails visit={noHost} onClose={vi.fn()} />);
    expect(screen.queryByText('Person to Meet')).not.toBeInTheDocument();
    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
  });
});
