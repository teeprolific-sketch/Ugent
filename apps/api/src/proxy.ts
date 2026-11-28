import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/* Two jobs:
 * 1. CORS for browser clients. The user app's web build uses ALLOWED_ORIGINS; the admin console uses ADMIN_ALLOWED_ORIGINS.
 *    The phone apps do not need CORS.
 * 2. Keep the admin API (/admin/*) off the public internet:
 *    - it answers only when STAFF_AUTH_SECRET is set (otherwise 404, as if it didn't exist),
 *    - only on ADMIN_API_HOST when that is set (e.g. admin-api.ugent.app),
 *    - only from ADMIN_IP_ALLOWLIST when that is set (office, VPN or zero-trust proxy addresses).
 *    Staff still need their own access key and the right role for every request.
 */
export function proxy(req: NextRequest) {
  const isAdmin = req.nextUrl.pathname.startsWith('/admin/');
  if (isAdmin) {
    const host = (req.headers.get('host') ?? '').split(':')[0];
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
    const adminHost = process.env.ADMIN_API_HOST;
    const ips = list(process.env.ADMIN_IP_ALLOWLIST);
    if (!process.env.STAFF_AUTH_SECRET || (adminHost && host !== adminHost) || (ips.length && !ips.includes(ip))) {
      return new NextResponse('Not found', { status: 404 });
    }
  } else if (process.env.ADMIN_API_HOST && (req.headers.get('host') ?? '').split(':')[0] === process.env.ADMIN_API_HOST) {
    // The admin hostname serves the admin API only.
    return new NextResponse('Not found', { status: 404 });
  }

  const origin = req.headers.get('origin');
  const allowed = list(isAdmin ? process.env.ADMIN_ALLOWED_ORIGINS : process.env.ALLOWED_ORIGINS);
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
  if (isAdmin) { res.headers.set('cache-control', 'no-store'); res.headers.set('x-robots-tag', 'noindex'); }
  return res;
}

export const config = { matcher: ['/api/:path*', '/admin/:path*'] };
