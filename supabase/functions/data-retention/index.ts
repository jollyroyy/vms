/**
 * data-retention Edge Function — SEC-19 / M15-RETENTION / FR-WF-04
 * Deletes visit records (and associated photos/data) older than RETENTION_DAYS.
 *
 * Schedule: Run daily via Supabase cron (configure in dashboard):
 *   select cron.schedule('daily-retention', '0 2 * * *', 'select net.http_post(...)');
 *
 * Environment variables:
 *   RETENTION_DAYS - Days to retain visit data (default: 365)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY - Auto-injected
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Allow GET for cron invocation, POST for manual trigger
  if (!['GET', 'POST'].includes(req.method)) {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const retentionDays = parseInt(Deno.env.get('RETENTION_DAYS') ?? '365', 10);

  if (isNaN(retentionDays) || retentionDays < 30) {
    return new Response('RETENTION_DAYS must be >= 30', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffIso = cutoffDate.toISOString();

  console.log(`[data-retention] Purging visits created before ${cutoffIso} (retention: ${retentionDays} days)`);

  // 1. Delete old visits (cascades to gate_pass_items via visit_id FK if configured)
  const { data: deletedVisits, error: visitErr } = await supabase
    .from('visits')
    .delete()
    .lt('created_at', cutoffIso)
    .in('status', ['checked_out', 'rejected'])  // Only delete closed visits
    .select('id');

  if (visitErr) {
    console.error('[data-retention] visit delete error:', visitErr);
    return new Response(JSON.stringify({ error: visitErr.message }), { status: 500 });
  }

  // 2. Delete old audit logs
  const { error: auditErr } = await supabase
    .from('audit_logs')
    .delete()
    .lt('created_at', cutoffIso);

  if (auditErr) {
    console.error('[data-retention] audit_log delete error:', auditErr);
  }

  // 3. Delete old notifications
  const { error: notifErr } = await supabase
    .from('notifications')
    .delete()
    .lt('created_at', cutoffIso)
    .eq('is_read', true);

  if (notifErr) {
    console.error('[data-retention] notifications delete error:', notifErr);
  }

  const result = {
    purgedVisits: deletedVisits?.length ?? 0,
    cutoffDate: cutoffIso,
    retentionDays,
    timestamp: new Date().toISOString(),
  };

  console.log('[data-retention] Complete:', result);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
