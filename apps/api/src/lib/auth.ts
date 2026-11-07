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

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('365d').setIssuer('ugent').sign(secret());
}

export type User = typeof schema.users.$inferSelect;

/** Resolves the signed-in user from `Authorization: Bearer <token>`, or throws 401. */
export async function requireUser(req: Request): Promise<User> {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in again.', 'unauthorized');
  let sub: string | undefined;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'ugent' });
    sub = payload.sub;
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.', 'unauthorized');
  }
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, sub!)).limit(1);
  if (!user) throw new HttpError(401, 'This account no longer exists.', 'unauthorized');
  return user;
}
