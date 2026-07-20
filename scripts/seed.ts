/**
 * VMS Demo Seed Script — S14 / goal.md §2.2
 *
 * Creates 3 departments, HODs + delegates, a guard, an admin, and sample
 * visits/gate passes in every status so the demo has realistic data.
 *
 * Usage:
 *   cp .env.example .env          # fill VITE_SUPABASE_URL + SERVICE_ROLE_KEY
 *   npm run seed
 *
 * Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * The service-role key is NEVER bundled into the client (see .env.example).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/index.js';

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Service-role client — used ONLY in this server-side script, never bundled to client.
const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createUser(email: string, password: string, fullName: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    // If user already exists, fetch it
    if (error.message?.includes('already')) {
      const { data: list } = await admin.auth.admin.listUsers();
      return list?.users.find((u) => u.email === email) ?? null;
    }
    throw new Error(`createUser ${email}: ${error.message}`);
  }
  return data.user;
}

function ok(label: string, error: { message?: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
  console.log(`  ✓ ${label}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  VMS Demo Seed\n');

  // ── 1. Departments ──
  console.log('── Departments');
  const deptData = [
    { name: 'Information Technology', code: 'IT'  },
    { name: 'Human Resources',        code: 'HR'  },
    { name: 'Finance & Accounts',     code: 'FIN' },
  ];
  const { data: depts, error: deptErr } = await admin
    .from('departments')
    .upsert(deptData, { onConflict: 'code' })
    .select();
  ok('departments upserted', deptErr);
  const dept = Object.fromEntries((depts ?? []).map((d) => [d.code, d]));
  console.log('  dept IDs:', Object.keys(dept).map((k) => `${k}=${dept[k]?.id?.slice(0, 8)}`).join(', '));

  // ── 2. Auth users ──
  console.log('\n── Auth users');
  const PASS = 'Demo@1234'; // same password for all demo users
  const users: Record<string, { id: string; email: string }> = {};

  const specs = [
    { key: 'guard1',       email: 'guard@demo.vms',       name: 'Arjun Mehta'    },
    { key: 'hod_it',       email: 'hod.it@demo.vms',      name: 'Priya Sharma'   },
    { key: 'hod_hr',       email: 'hod.hr@demo.vms',      name: 'Ravi Kumar'     },
    { key: 'hod_fin',      email: 'hod.fin@demo.vms',     name: 'Meena Patel'    },
    { key: 'delegate_it',  email: 'delegate.it@demo.vms', name: 'Sanjay Gupta'   },
    { key: 'staff1',       email: 'staff@demo.vms',       name: 'Ananya Nair'    },
    { key: 'admin1',       email: 'admin@demo.vms',       name: 'Vikram Singh'   },
    // Additional approvers & staff per department
    { key: 'hod2_it',      email: 'hod2.it@demo.vms',     name: 'Vikram Patel'   },
    { key: 'staff_it',     email: 'staff.it@demo.vms',    name: 'Neha Gupta'     },
    { key: 'hod2_hr',      email: 'hod2.hr@demo.vms',     name: 'Suresh Reddy'   },
    { key: 'staff_hr',     email: 'staff.hr@demo.vms',    name: 'Pooja Sharma'   },
    { key: 'hod2_fin',     email: 'hod2.fin@demo.vms',    name: 'Arun Kumar'     },
    { key: 'staff_fin',    email: 'staff.fin@demo.vms',   name: 'Divya Singh'    },
  ];

  for (const s of specs) {
    const u = await createUser(s.email, PASS, s.name);
    if (!u) throw new Error(`Could not create/find user ${s.email}`);
    users[s.key] = { id: u.id, email: u.email ?? s.email };
    console.log(`  ✓ ${s.key} (${u.id.slice(0, 8)})`);
  }

  // ── 3. Profiles — set roles and departments ──
  console.log('\n── Profiles');
  // Small delay to let auth trigger create stub profiles
  await new Promise((r) => setTimeout(r, 1500));

  const profileUpdates = [
    { id: users['guard1']!.id,      role: 'guard'       as const, department_id: null               },
    { id: users['hod_it']!.id,      role: 'hod'         as const, department_id: dept['IT']?.id ?? null  },
    { id: users['hod_hr']!.id,      role: 'hod'         as const, department_id: dept['HR']?.id ?? null  },
    { id: users['hod_fin']!.id,     role: 'hod'         as const, department_id: dept['FIN']?.id ?? null },
    { id: users['delegate_it']!.id, role: 'staff'       as const, department_id: dept['IT']?.id ?? null  },
    { id: users['staff1']!.id,      role: 'staff'       as const, department_id: dept['HR']?.id ?? null  },
    { id: users['admin1']!.id,      role: 'admin'       as const, department_id: null               },
    { id: users['hod2_it']!.id,     role: 'hod'         as const, department_id: dept['IT']?.id ?? null  },
    { id: users['staff_it']!.id,    role: 'staff'       as const, department_id: dept['IT']?.id ?? null  },
    { id: users['hod2_hr']!.id,     role: 'hod'         as const, department_id: dept['HR']?.id ?? null  },
    { id: users['staff_hr']!.id,    role: 'staff'       as const, department_id: dept['HR']?.id ?? null  },
    { id: users['hod2_fin']!.id,    role: 'hod'         as const, department_id: dept['FIN']?.id ?? null },
    { id: users['staff_fin']!.id,   role: 'staff'       as const, department_id: dept['FIN']?.id ?? null },
  ];

  for (const up of profileUpdates) {
    const { error } = await admin.from('profiles').update(up).eq('id', up.id);
    ok(`profile ${up.id.slice(0, 8)} → ${up.role}`, error);
  }

  // Set IT HOD's delegate
  const { error: delErr } = await admin
    .from('profiles')
    .update({ delegate_id: users['delegate_it']!.id })
    .eq('id', users['hod_it']!.id);
  ok('delegate_it set for hod_it', delErr);

  // ── 4. Visitors ──
  console.log('\n── Visitors');
  const visitorRows = [
    { phone: '9876543210', full_name: 'Rohan Desai',      company: 'TechSoft Pvt Ltd',  id_type: 'Aadhar', id_last4: '4321', is_blacklisted: false },
    { phone: '9123456789', full_name: 'Kavita Joshi',     company: 'VendorCo',           id_type: 'PAN',    id_last4: '6789', is_blacklisted: false },
    { phone: '9988776655', full_name: 'Mohan Das',        company: null,                 id_type: 'DL',     id_last4: '9900', is_blacklisted: false },
    { phone: '9000000001', full_name: 'Blacklisted User', company: null,                 id_type: null,     id_last4: null,   is_blacklisted: true, blacklist_reason: 'Theft incident on 2025-01-10' },
  ];
  const { data: visitors, error: visErr } = await admin
    .from('visitors')
    .upsert(visitorRows, { onConflict: 'phone' })
    .select();
  ok('visitors upserted', visErr);
  const vis = visitors ?? [];

  // ── 5. Visits ──
  console.log('\n── Visits');
  const itDeptId  = dept['IT']?.id!;
  const hrDeptId  = dept['HR']?.id!;
  const finDeptId = dept['FIN']?.id!;

  const visitRows = [
    // checked_in — show someone inside right now
    {
      visitor_id:   vis[0]?.id!,
      department_id: itDeptId,
      host_id:       users['hod_it']!.id,
      purpose:       'meeting'      as const,
      status:        'checked_in'   as const,
      checked_in_at: new Date(Date.now() - 30 * 60_000).toISOString(),
      carrying_material: true,
      ref_number:    'SEED-PLACEHOLDER-1', // overwritten by trigger on real insert
    },
    // pending_approval
    {
      visitor_id:   vis[1]?.id!,
      department_id: hrDeptId,
      host_id:       users['hod_hr']!.id,
      purpose:       'vendor'        as const,
      status:        'pending_approval' as const,
      carrying_material: false,
      ref_number:    'SEED-PLACEHOLDER-2',
    },
    // approved (not yet checked in)
    {
      visitor_id:   vis[2]?.id!,
      department_id: finDeptId,
      host_id:       users['hod_fin']!.id,
      purpose:       'delivery'      as const,
      status:        'approved'      as const,
      carrying_material: false,
      ref_number:    'SEED-PLACEHOLDER-3',
    },
    // checked_out
    {
      visitor_id:   vis[0]?.id!,
      department_id: itDeptId,
      host_id:       users['hod_it']!.id,
      purpose:       'audit'         as const,
      status:        'checked_out'   as const,
      checked_in_at:  new Date(Date.now() - 3 * 3600_000).toISOString(),
      checked_out_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
      exit_verified:  true,
      carrying_material: false,
      ref_number:    'SEED-PLACEHOLDER-4',
    },
    // rejected
    {
      visitor_id:   vis[1]?.id!,
      department_id: itDeptId,
      host_id:       users['hod_it']!.id,
      purpose:       'other'         as const,
      status:        'rejected'      as const,
      rejection_reason: 'Not expected today.',
      carrying_material: false,
      ref_number:    'SEED-PLACEHOLDER-5',
    },
  ];

  // Insert one by one so triggers fire per row (generates real ref_number)
  const visitIds: string[] = [];
  for (const v of visitRows) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ref_number, ...insertRow } = v;
    const { data, error } = await admin.from('visits').insert(insertRow).select('id, ref_number').single();
    if (error) { console.error('  ✗ visit insert:', error.message); continue; }
    // Update status + timestamps (trigger sets ref_number + created_at; we patch status)
    if (v.status !== 'pending_approval') {
      await admin.from('visits').update({
        status:          v.status,
        checked_in_at:   v.checked_in_at ?? null,
        checked_out_at:  (v as { checked_out_at?: string }).checked_out_at ?? null,
        exit_verified:   (v as { exit_verified?: boolean }).exit_verified ?? null,
        rejection_reason:(v as { rejection_reason?: string }).rejection_reason ?? null,
      }).eq('id', data.id);
    }
    visitIds.push(data.id);
    console.log(`  ✓ visit ${data.ref_number}`);
  }

  // ── 6. Gate passes ──
  console.log('\n── Gate passes');
  const today     = new Date().toISOString().slice(0, 10);
  const tomorrow  = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  const passRows = [
    // RGP OUT — awaiting return (due tomorrow, so 'due_soon')
    {
      type:                 'RGP'             as const,
      direction:            'OUT'             as const,
      department_id:        itDeptId,
      status:               'awaiting_return' as const,
      reason:               'Laptop repair at vendor workshop',
      carrier_name:         'Rohan Desai',
      expected_return_date: tomorrow,
      created_by:           users['hod_it']!.id,
    },
    // RGP OUT — overdue (expected yesterday)
    {
      type:                 'RGP'             as const,
      direction:            'OUT'             as const,
      department_id:        hrDeptId,
      status:               'awaiting_return' as const,
      reason:               'Projector sent for calibration',
      carrier_name:         'Kavita Joshi',
      expected_return_date: yesterday,
      created_by:           users['hod_hr']!.id,
    },
    // NRGP IN — dispatched
    {
      type:          'NRGP'       as const,
      direction:     'IN'        as const,
      department_id: finDeptId,
      status:        'dispatched' as const,
      reason:        'Stationery delivery',
      carrier_name:  'Mohan Das',
      created_by:    users['staff1']!.id,
    },
    // RGP OUT — draft
    {
      type:                 'RGP'  as const,
      direction:            'OUT'  as const,
      department_id:        itDeptId,
      status:               'draft' as const,
      reason:               'Test equipment for field visit',
      expected_return_date: today,
      created_by:           users['hod_it']!.id,
    },
  ];

  const passInsertItems: Array<{ passId: string; items: Array<{ description: string; qty: number; unit?: string; serial_no?: string; approx_value?: number }> }> = [
    {
      passId: '',
      items: [
        { description: 'Dell Laptop XPS 15', qty: 1, unit: 'pc',  serial_no: 'DL-XPS-00123', approx_value: 85000 },
        { description: 'Laptop Charger',      qty: 1, unit: 'pc',  serial_no: null,            approx_value: 3500  },
      ],
    },
    {
      passId: '',
      items: [
        { description: 'Epson Projector', qty: 1, unit: 'pc', serial_no: 'EP-PRJ-77', approx_value: 42000 },
      ],
    },
    {
      passId: '',
      items: [
        { description: 'A4 Paper Ream',  qty: 20, unit: 'ream', approx_value: 5000 },
        { description: 'Ball Point Pens', qty: 100, unit: 'pcs', approx_value: 500  },
      ],
    },
    {
      passId: '',
      items: [
        { description: 'Oscilloscope', qty: 1, unit: 'pc', serial_no: 'OSC-2024-01', approx_value: 35000 },
      ],
    },
  ];

  for (let i = 0; i < passRows.length; i++) {
    const pr = passRows[i]!;
    const { data, error } = await admin.from('gate_passes').insert(pr).select('id, ref_number').single();
    if (error) { console.error(`  ✗ gate_pass[${i}]:`, error.message); continue; }

    // Patch status (trigger sets ref + created_at; we must update status after)
    if (pr.status !== 'draft') {
      await admin.from('gate_passes').update({ status: pr.status }).eq('id', data.id);
    }

    // Insert items
    const itemSpec = passInsertItems[i]!;
    const items = itemSpec.items.map((it) => ({ ...it, gate_pass_id: data.id }));
    const { error: itemErr } = await admin.from('gate_pass_items').insert(items);
    if (itemErr) console.error(`  ✗ items for ${data.ref_number}:`, itemErr.message);

    console.log(`  ✓ gate_pass ${data.ref_number} (${pr.type}/${pr.direction}) — ${pr.status}`);
  }

  // ── Done ──
  console.log('\n════════════════════════════════');
  console.log('✅  Seed complete.\n');
  console.log('Demo user credentials (all use password: Demo@1234):');
  console.log(`  Guard:         guard@demo.vms`);
  console.log(`  HOD (IT):      hod.it@demo.vms, hod2.it@demo.vms`);
  console.log(`  HOD (HR):      hod.hr@demo.vms, hod2.hr@demo.vms`);
  console.log(`  HOD (FIN):     hod.fin@demo.vms, hod2.fin@demo.vms`);
  console.log(`  Admin:         admin@demo.vms`);
  console.log('\nOpen the app, log in as guard, and follow DEMO-SCRIPT.md');
  console.log('════════════════════════════════\n');
}

seed().catch((err) => {
  console.error('\n💥  Seed failed:', err);
  process.exit(1);
});
