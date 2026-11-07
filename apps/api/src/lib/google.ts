/* Google sign-in for Calendar, Gmail and Tasks (read-only). Tokens stay on the server.
 * Needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PUBLIC_URL (this server's https address).
 * In Google Cloud Console, add `${PUBLIC_URL}/api/integrations/google/callback` as a redirect URI.
 */
import { and, eq } from 'drizzle-orm';
import { db, schema } from './db';
import { HttpError } from './http';

export const GOOGLE_PROVIDERS = {
  googleCalendar: 'https://www.googleapis.com/auth/calendar.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  googleTasks: 'https://www.googleapis.com/auth/tasks.readonly',
} as const;
export type GoogleProvider = keyof typeof GOOGLE_PROVIDERS;
export const isGoogleProvider = (p: string): p is GoogleProvider => p in GOOGLE_PROVIDERS;

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.PUBLIC_URL);
export const redirectUri = () => `${process.env.PUBLIC_URL!.replace(/\/$/, '')}/api/integrations/google/callback`;

export function authUrl(provider: GoogleProvider, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: `openid email ${GOOGLE_PROVIDERS[provider]}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

interface TokenResponse { access_token: string; refresh_token?: string; expires_in: number; scope: string; id_token?: string }

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }),
  });
  if (!res.ok) throw new HttpError(502, 'Google did not accept the sign-in. Try connecting again.', 'google_token');
  return res.json() as Promise<TokenResponse>;
}

export async function exchangeCode(code: string) {
  const tok = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
  let account: string | null = null;
  if (tok.id_token) {
    try { account = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString()).email ?? null; } catch { account = null; }
  }
  return { ...tok, account };
}

/** A valid access token for the user's connection, refreshing it when it has expired. */
export async function accessToken(userId: string, provider: GoogleProvider): Promise<string> {
  const [c] = await db.select().from(schema.connections)
    .where(and(eq(schema.connections.userId, userId), eq(schema.connections.provider, provider))).limit(1);
  if (!c) throw new HttpError(404, 'Connect this Google service first.', 'not_connected');
  if (c.expiresAt && c.expiresAt.getTime() > Date.now() + 60000) return c.accessToken;
  if (!c.refreshToken) throw new HttpError(401, 'Google needs you to connect again.', 'reconnect');
  const tok = await tokenRequest({ refresh_token: c.refreshToken, grant_type: 'refresh_token' });
  await db.update(schema.connections).set({ accessToken: tok.access_token, expiresAt: new Date(Date.now() + tok.expires_in * 1000) })
    .where(and(eq(schema.connections.userId, userId), eq(schema.connections.provider, provider)));
  return tok.access_token;
}

export async function googleGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new HttpError(401, 'Google needs you to connect again.', 'reconnect');
  if (!res.ok) throw new HttpError(502, 'Google is not answering right now. Try again soon.', 'google_error');
  return res.json() as Promise<T>;
}

/** Wall-clock date and time of an instant in a time zone ("2026-11-07", "14:30"). */
export function localParts(iso: string, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
