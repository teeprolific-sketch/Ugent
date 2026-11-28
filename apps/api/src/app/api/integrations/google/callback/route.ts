import { sql } from 'drizzle-orm';
import { verifyState } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { exchangeCode, isGoogleProvider } from '@/lib/google';
import { logError } from '@/lib/http';

const back = (q: string) => Response.redirect(`ugent://connections?${q}`, 302);

/** Google sends the user back here; we store the tokens and return to the app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error') || !code || !state) return back('error=cancelled');
  try {
    const { userId, provider } = await verifyState(state);
    if (!isGoogleProvider(provider)) return back('error=unknown');
    const tok = await exchangeCode(code);
    const row = {
      userId, provider, account: tok.account, accessToken: tok.access_token, refreshToken: tok.refresh_token ?? null,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000), scopes: tok.scope,
    };
    await db.insert(schema.connections).values(row).onConflictDoUpdate({
      target: [schema.connections.userId, schema.connections.provider],
      set: { ...row, refreshToken: sql`coalesce(excluded.refresh_token, ${schema.connections.refreshToken})` },
    });
    return back(`connected=${provider}`);
  } catch (e) {
    logError('google-callback', e);
    return back('error=failed');
  }
}
