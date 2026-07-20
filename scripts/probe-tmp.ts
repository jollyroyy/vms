import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.VITE_SUPABASE_ANON_KEY!;
console.log('URL set:', !!url, '| service key set:', !!svc, '| anon key set:', !!anon);

const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  for (const t of ['departments', 'profiles', 'visitors', 'visits', 'gate_passes', 'gate_pass_items', 'notifications']) {
    const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true });
    console.log(t.padEnd(16), error ? 'ERR: ' + error.message : 'rows=' + count);
  }
  // RPCs exist?
  for (const fn of ['get_profile_names', 'approve_visit', 'reject_visit']) {
    const { error } = await admin.rpc(fn as never, {} as never);
    console.log('rpc', fn.padEnd(20), error ? error.message.slice(0, 80) : 'OK(no-arg call)');
  }
  // Can a role sign in?
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: 'staff@demo.vms', password: 'Demo@1234' });
  console.log('staff sign-in:', error ? 'ERR: ' + error.message : 'OK, user=' + data.user?.id.slice(0, 8));
  if (data.session) {
    const meta = data.user?.user_metadata ?? {};
    console.log('staff JWT metadata keys:', Object.keys(meta).join(','), '| role:', (meta as any).role, '| dept:', (meta as any).department_id);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
