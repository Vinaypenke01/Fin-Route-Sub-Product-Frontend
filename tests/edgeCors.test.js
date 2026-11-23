import { describe, it, expect, beforeEach } from 'vitest';

// The Edge Function helper reads Deno.env; provide a minimal stand-in.
const env = new Map();
globalThis.Deno = { env: { get: (k) => env.get(k) } };

const { isOriginAllowed, withCors, jsonResponse } = await import('../supabase/functions/_shared/cors.ts');

beforeEach(() => {
  env.set('ALLOWED_ORIGINS', 'https://sub-project.fin-route.site,http://localhost:5173,https://*--sub-project001.netlify.app');
});

describe('Edge Function CORS allowlist', () => {
  it('allows the live site, local dev and Netlify previews', () => {
    expect(isOriginAllowed('https://sub-project.fin-route.site')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('https://deploy-preview-12--sub-project001.netlify.app')).toBe(true);
  });

  it('rejects look-alike and unknown origins', () => {
    for (const o of [
      'https://evil.example',
      'https://sub-project.fin-route.site.evil.example',
      'https://x.evil--sub-project001.netlify.app',
      'http://sub-project.fin-route.site',
      null,
    ]) {
      expect(isOriginAllowed(o)).toBe(false);
    }
  });

  it('falls back to the live site + localhost when the secret is unset', () => {
    env.delete('ALLOWED_ORIGINS');
    expect(isOriginAllowed('https://sub-project.fin-route.site')).toBe(true);
    expect(isOriginAllowed('https://deploy-preview-1--sub-project001.netlify.app')).toBe(false);
  });

  it('adds the header only for allowed origins and answers preflight', async () => {
    const handler = withCors(async () => jsonResponse({ ok: true }));
    const ok = await handler(new Request('https://f/', { method: 'POST', headers: { Origin: 'https://sub-project.fin-route.site' } }));
    const bad = await handler(new Request('https://f/', { method: 'POST', headers: { Origin: 'https://evil.example' } }));
    const pre = await handler(new Request('https://f/', { method: 'OPTIONS', headers: { Origin: 'https://sub-project.fin-route.site' } }));

    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://sub-project.fin-route.site');
    expect(await ok.json()).toEqual({ ok: true });
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(pre.status).toBe(204);
  });
});
