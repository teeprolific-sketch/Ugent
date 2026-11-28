/* Staff sign-in for the admin console.
 * Each staff member signs in with a personal access key ("ugk_<prefix>_<secret>"). Only a SHA-256 hash is stored,
 * the key is shown once when issued, and it can be revoked at any time. Signing in creates a staff session
 * (12 hours, ended after 30 minutes idle) with its own signing key, separate from user sessions.
 * Every admin request goes through requireStaff(), which checks the session and the role's permission on the server. */
import type { Permission, StaffRole } from '@ugent/core';
import { STAFF_ROLES, staffCan, uid } from '@ugent/core';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, schema } from './db';
import { HttpError } from './http';

const SESSION_HOURS = 12;
const IDLE_MINUTES = 30;

const secret = () => {
  const s = process.env.STAFF_AUTH_SECRET;
  if (!s || s.length < 32) throw new HttpError(503, 'The admin console is not set up on this server (STAFF_AUTH_SECRET).', 'admin_disabled');
  return new TextEncoder().encode(s);
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const B32 = 'abcdefghijkmnpqrstuvwxyz23456789'; // no look-alike characters
const randomText = (n: number) => Array.from(randomBytes(n), (b) => B32[b % B32.length]).join('');

/** Issues a new access key for a staff member. Returns the key once; it is never stored or shown again. */
export async function issueAccessKey(staffId: string, createdBy: string | null, label = '', expiresInDays: number | null = 180, tx = db) {
  const prefix = randomText(8);
  const key = `ugk_${prefix}_${randomText(32)}`;
  const id = 'key_' + uid();
  await tx.insert(schema.staffAccessKeys).values({
    id, staffId, prefix, keyHash: sha256(key), label, createdBy,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
  });
  return { id, key, prefix };
}

/* Sign-in attempts per IP address, to slow down guessing. Kept in memory: per server instance. */
const attempts = new Map<string, { n: number; until: number }>();
function throttle(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.until > now && a.n >= 8) throw new HttpError(429, 'Too many sign-in attempts. Wait 15 minutes and try again.', 'rate_limited');
  attempts.set(ip, a && a.until > now ? { n: a.n + 1, until: a.until } : { n: 1, until: now + 15 * 60000 });
}

export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

export async function signIn(accessKey: string, req: Request) {
  const ip = clientIp(req);
  throttle(ip);
  const m = /^ugk_([a-z2-9]{8})_[a-z2-9]{32}$/.exec(accessKey.trim());
  const fail = () => new HttpError(401, 'That access key is not valid. Check it, or ask a Super Admin for a new one.', 'bad_key');
  if (!m) throw fail();
  const [key] = await db.select().from(schema.staffAccessKeys).where(eq(schema.staffAccessKeys.prefix, m[1])).limit(1);
  if (!key) throw fail();
  const a = Buffer.from(sha256(accessKey.trim())), b = Buffer.from(key.keyHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail();
  if (key.revokedAt) throw new HttpError(401, 'This access key has been revoked. Ask a Super Admin for a new one.', 'key_revoked');
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) throw new HttpError(401, 'This access key has expired. Ask a Super Admin for a new one.', 'key_expired');
  const [staff] = await db.select().from(schema.staffUsers).where(eq(schema.staffUsers.id, key.staffId)).limit(1);
  if (!staff || staff.disabledAt) throw new HttpError(403, 'This staff account is disabled.', 'staff_disabled');
  attempts.delete(ip);
  const sid = 'ss_' + uid();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000);
  await db.insert(schema.staffSessions).values({ id: sid, staffId: staff.id, keyId: key.id, ip, userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null, expiresAt });
  await db.update(schema.staffAccessKeys).set({ lastUsedAt: new Date() }).where(eq(schema.staffAccessKeys.id, key.id));
  const token = await new SignJWT({ sid }).setProtectedHeader({ alg: 'HS256' }).setSubject(staff.id).setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`).setIssuer('ugent-admin').sign(secret());
  return { token, staff: await staffProfile(staff.id), expiresAt };
}

export async function staffProfile(staffId: string) {
  const [staff] = await db.select().from(schema.staffUsers).where(eq(schema.staffUsers.id, staffId)).limit(1);
  const roles = (await db.select().from(schema.staffRoles).where(eq(schema.staffRoles.staffId, staffId)))
    .map((r) => r.role).filter((r): r is StaffRole => (STAFF_ROLES as readonly string[]).includes(r));
  return { id: staffId, name: staff?.name ?? '', roles };
}

export interface StaffContext { id: string; name: string; roles: StaffRole[]; role: StaffRole; sessionId: string; ip: string; userAgent: string | null }

/** Checks the staff session and that one of the staff member's roles allows `perm`. Throws 401 or 403. */
export async function requireStaff(req: Request, perm: Permission | null): Promise<StaffContext> {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in with your access key.', 'unauthorized');
  let sub = '', sid = '';
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'ugent-admin' });
    sub = payload.sub ?? ''; sid = String(payload.sid ?? '');
  } catch { throw new HttpError(401, 'Your admin session has ended. Sign in again.', 'unauthorized'); }
  const now = new Date();
  const [session] = await db.select().from(schema.staffSessions)
    .where(and(eq(schema.staffSessions.id, sid), eq(schema.staffSessions.staffId, sub), isNull(schema.staffSessions.revokedAt), gt(schema.staffSessions.expiresAt, now))).limit(1);
  if (!session) throw new HttpError(401, 'Your admin session has ended. Sign in again.', 'unauthorized');
  if (now.getTime() - session.lastSeenAt.getTime() > IDLE_MINUTES * 60000) {
    await db.update(schema.staffSessions).set({ revokedAt: now }).where(eq(schema.staffSessions.id, sid));
    throw new HttpError(401, `Signed out after ${IDLE_MINUTES} minutes without activity. Sign in again.`, 'idle_timeout');
  }
  const [key] = await db.select().from(schema.staffAccessKeys).where(eq(schema.staffAccessKeys.id, session.keyId)).limit(1);
  if (!key || key.revokedAt) throw new HttpError(401, 'The access key for this session was revoked. Sign in with a new key.', 'key_revoked');
  const profile = await staffProfile(sub);
  const [staff] = await db.select().from(schema.staffUsers).where(eq(schema.staffUsers.id, sub)).limit(1);
  if (!staff || staff.disabledAt) throw new HttpError(403, 'This staff account is disabled.', 'staff_disabled');
  if (perm && !staffCan(profile.roles, perm)) throw new HttpError(403, 'Your role can\'t do this.', 'forbidden');
  if (now.getTime() - session.lastSeenAt.getTime() > 60000) await db.update(schema.staffSessions).set({ lastSeenAt: now }).where(eq(schema.staffSessions.id, sid));
  // The role recorded in the audit log: the first of the staff member's roles that grants this permission.
  const role = (perm ? profile.roles.find((r) => staffCan([r], perm)) : profile.roles[0]) ?? profile.roles[0] ?? 'analyst';
  return { ...profile, role, sessionId: sid, ip: clientIp(req), userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null };
}

export async function signOut(ctx: StaffContext) {
  await db.update(schema.staffSessions).set({ revokedAt: new Date() }).where(eq(schema.staffSessions.id, ctx.sessionId));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Writes one audit entry. Call inside the same transaction as the change, so neither can happen without the other. */
export async function audit(tx: Tx | typeof db, ctx: StaffContext, e: { action: string; targetType: string; targetId: string; reason: string; before?: unknown; after?: unknown }) {
  await tx.insert(schema.auditLog).values({
    id: 'au_' + uid(), staffId: ctx.id, role: ctx.role, action: e.action, targetType: e.targetType, targetId: e.targetId, reason: e.reason,
    before: e.before ?? null, after: e.after ?? null, ip: ctx.ip, userAgent: ctx.userAgent,
  });
}

/** Sensitive actions need a written reason. */
export function needReason(reason: unknown): string {
  const r = typeof reason === 'string' ? reason.trim() : '';
  if (r.length < 5) throw new HttpError(400, 'Write a short reason (at least 5 characters). It is saved in the audit log.', 'reason_required');
  return r.slice(0, 500);
}
