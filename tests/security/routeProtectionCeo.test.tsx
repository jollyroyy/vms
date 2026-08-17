// CHECK for goal.md SEC-7 — frontend route protection, the CEO role.
//
// Split out of routeProtection.test.tsx on 2026-08-17, when adding this role
// pushed that file past the 300-line cap — the same reason and the same shape
// as routeProtectionAdmin.test.tsx beside it.
//
// WHAT THIS GUARDS is the scope decision itself, not a detail of it. `ceo` was
// added for exactly ONE decision: a blacklisted visitor comes off the list
// only once an admin has justified it and the CEO has granted it (migrations
// 090-092). The standing temptation with an executive role is to hand it
// everything "just in case", which is how it quietly becomes a second admin
// with a nicer title. The forbidden list below is therefore the interesting
// half: no admin console, no visitor records, no reports, and not even
// /search — that is a visitor-record lookup, and the CEO's business is with
// the one visitor already named on the request in front of them.
//
// The other half of the guarantee — that the CEO's approval is the ONLY route
// off the blacklist — cannot be asserted here, because `isForbidden` knows
// nothing about writes. It lives in the database (migration 092's
// `enforce_blacklist_clearance`) and is verified against the live project.

import { describe, it, expect } from 'vitest';
import { isForbidden } from '../../src/lib/roleRoutes';

describe('SEC-7: frontend route protection — ceo', () => {
  const role = 'ceo' as const;

  it('ceo is allowed on /ceo/blacklist-removals', () => {
    expect(isForbidden('/ceo/blacklist-removals', role)).toBe(false);
  });
  it('ceo is allowed on /profile', () => {
    expect(isForbidden('/profile', role)).toBe(false);
  });
  for (const route of ['/admin', '/admin/security', '/visitors', '/whos-inside', '/reports',
                        '/guard/dashboard', '/overview', '/search']) {
    it(`ceo is FORBIDDEN on ${route} (the CEO inherits no admin console)`, () => {
      expect(isForbidden(route, role)).toBe(true);
    });
  }
});
