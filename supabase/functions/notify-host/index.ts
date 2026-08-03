/**
 * notify-host Edge Function
 * M22-EMAIL: Sends email to host when visitor checks in.
 *
 * Triggered by: Supabase Database Webhook on visits table
 * Trigger condition: new.status = 'checked_in' AND old.status != 'checked_in'
 *
 * Environment variables required:
 *   RESEND_API_KEY - Resend.com API key for email delivery
 *   FROM_EMAIL - Sender email (e.g., "noreply@yourdomain.com")
 *   SUPABASE_URL - Auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY - Auto-injected by Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

function buildCheckInEmail(params: {
  hostName: string;
  visitorName: string;
  visitorVendorName: string | null;
  refNumber: string;
  purpose: string;
  checkedInAt: string;
}) {
  const { hostName, visitorName, visitorVendorName, refNumber, purpose, checkedInAt } = params;
  const purposeLabel = purpose.charAt(0).toUpperCase() + purpose.slice(1);
  const timeStr = new Date(checkedInAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const subject = `Visitor arrived: ${visitorName} (${refNumber})`;
  const bodyText = [
    `Hi ${hostName},`,
    '',
    `Your visitor ${visitorName}${visitorVendorName ? ` from ${visitorVendorName}` : ''} has arrived at the gate and checked in.`,
    '',
    `Reference: ${refNumber}`,
    `Purpose: ${purposeLabel}`,
    `Check-in time: ${timeStr}`,
    '',
    'Please proceed to the reception area.',
    '',
    '-- Secure Gate',
  ].join('\n');

  const bodyHtml = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2b2114, #453620); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: #e8d5a8; margin: 0; font-size: 18px;">Secure Gate</h2>
        <p style="color: #c9a558; margin: 4px 0 0; font-size: 13px;">Visitor Management System</p>
      </div>
      <div style="background: #faf8f4; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e8e2d3; border-top: none;">
        <p style="color: #33302a; margin-top: 0;">Hi <strong>${hostName}</strong>,</p>
        <p style="color: #57524a;">Your visitor <strong>${visitorName}</strong>${visitorVendorName ? ` from <em>${visitorVendorName}</em>` : ''} has arrived at the gate and checked in.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #80786a; font-size: 13px;">Reference</td><td style="padding: 8px 0; font-weight: 600; font-family: monospace;">${refNumber}</td></tr>
          <tr><td style="padding: 8px 0; color: #80786a; font-size: 13px;">Purpose</td><td style="padding: 8px 0;">${purposeLabel}</td></tr>
          <tr><td style="padding: 8px 0; color: #80786a; font-size: 13px;">Check-in time</td><td style="padding: 8px 0;">${timeStr}</td></tr>
        </table>
        <p style="color: #57524a; margin-bottom: 0;">Please proceed to the reception area.</p>
      </div>
    </div>
  `;

  return { subject, bodyText, bodyHtml };
}

Deno.serve(async (req) => {
  // Only handle POST requests (webhook delivery)
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Only fire on visit check-in
  const record = payload.record;
  const oldRecord = payload.old_record;

  if (
    payload.table !== 'visits' ||
    record['status'] !== 'checked_in' ||
    oldRecord?.['status'] === 'checked_in'
  ) {
    return new Response('Not a check-in event', { status: 200 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'noreply@questmallsecuregate.local';

  if (!resendKey) {
    console.warn('[notify-host] RESEND_API_KEY not set — skipping email');
    return new Response('Email not configured', { status: 200 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch visit with visitor and host details
  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .select(`
      ref_number, purpose, checked_in_at,
      visitor:visitors(full_name, vendor_name),
      host:profiles!visits_host_id_fkey(full_name, email)
    `)
    .eq('id', record['id'])
    .single();

  if (visitErr || !visit) {
    console.error('[notify-host] visit fetch error:', visitErr);
    return new Response('Visit not found', { status: 200 });
  }

  const visitor = visit.visitor as { full_name: string; vendor_name: string | null } | null;
  const host = visit.host as { full_name: string; email: string } | null;

  if (!host?.email) {
    console.warn('[notify-host] host has no email, skipping');
    return new Response('No host email', { status: 200 });
  }

  const { subject, bodyText, bodyHtml } = buildCheckInEmail({
    hostName: host.full_name,
    visitorName: visitor?.full_name ?? 'Unknown visitor',
    visitorVendorName: visitor?.vendor_name ?? null,
    refNumber: visit.ref_number,
    purpose: visit.purpose,
    checkedInAt: visit.checked_in_at ?? new Date().toISOString(),
  });

  // Send via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [host.email],
      subject,
      text: bodyText,
      html: bodyHtml,
    }),
  });

  if (!emailRes.ok) {
    const errBody = await emailRes.text();
    console.error('[notify-host] Resend error:', errBody);
    return new Response('Email send failed', { status: 500 });
  }

  console.log(`[notify-host] Email sent to ${host.email} for visit ${record['id']}`);
  return new Response('OK', { status: 200 });
});
