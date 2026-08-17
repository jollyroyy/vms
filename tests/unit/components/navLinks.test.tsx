import { describe, it, expect } from 'vitest';
import { ALL_LINKS, linksForRole } from '../../../src/components/layout/navLinks';

describe('navLinks: linksForRole', () => {
  // FOUR since 2026-08-18 (client instruction: the guard must not waste time
  // navigating). Pre-Registered was the fifth and its board was today's
  // approved arrivals who have not turned up yet — which is the dashboard's
  // Expected Today panel, from the same predicate, on a screen the guard can
  // also act from. Two nav items opening one list is the defect this project
  // has fixed on every other surface. The ROUTE stays resolvable and
  // redirects, like /visitors and /kiosk before it; it is the nav item that
  // went.
  //
  // The Watchlist tab was deleted 2026-08-15 and the Visitors tab 2026-08-15,
  // both on client instruction. The two ARRIVAL routes sit second and third
  // (2026-08-15): a visitor either holds a pass (Find & Scan) or does not
  // (Register Walk-in), and those are the two things a guard STARTS.
  //
  // "Find & Scan", not "Scan Pass" (2026-08-18): the old name described the
  // camera, and that page is now the one place a guard locates a visitor by
  // any means they have — QR, PDF, name, mobile, reference or the number on
  // the physical card — and performs the single action that visitor needs.
  it('guard gets exactly 4 links, in order, with the exact labels, and no Visitors, Pre-Registered or Search', () => {
    const links = linksForRole('guard');
    expect(links.map((l) => l.label)).toEqual([
      'Dashboard',
      'Find & Scan',
      'Register Walk-in',
      'Entry & Exit',
    ]);
    expect(links.map((l) => l.label)).not.toContain('Pre-Registered');
    expect(links.map((l) => l.label)).not.toContain('Scan Pass');
    expect(links.map((l) => l.label)).not.toContain('Visitors');
    expect(links.map((l) => l.label)).not.toContain('Search');
    expect(links.map((l) => l.label)).not.toContain('Vehicles');
    expect(links.map((l) => l.label)).not.toContain('Watchlist');
  });

  it('guard tab links point at the reference-screen routes, in nav order', () => {
    const links = linksForRole('guard');
    expect(links[0]?.to).toBe('/guard/dashboard');
    expect(links[1]?.to).toBe('/guard/scan-pass');
    expect(links[2]?.to).toBe('/guard/walk-in');
    expect(links[3]?.to).toBe('/guard/inside-now');
    expect(links).toHaveLength(4);
  });

  it('puts the two ways a visitor arrives second and third', () => {
    const links = linksForRole('guard');
    expect(links[1]?.label).toBe('Find & Scan');
    expect(links[2]?.label).toBe('Register Walk-in');
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

  // The admin console is NINE TABS as of 2026-08-17 (client instruction), and
  // the order is the reference screens' order — a reader learns the rail by
  // position, so a reshuffle is a behaviour change, not a cosmetic one.
  //
  // This REVERSES the old rule that admin had no route to visitor records. The
  // reasoning that rule carried is preserved by the tabs being READ-ONLY, not
  // by the routes being absent: no admin screen renders a control that writes
  // to `visits`. That half is asserted on each page's own test.
  //
  // THERE IS NO ANALYTICS ITEM. The page was deleted, not unlinked — its charts
  // are on the Dashboard and on Reports, derived from rows those screens
  // already load.
  //
  // THERE IS NO BADGE PRINTING ITEM EITHER (deleted 2026-08-17, client
  // instruction): its tab read migration 087's `badge_prints` log, which nothing
  // in this app writes, so the item led to three zeroes over an empty table.
  it('admin gets the eight console tabs, in the reference order, with no Analytics or Badge Printing', () => {
    const links = linksForRole('admin');
    expect(links.map((l) => l.label)).toEqual(['Dashboard', 'Live Check-In', 'Pre-Registration', 'Visitors Log', 'Hosts',
      'Blacklist & Security', 'Reports', 'Settings']);
    expect(links.map((l) => l.label)).not.toContain('Analytics');
    expect(links.map((l) => l.label)).not.toContain('Badge Printing');
    expect(links.map((l) => l.to)).not.toContain('/admin/badges');
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
  // Pre-Approvals is the FORM and keeps /approvals (client report, 2026-08-16):
  // HODConsole had taken over that route, so the only way an HOD raises a
  // visitor pass became unreachable behind a decision desk. Every console desk
  // is a ?tab= view of /overview.
  //
  // THE APPROVAL DESK IS GONE (client instruction, 2026-08-16). It listed
  // `pending_approval` rows carrying a `scheduled_for`, and no such row can be
  // written — both writers of that status insert `scheduled_for: null`, and a
  // pre-approval is created already approved. Every decision an HOD actually
  // makes is on the Walk-in Desk.
  it('hod gets Dashboard, Pre-Approvals, Walk-in Desk, Visitor Schedule, Reports', () => {
    const links = linksForRole('hod');
    expect(links.map((l) => l.label)).toEqual([
      // "Dashboard", not "Overview" (client instruction, 2026-08-16) — the
      // route is still /overview, which is what the bookmarks hold.
      'Dashboard', 'Pre-Approvals', 'Walk-in Desk', 'Visitor Schedule', 'Reports',
    ]);
    expect(links.map((l) => l.label)).not.toContain('Analytics');
    expect(links.map((l) => l.label)).not.toContain('Approval Desk');
    expect(links.map((l) => l.to)).not.toContain('/overview?tab=preapprovals');
    expect(links.find((l) => l.label === 'Pre-Approvals')?.to).toBe('/approvals');
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
