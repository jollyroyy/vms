import { describe, it, expect } from 'vitest';
import { ALL_LINKS, linksForRole } from '../../../src/components/layout/navLinks';

// The guard's Visitors group children, in the order lib/visitorSegments.ts
// declares them — a visitor's life at the gate: booked -> arrived -> waiting
// on a decision -> approved -> on site too long -> gone, with the landing
// page first and the registration form trailing.
const EXPECTED_VISITOR_CHILDREN = [
  { label: 'All Visitors', to: '/visitors' },
  { label: 'Expected', to: '/visitors/expected' },
  { label: 'Inside', to: '/visitors/inside' },
  { label: 'Pending Approval', to: '/visitors/pending' },
  { label: 'Approved Walk-ins', to: '/visitors/approved' },
  { label: 'Overstayed', to: '/visitors/overstayed' },
  { label: 'Checked Out', to: '/visitors/checked-out' },
  { label: 'Walk-in Register', to: '/visitors/walk-in' },
];

describe('navLinks: linksForRole', () => {
  // The guard nav shrank from four flat items to three: Walk-in Visitors and
  // Pre-Approvals were absorbed into the Visitors GROUP (see below).
  it('guard gets exactly 3 links, in order, with the exact labels, and no Search', () => {
    const links = linksForRole('guard');
    expect(links.map((l) => l.label)).toEqual([
      'Dashboard',
      'Scan Pass',
      'Visitors',
    ]);
    expect(links.map((l) => l.label)).not.toContain('Search');
  });

  it('guard Scan Pass link points to /guard/scan-pass and sits second', () => {
    const links = linksForRole('guard');
    const scan = links.find((l) => l.label === 'Scan Pass');
    expect(scan?.to).toBe('/guard/scan-pass');
    expect(links[1]?.label).toBe('Scan Pass');
  });

  // Walk-in Visitors and Pre-Approvals are gone as separate top-level items;
  // /visitors is now a GROUP whose children come from VISITOR_SEGMENTS, so the
  // nav can never offer a segment the page has no case for.
  it('guard Visitors link points to /visitors and carries the full segment list as children, in order', () => {
    const links = linksForRole('guard');
    const visitors = links.find((l) => l.label === 'Visitors');
    expect(visitors?.to).toBe('/visitors');
    expect(visitors?.children?.map((c) => ({ label: c.label, to: c.to }))).toEqual(
      EXPECTED_VISITOR_CHILDREN,
    );
  });

  // Staff land on a different component at this same route (VisitorsDashboard,
  // not the guard console) and never get the sub-nav.
  it('staff Visitors link carries no sub-nav children', () => {
    const links = linksForRole('staff');
    const visitors = links.find((l) => l.label === 'Visitors');
    expect(visitors?.to).toBe('/visitors');
    expect((visitors as any)?.children).toBeUndefined();
  });

  // Standing rule (see CLAUDE.md "Admin scope"): admin has no route to visitor
  // records. This is not incidental — do not let it silently regress.
  it('admin gets exactly Analytics, Reports and Settings — never a route to visitor records', () => {
    const links = linksForRole('admin');
    expect(links.map((l) => l.label)).toEqual(['Analytics', 'Reports', 'Settings']);
  });

  it('linksForRole(null) returns an empty array', () => {
    expect(linksForRole(null)).toEqual([]);
  });

  it('no link in ALL_LINKS has an empty roles array (a link nobody can see is dead config)', () => {
    for (const link of ALL_LINKS) {
      expect(link.roles.length, `${link.label} has an empty roles array`).toBeGreaterThan(0);
    }
  });

  it('hod gets Overview, Pre-Approvals, Analytics, Reports', () => {
    const links = linksForRole('hod');
    expect(links.map((l) => l.label)).toEqual(['Overview', 'Pre-Approvals', 'Analytics', 'Reports']);
  });

  it('staff gets Visitors, On-site, Reports', () => {
    const links = linksForRole('staff');
    expect(links.map((l) => l.label)).toEqual(['Visitors', 'On-site', 'Reports']);
  });

  // Daily Staff and Self-Service Kiosk are intentionally absent from every
  // role's nav — they remain routable (see roleRoutes.ts) but are not sidebar
  // entries for anyone, guard included (see CRITICAL DISTINCTION in
  // navLinks.tsx's own header comment).
  it('Daily Staff and Self-Service Kiosk never appear as sidebar links for any role', () => {
    const labels = ALL_LINKS.map((l) => l.label);
    expect(labels).not.toContain('Daily Staff');
    expect(labels).not.toContain('Self-Service Kiosk');
  });
});
