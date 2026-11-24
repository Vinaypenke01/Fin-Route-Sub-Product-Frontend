// ==============================================================================
// SUPABASE EDGE FUNCTION: report-error
// Receives crash / failed-save reports from the app, removes personal data,
// and stores them in master_client_errors for the admin panel.
// Public (the app may be signed out when it crashes), so it is size-limited
// and rate-limited per tenant email.
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: TS extension import in Deno
import { withCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
// @ts-ignore: TS extension import in Deno
import { getServiceClient } from '../_shared/auth.ts';
// @ts-ignore: TS extension import in Deno
import { scrubText } from '../_shared/scrub.ts';

const MAX_PER_HOUR = 50;

serve(withCors(async (req: Request) => {
  if (req.method !== 'POST') return errorResponse('Method not allowed. Use POST.', 405);

  try {
    const raw = await req.text();
    if (raw.length > 20000) return errorResponse('Report too large.', 413);
    const body = JSON.parse(raw || '{}');

    const email = String(body?.email || '').trim().toLowerCase().slice(0, 200) || null;
    const kind = ['crash', 'error', 'save_failed'].includes(body?.kind) ? body.kind : 'error';
    const message = scrubText(body?.message, email || '', 500);
    if (!message) return errorResponse('Empty report.', 400);

    const serviceClient = getServiceClient();

    // Simple flood protection
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let countQuery = serviceClient
      .from('master_client_errors')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    countQuery = email ? countQuery.eq('tenant_email', email) : countQuery.is('tenant_email', null);
    const { count } = await countQuery;
    if ((count || 0) >= MAX_PER_HOUR) return jsonResponse({ success: true, stored: false });

    const { error } = await serviceClient.from('master_client_errors').insert([{
      tenant_email: email,
      kind,
      message,
      detail: scrubText(body?.detail, email || '', 4000) || null,
      page: scrubText(body?.page, email || '', 200) || null,
      device: scrubText(body?.device, '', 120) || null,
      app_version: scrubText(body?.appVersion, '', 40) || null,
    }]);
    if (error) throw error;

    // Keep 90 days
    if (Math.random() < 0.02) {
      await serviceClient.from('master_client_errors').delete()
        .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
    }
    return jsonResponse({ success: true, stored: true });
  } catch (err: unknown) {
    console.error('report-error exception:', err);
    return errorResponse('Could not store the report.', 500);
  }
}));
