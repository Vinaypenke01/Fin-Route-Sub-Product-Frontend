// ==============================================================================
// CORS: Origin Allowlist & Response Helpers for Supabase Edge Functions
// ==============================================================================
// Allowed browser origins come from the ALLOWED_ORIGINS secret (comma-separated).
// A '*' inside an entry matches any run of characters, e.g.
//   https://sub-project.fin-route.site,https://*--sub-project001.netlify.app
// Requests from other origins get no Access-Control-Allow-Origin header, so
// browsers block them. Server-to-server calls (no Origin header) are unaffected.

declare const Deno: any;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://sub-project.fin-route.site',
  'http://localhost:5173',
];

const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Vary': 'Origin',
};

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function getAllowedOriginPatterns(): RegExp[] {
  const raw = (Deno.env.get('ALLOWED_ORIGINS') || '').trim();
  const entries = raw
    ? raw.split(',').map((s: string) => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  return entries.map((entry: string) =>
    new RegExp('^' + entry.split('*').map(escapeRegex).join('[a-z0-9-]*') + '$', 'i')
  );
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return getAllowedOriginPatterns().some((re) => re.test(origin));
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (isOriginAllowed(origin)) {
    return { ...BASE_CORS_HEADERS, 'Access-Control-Allow-Origin': origin as string };
  }
  return { ...BASE_CORS_HEADERS };
}

/**
 * Wraps an Edge Function handler: answers preflight requests and adds the
 * per-request CORS headers to every response the handler returns.
 */
export function withCors(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const cors = corsHeadersFor(req);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}

/** Kept for compatibility: preflight is now answered by withCors. */
export function handleCors(_req: Request): Response | null {
  return null;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      message,
      ...extra,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
