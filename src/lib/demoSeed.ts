// Demo seed — realistic visitor arrivals for live walkthroughs.
//
// Writes real rows into `visitors` and `visits` (so photos, queues, KPI tiles
// and the check-in flow render exactly like production), but every seeded row
// carries the DEMO marker (is_demo) so the entire batch can be wiped with one
// click without touching a single real record.
//
// Rationale for the design: a demo that lives only in React state can never
// show the full story (no photos through the real pipeline, no queue drift,
// no drill-downs) — the user asked to SEE arrivals with photos. Real rows are
// the only way every surface agrees. The demo flag keeps them phase-able.
import { supabase } from '../supabaseClient';
import type { VisitorPurpose } from '../types/index';

/**
 * Probe whether the demo-marker column exists on `visits` — the migration
 * (078_demo_marker.sql) must be applied before seeding works. Running the
 * probe once at module load keeps every seed call cheap.
 */
let demoColumnReady: boolean | null = null;
export async function isDemoSchemaReady(): Promise<boolean> {
  if (demoColumnReady !== null) return demoColumnReady;
  try {
    // A probe on a nonexistent column comes back as an error, not a crash.
    const { error } = await supabase
      .from('visits')
      .select('is_demo', { count: 'exact', head: true })
      .limit(0);
    demoColumnReady = !error;
  } catch {
    demoColumnReady = false;
  }
  return demoColumnReady;
}

export const DEMO_MARKER = { is_demo: true } as const;

type SeedVisitor = {
  name: string;
  phone: string;
  company: string | null;
  purpose: VisitorPurpose;
  department: string;
  hostName: string;
  photoUrl: string;
  checkedInMinutesAgo: number | null; // null => pre-registered, not yet arrived
};

const HOST_PHOTOS = {
  // Curated direct portrait URLs (free-use sources). These render as the
  // visitor's check-in photo — the thing the user specifically asked to see.
  sarah: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=320&h=320&fit=crop&crop=faces',
  marcos: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=320&h=320&fit=crop&crop=faces',
  julia: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=320&h=320&fit=crop&crop=faces',
  david: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&h=320&fit=crop&crop=faces',
  priya: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=320&h=320&fit=crop&crop=faces',
  emmanuel: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=320&h=320&fit=crop&crop=faces',
  elena: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=320&h=320&fit=crop&crop=faces',
  theo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=320&h=320&fit=crop&crop=faces',
};

function seedVisitors(): SeedVisitor[] {
  const now = Date.now();
  return [
    { name: 'Sarah Whitfield', phone: '+91 98765 01001', company: 'Whitfield & Partners', purpose: 'meeting', department: 'admin', hostName: 'D. Kumar', photoUrl: HOST_PHOTOS.sarah, checkedInMinutesAgo: null },
    { name: 'Marcos Fernandez', phone: '+91 98765 01002', company: null, purpose: 'interview', department: 'hr', hostName: 'HR Department', photoUrl: HOST_PHOTOS.marcos, checkedInMinutesAgo: null },
    { name: 'Ananya Kapoor', phone: '+91 98765 01003', company: 'Kapoor Logistics', purpose: 'delivery', department: 'ops', hostName: 'S. Verma', photoUrl: HOST_PHOTOS.priya, checkedInMinutesAgo: 42 },
    { name: 'Julia Okafor', phone: '+91 98765 01004', company: 'Okofor Facilities', purpose: 'maintenance', department: 'ops', hostName: 'Facilities', photoUrl: HOST_PHOTOS.elena, checkedInMinutesAgo: 26 },
    { name: 'David Lin', phone: '+91 98765 01005', company: 'Acme Corp', purpose: 'meeting', department: 'admin', hostName: 'R. Sharma', photoUrl: HOST_PHOTOS.david, checkedInMinutesAgo: 9 },
    { name: 'Emmanuel Adeyemi', phone: '+91 98765 01006', company: 'Adeyemi Audit', purpose: 'audit', department: 'finance', hostName: 'Finance Desk', photoUrl: HOST_PHOTOS.emmanuel, checkedInMinutesAgo: null },
  ];
}

/** Find a host profile by name for the host_id FK. */
async function resolveHost(hostName: string): Promise<{ id: string; deptId: string } | null> {
  // Guard fallback: the search desk uses `host_id` = visitor id when no host
  // exists (see checkInRecurring.ts) — so a seed never needs a real employee.
  // Prefer a real profile whose name matches the seed host.
  const { data } = await supabase
    .from('profiles')
    .select('id, department_id, full_name')
    .ilike('full_name', `%${hostName.split(' ')[0]}%`)
    .limit(1);
  const hit = (data ?? []).find(Boolean);
  if (!hit) return null;
  return { id: hit.id, deptId: hit.department_id ?? '' };
}

/** Find the department id matching the seed's department slug. */
async function resolveDepartment(slug: string): Promise<string | null> {
  const map: Record<string, string[]> = {
    admin: ['admin', 'administration', 'management'],
    hr: ['hr', 'human resources'],
    ops: ['ops', 'operations', 'facilities'],
    finance: ['finance', 'accounts'],
  };
  const patterns = map[slug] ?? [slug];
  const { data } = await supabase.from('departments').select('id, name, code').limit(200);
  const rows = (data ?? []) as { id: string; name: string; code: string }[];
  const hit = rows.find((r) => patterns.some((p) => r.name.toLowerCase().includes(p) || r.code.toLowerCase() === p));
  return hit?.id ?? null;
}

export type SeedOutcome = { ok: true; seeded: number; skipped: number } | { ok: false; message: string };

/**
 * Seed today's demo visitors. Idempotent: a visitor whose phone already has a
 * demo visit today is skipped (so repeated clicks never double the queue).
 */
export async function seedDemoVisitors(): Promise<SeedOutcome> {
  try {
    if (!(await isDemoSchemaReady())) {
      return { ok: false, message: 'Demo column missing — run migration 078_demo_marker.sql in Supabase first.' };
    }
    const visitors = seedVisitors();
    const today = new Date();
    let seeded = 0;
    let skipped = 0;

    // Idempotency: phones of visitors who already have a demo visit today.
    const { data: todayDemos } = await supabase
      .from('visits')
      .select('visitor_id')
      .match({ is_demo: true })
      .gte('created_at', `${today.toISOString().slice(0, 10)}T00:00:00Z`);
    const existingVisitorIds = new Set(((todayDemos ?? []) as { visitor_id: string }[]).map((r) => r.visitor_id));

    for (const v of visitors) {
      // Create or reuse the visitor row (upsert on phone, demo name preserved).
      const { data: vis, error: visErr } = await supabase
        .from('visitors')
        .upsert(
          { phone: v.phone, full_name: v.name, vendor_name: v.company, ...DEMO_MARKER } as any,
          { onConflict: 'phone' },
        )
        .select('id')
        .single();
      if (visErr || !vis) throw visErr ?? new Error('Visitor upsert failed');

      // Skip the visit if this visitor already has a demo visit today.
      if (existingVisitorIds.has(vis.id)) { skipped++; continue; }

      const host = await resolveHost(v.hostName);
      const deptId = (await resolveDepartment(v.department)) ?? host?.deptId ?? '';

      // ref_number is NOT inserted here — a Postgres trigger (migration 001)
      // auto-mints sequential VIS-<date>-<seq> refs on every insert, which is
      // exactly what production walk-ins get. Inserting a client value would
      // fight the trigger's uniqueness constraint.
      const nowDate = new Date();
      const checkedInAt = v.checkedInMinutesAgo !== null
        ? new Date(nowDate.getTime() - v.checkedInMinutesAgo * 60_000).toISOString()
        : null;

      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id,
        department_id: deptId || null,
        host_id: host?.id ?? vis.id,
        purpose: v.purpose,
        photo_data: v.photoUrl,
        status: checkedInAt ? 'checked_in' : 'approved',
        checked_in_at: checkedInAt,
        checked_out_at: null,
        exit_verified: null,
        rejection_reason: null,
        carrying_material: false,
        carrying_remarks: null,
        visitor_card_number: null,
        scheduled_for: checkedInAt ? nowDate.toISOString() : null,
        ...DEMO_MARKER,
      } as any);
      if (visitErr) throw visitErr;
      seeded++;
    }
    return { ok: true, seeded, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seeding failed';
    return { ok: false, message };
  }
}

/**
 * Clear every demo record seeded by this module — visitors AND their visits.
 * Only rows with the demo marker are touched; real data is never affected.
 */
export async function clearDemoData(): Promise<{ ok: true; clearedVisits: number; clearedVisitors: number } | { ok: false; message: string }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: demoVisits, error: vErr } = await supabase
      .from('visits')
      .delete()
      .match({ is_demo: true })
      .gte('created_at', `${today}T00:00:00Z`)
      .select('visitor_id');
    if (vErr) throw vErr;
    const clearedVisits = (demoVisits ?? []).length;

    const visitedIds = Array.from(new Set((demoVisits ?? []).map((v) => v.visitor_id)));
    const { data: demoVisitors, error: pErr } = await supabase
      .from('visitors')
      .delete()
      .match({ is_demo: true })
      .in('id', visitedIds)
      .select('id');
    if (pErr) throw pErr;
    return { ok: true, clearedVisits, clearedVisitors: (demoVisitors ?? []).length };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Clear failed' };
  }
}

/** Count currently seeded demo visits today (drives the demo panel UI). */
export async function countDemoVisits(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .match({ is_demo: true })
    .gte('created_at', `${today}T00:00:00Z`);
  if (error) return 0;
  return count ?? 0;
}
