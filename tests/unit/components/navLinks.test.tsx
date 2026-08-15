import { describe, it, expect } from 'vitest';
import { ALL_LINKS, linksForRole } from '../../../src/components/layout/navLinks';

describe('navLinks: linksForRole', () => {
  // The three-tab guard console from the approved reference design
  // (Dashboard, Entry & Exit, Pre-Registered), then Scan Pass and the
  // consolidated Visitors lane. Client instruction 2026-08-14 — no Search, no
  // group button, no vehicle entries anywhere. The Watchlist tab was deleted
  // 2026-08-15 (client instruction); the blacklist gate lives inside check-in.
  // Five since 2026-08-15 (client instruction): Register Walk-in got its own
  // destination — the form was a `+` button buried in the Visitors tab — and
  // the Visitors tab itself went, every card it carried having moved onto the
  // dashboard. The ROUTE stays allowed, like /kiosk; it is the nav item that
  // was removed.
  it('guard gets exactly 5 links, in order, with the exact labels, and no Visitors or Search', () => {
    const links = linksForRole('guard');
    expect(links.map((l) => l.label)).toEqual([
      'Dashboard',
      'Entry & Exit',
      'Pre-Registered',
      'Scan Pass',
      'Register Walk-in',
    ]);
    expect(links.map((l) => l.label)).not.toContain('Visitors');
    expect(links.map((l) => l.label)).not.toContain('Search');
    expect(links.map((l) => l.label)).not.toContain('Vehicles');
    expect(links.map((l) => l.label)).not.toContain('Watchlist');
  });

  it('guard tab links point at the reference-screen routes, in reference order', () => {
    const links = linksForRole('guard');
    expect(links[0]?.to).toBe('/guard/dashboard');
    expect(links[1]?.to).toBe('/guard/inside-now');
    expect(links[2]?.to).toBe('/guard/preregistered');
    expect(links[3]?.to).toBe('/guard/scan-pass');
    expect(links[4]?.to).toBe('/guard/walk-in');
  });

  it('guard Scan Pass link points to /guard/scan-pass and sits fourth', () => {
    const links = linksForRole('guard');
    const scan = links.find((l) => l.label === 'Scan Pass');
    expect(scan?.to).toBe('/guard/scan-pass');
    expect(links[3]?.label).toBe('Scan Pass');
  });

  // No link anywhere is a group (SidebarNavGroup.tsx was deleted 2026-08-13):
  // the segments that used to expand under Visitors — All Visitors, Expected,
  // Inside, … — live on the page as KPI tiles (VisitorKpiRail), counted from
  // the page's own data. The sidebar naming them was the old answer to "where
  // can I go"; the page carrying the counts and the filters is the same
  // answer one click closer. This asserts the rule everywhere, not just on
  // the one link that used to carry it.
  it('no link in ALL_LINKS has sub-nav children — there are no nav groups', () => {
    for (const link of ALL_LINKS) {
      expect((link as any).children, `${link.label} has children`).toBeUndefined();
    }
  });

  // The guard's Visitors nav item was removed outright 2026-08-15 (client
  // instruction): every card it carried moved onto the dashboard — All
  // Visitors, Pending Approval and Approved Walk-ins are KPI tiles in row 2
  // (src/lib/guardTiles.ts) — and the Walk-in Register became its own
  // destination, Register Walk-in. The ROUTE /visitors stays allowed in
  // ROLE_ROUTES.guard (same precedent as /kiosk and /guard/search); only the
  // nav item is gone.
  it('guard has no /visitors nav link', () => {
    const links = linksForRole('guard');
    expect(links.find((l) => l.to === '/visitors')).toBeUndefined();
    expect(links.find((l) => l.label === 'Visitors')).toBeUndefined();
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

  // Analytics went 2026-08-15 (admin-only now), and the HOD console's own tab
  // bar was deleted the same day — its Walk-in Desk and Visitor Schedule are
  // sidebar items here, so the left panel is the only navigation on screen.
  it('hod gets Overview, Pre-Approvals, Walk-in Desk, Visitor Schedule, Reports', () => {
    const links = linksForRole('hod');
    expect(links.map((l) => l.label)).toEqual(['Overview', 'Pre-Approvals', 'Walk-in Desk', 'Visitor Schedule', 'Reports']);
    expect(links.map((l) => l.label)).not.toContain('Analytics');
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
