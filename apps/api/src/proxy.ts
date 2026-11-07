import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/* CORS for browser clients (the web build of the app, local previews). The phone apps do not need it.
 * Allowed origins come from ALLOWED_ORIGINS, a comma-separated list. Unlisted origins get no CORS headers.
 */
export function proxy(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = !!origin && allowed.includes(origin);
  const headers: Record<string, string> = ok ? {
    'access-control-allow-origin': origin!,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  } : {};
  if (req.method === 'OPTIONS') return new NextResponse(null, { status: ok ? 204 : 403, headers });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: '/api/:path*' };
