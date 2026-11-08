// ==============================================================================
// SUPABASE EDGE FUNCTION: keep-alive
// Periodically pings the Master Database and all isolated Tenant Databases
// Prevents Supabase Free Tier databases from pausing (sleeping) after 7 days
// Logs health and latency metrics for the Super Admin dashboard
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: Supabase JS library import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/auth.ts';

declare const Deno: any;

interface TenantPingResult {
  tenantId: string;
  name: string;
  email: string;
  dbUrl: string;
  status: 'online' | 'sleeping' | 'error' | 'unconfigured';
  latencyMs: number | null;
  errorMessage?: string | null;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const serviceClient = getServiceClient();

    // 2. Measure Master Database Latency
    const masterStart = performance.now();
    const { data: tenantRows, error: masterErr } = await serviceClient
      .from('master_tenants')
      .select(`
        id,
        client_name,
        business_name,
        email,
        status,
        master_db_configs (
          tenant_supabase_url,
          tenant_anon_key
        )
      `);

    const masterLatency = Math.round(performance.now() - masterStart);

    if (masterErr) {
      throw new Error(`Master DB query failed: ${masterErr.message}`);
    }

    const allTenants = tenantRows || [];

    // 3. Ping Each Tenant Database in Parallel with Timeout
    const pingPromises = allTenants.map(async (t: any): Promise<TenantPingResult> => {
      const dbConfig = Array.isArray(t.master_db_configs) ? t.master_db_configs[0] : t.master_db_configs;
      const dbUrl = (dbConfig?.tenant_supabase_url || '').trim();
      const anonKey = (dbConfig?.tenant_anon_key || '').trim();
      const tenantName = t.client_name || t.business_name || 'Tenant';

      if (!dbUrl || !anonKey) {
        return {
          tenantId: t.id,
          name: tenantName,
          email: t.email,
          dbUrl: '',
          status: 'unconfigured',
          latencyMs: null,
          errorMessage: 'No dedicated database URL configured',
        };
      }

      const tenantStart = performance.now();
      try {
        const tenantClient = createClient(dbUrl, anonKey, {
          auth: { persistSession: false },
        });

        // Run lightweight ping query with 6s timeout
        const pingPromise = Promise.race([
          tenantClient.from('tenant_settings').select('id').limit(1),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out (>6000ms)')), 6000)),
        ]);

        const result: any = await pingPromise;
        const latency = Math.round(performance.now() - tenantStart);

        if (result?.error) {
          // If tenant_settings doesn't exist, try weeks table fallback
          const fallback = await tenantClient.from('weeks').select('id').limit(1);
          if (fallback.error && !fallback.error.message.includes('42P01')) {
            throw fallback.error;
          }
        }

        return {
          tenantId: t.id,
          name: tenantName,
          email: t.email,
          dbUrl,
          status: 'online',
          latencyMs: latency,
        };
      } catch (err: any) {
        const latency = Math.round(performance.now() - tenantStart);
        const errMsg = String(err?.message || err);
        const isSleeping = errMsg.includes('timed out') || errMsg.includes('503') || errMsg.includes('504') || errMsg.includes('Failed to fetch');

        return {
          tenantId: t.id,
          name: tenantName,
          email: t.email,
          dbUrl,
          status: isSleeping ? 'sleeping' : 'error',
          latencyMs: latency,
          errorMessage: errMsg,
        };
      }
    });

    const pingResults = await Promise.all(pingPromises);

    // 4. Update Master Database with Health Metrics
    const nowIso = new Date().toISOString();
    const logRows: any[] = [];

    for (const r of pingResults) {
      logRows.push({
        tenant_id: r.tenantId,
        tenant_name: r.name,
        tenant_email: r.email,
        database_url: r.dbUrl,
        status: r.status,
        latency_ms: r.latencyMs,
        error_message: r.errorMessage || null,
        created_at: nowIso,
      });

      // Update tenant row in master_tenants
      try {
        await serviceClient
          .from('master_tenants')
          .update({
            last_health_status: r.status,
            last_latency_ms: r.latencyMs,
            last_health_check_at: nowIso,
          })
          .eq('id', r.tenantId);
      } catch (updateErr) {
        console.warn(`Failed to update health status for tenant ${r.tenantId}:`, updateErr);
      }
    }

    // Insert into master_db_health_logs (non-blocking)
    if (logRows.length > 0) {
      try {
        await serviceClient.from('master_db_health_logs').insert(logRows);
      } catch (logErr) {
        console.warn('master_db_health_logs insert notice:', logErr);
      }
    }

    const onlineCount = pingResults.filter((r) => r.status === 'online').length;
    const failedCount = pingResults.filter((r) => r.status === 'sleeping' || r.status === 'error').length;

    return jsonResponse({
      success: true,
      message: `Keep-alive heartbeat executed. ${onlineCount} databases online, ${failedCount} sleeping/failed.`,
      timestamp: nowIso,
      masterDb: {
        status: 'online',
        latencyMs: masterLatency,
      },
      summary: {
        totalTenants: pingResults.length,
        onlineCount,
        failedCount,
        unconfiguredCount: pingResults.filter((r) => r.status === 'unconfigured').length,
      },
      results: pingResults,
    });
  } catch (err: any) {
    console.error('Keep-alive execution error:', err);
    return errorResponse(err?.message || 'Keep-alive pinger failed', 500);
  }
});

