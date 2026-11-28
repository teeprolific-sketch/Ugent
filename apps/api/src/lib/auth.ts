/* App sessions. Each install registers with a random device secret kept in the phone's secure storage
 * and gets a signed token. Phone-number sign-in can be layered on later without changing the API shape.
 */
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { db, schema } from './db';
import { HttpError } from './http';

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new HttpError(500, 'Server is missing AUTH_SECRET.', 'misconfigured');
  return new TextEncoder().encode(s);
};

/** The token carries the user's session version: staff bump it to sign the user out everywhere. */
export async function signToken(userId: string, sessionVersion = 0): Promise<string> {
  return new SignJWT({ sv: sessionVersion }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('365d').setIssuer('ugent').sign(secret());
}

export type User = typeof schema.users.$inferSelect;

/** Resolves the signed-in user from `Authorization: Bearer <token>`, or throws 401. */
export async function requireUser(req: Request): Promise<User> {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in again.', 'unauthorized');
  let sub: string | undefined;
  let sv = 0;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'ugent' });
    sub = payload.sub;
    sv = typeof payload.sv === 'number' ? payload.sv : 0;
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.', 'unauthorized');
  }
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, sub!)).limit(1);
  if (!user) throw new HttpError(401, 'This account no longer exists.', 'unauthorized');
  if (sv !== user.sessionVersion) throw new HttpError(401, 'You were signed out. Open Ugent again to continue.', 'signed_out');
  if (user.status === 'banned') throw new HttpError(403, 'This account has been closed. Contact Ugent support if you think this is a mistake.', 'account_banned');
  if (user.status === 'suspended') throw new HttpError(403, 'This account is paused while Ugent support looks into something. Contact support to find out more.', 'account_suspended');
  // Last seen, at most every 10 minutes, for "active users" counts.
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 600_000) {
    await db.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, user.id));
  }
  return user;
}

/** Short-lived signed value for OAuth round trips (proves who started the sign-in). */
export async function signState(userId: string, provider: string): Promise<string> {
  return new SignJWT({ provider }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('10m').setIssuer('ugent-oauth').sign(secret());
}
export async function verifyState(state: string): Promise<{ userId: string; provider: string }> {
  try {
    const { payload } = await jwtVerify(state, secret(), { issuer: 'ugent-oauth' });
    return { userId: payload.sub!, provider: String(payload.provider) };
  } catch {
    throw new HttpError(400, 'This sign-in link has expired. Start again from the app.', 'bad_state');
  }
}
