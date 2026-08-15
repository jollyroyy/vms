import { describe, it, expect } from 'vitest';
import { ALL_LINKS, linksForRole } from '../../../src/components/layout/navLinks';

describe('navLinks: linksForRole', () => {
  // The four-tab guard console from the approved reference design
  // (Dashboard, Live Queue, Pre-Registered, Watchlist), then Scan Pass and the
  // consolidated Visitors lane. Client instruction 2026-08-14 — no Search, no
  // group button, no vehicle entries anywhere.
  it('guard gets exactly 6 links, in order, with the exact labels, and no Search', () => {
    const links = linksForRole('guard');
    expect(links.map((l) => l.label)).toEqual([
      'Dashboard',
      'Entry & Exit',
      'Pre-Registered',
      'Watchlist',
      'Scan Pass',
      'Visitors',
    ]);
    expect(links.map((l) => l.label)).not.toContain('Search');
    expect(links.map((l) => l.label)).not.toContain('Vehicles');
  });

  it('guard tab links point at the four reference-screen routes, in reference order', () => {
    const links = linksForRole('guard');
    expect(links[0]?.to).toBe('/guard/dashboard');
    expect(links[1]?.to).toBe('/guard/inside-now');
    expect(links[2]?.to).toBe('/guard/preregistered');
    expect(links[3]?.to).toBe('/guard/watchlist');
  });

  it('guard Scan Pass link points to /guard/scan-pass and sits fifth', () => {
    const links = linksForRole('guard');
    const scan = links.find((l) => l.label === 'Scan Pass');
    expect(scan?.to).toBe('/guard/scan-pass');
    expect(links[4]?.label).toBe('Scan Pass');
  });

  // The Visitors entry is a SINGLE link now (2026-08-13): the eight segments
  // that used to expand under it — All Visitors, Expected, Inside, … — live on
  // the page as KPI tiles (VisitorKpiRail), counted from the page's own data.
  // The sidebar naming them was the old answer to "where can I go"; the page
  // carrying the counts and the filters is the same answer one click closer.
  it('guard Visitors link points to /visitors as a plain link with no sub-nav children', () => {
    const links = linksForRole('guard');
    const visitors = links.find((l) => l.label === 'Visitors');
    expect(visitors?.to).toBe('/visitors');
    expect((visitors as any)?.children).toBeUndefined();
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
