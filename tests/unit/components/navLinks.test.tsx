import { describe, it, expect } from 'vitest';
import { ALL_LINKS, linksForRole } from '../../../src/components/layout/navLinks';

describe('navLinks: linksForRole', () => {
  it('guard gets exactly 3 links, in order, with the exact labels, and no Search', () => {
    const links = linksForRole('guard');
    expect(links.map((l) => l.label)).toEqual([
      'Dashboard',
      'Walk-in Visitors',
      'Pre-Approvals',
    ]);
    expect(links.map((l) => l.label)).not.toContain('Search');
  });

  it('guard Walk-in Visitors link points to /visitors and carries no sub-nav children', () => {
    const links = linksForRole('guard');
    const visitors = links.find((l) => l.label === 'Walk-in Visitors');
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
