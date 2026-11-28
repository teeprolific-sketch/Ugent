import type { Permission } from '@ugent/core';
import { maskPhone, TRUST_LEVELS, uid } from '@ugent/core';
import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { userRow } from '@/lib/adminview';
import { audit, needReason, requireStaff } from '@/lib/staff';

async function load(id: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!u) throw new HttpError(404, 'No user with that ID.', 'not_found');
  return u;
}

/** One user's profile: counts, connected services (names only), notes and recent activity. Never content. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireStaff(req, 'users.view');
  const u = await load((await ctx.params).id);
  const [[tasks], [events], conns, [wa], [tickets], notes, activity, requests] = await Promise.all([
    db.select({ n: count() }).from(schema.tasks).where(eq(schema.tasks.ownerId, u.id)),
    db.select({ n: count() }).from(schema.events).where(eq(schema.events.ownerId, u.id)),
    db.select({ provider: schema.connections.provider, since: schema.connections.createdAt }).from(schema.connections).where(eq(schema.connections.userId, u.id)),
    db.select().from(schema.waBusiness).where(eq(schema.waBusiness.userId, u.id)).limit(1),
    db.select({ n: count() }).from(schema.supportRequests).where(eq(schema.supportRequests.userId, u.id)),
    db.select().from(schema.userNotes).where(eq(schema.userNotes.userId, u.id)).orderBy(desc(schema.userNotes.createdAt)).limit(20),
    db.select().from(schema.actionEvents).where(eq(schema.actionEvents.userId, u.id)).orderBy(desc(schema.actionEvents.at)).limit(15),
    db.select().from(schema.dataRequests).where(eq(schema.dataRequests.userId, u.id)).orderBy(desc(schema.dataRequests.createdAt)).limit(10),
  ]);
  return json({
    user: { ...userRow(u), chatsToday: u.chatCount, teamId: u.teamId, planExpiresAt: u.planExpiresAt },
    counts: { tasks: tasks.n, plans: events.n, tickets: tickets.n },
    connected: [...conns.map((c) => c.provider), ...(wa ? [`whatsappBusiness (${maskPhone(wa.displayNumber) || 'number hidden'})`] : [])],
    trust: { level: u.trustLevel, levels: TRUST_LEVELS },
    notes, activity, privacyRequests: requests,
    onPhoneOnly: 'Chats, memory, notes and habits are stored only on the user\'s phone and are never visible here.',
  });
});

const Act = z.object({
  action: z.enum(['suspend', 'restore', 'ban', 'logout', 'disconnect', 'trust_lower', 'note']),
  reason: z.string().max(500),
  note: z.string().max(1000).optional(),
});
const PERM: Record<z.infer<typeof Act>['action'], Permission> = {
  suspend: 'users.suspend', restore: 'users.suspend', ban: 'users.ban', logout: 'users.logout', disconnect: 'users.disconnect', trust_lower: 'users.trust_lower', note: 'users.note',
};

/** Real actions on an account. Each needs the right role and a reason, and is audit-logged in the same transaction. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const input = await body(req, Act);
  const staff = await requireStaff(req, PERM[input.action]);
  const reason = needReason(input.reason);
  const u = await load((await ctx.params).id);
  const U = schema.users;
  const before = { status: u.status, trustLevel: u.trustLevel, sessionVersion: u.sessionVersion };
  let after: Record<string, unknown> = {};
  let message = '';
  await db.transaction(async (tx) => {
    switch (input.action) {
      case 'suspend':
        if (u.status !== 'active') throw new HttpError(409, 'This account is not active.', 'conflict');
        // Suspending also signs the user out everywhere.
        await tx.update(U).set({ status: 'suspended', sessionVersion: u.sessionVersion + 1 }).where(eq(U.id, u.id));
        after = { status: 'suspended' }; message = 'Account suspended and signed out on every device.'; break;
      case 'restore':
        if (u.status === 'active') throw new HttpError(409, 'This account is already active.', 'conflict');
        if (u.status === 'banned' && !staff.roles.some((r) => r === 'super' || r === 'tns')) throw new HttpError(403, 'Only Trust & Safety or a Super Admin can lift a ban.', 'forbidden');
        await tx.update(U).set({ status: 'active' }).where(eq(U.id, u.id));
        after = { status: 'active' }; message = 'Account restored.'; break;
      case 'ban':
        if (u.status === 'banned') throw new HttpError(409, 'This account is already banned.', 'conflict');
        await tx.update(U).set({ status: 'banned', sessionVersion: u.sessionVersion + 1 }).where(eq(U.id, u.id));
        after = { status: 'banned' }; message = 'Account banned and signed out on every device.'; break;
      case 'logout':
        await tx.update(U).set({ sessionVersion: u.sessionVersion + 1 }).where(eq(U.id, u.id));
        after = { sessionVersion: u.sessionVersion + 1 }; message = 'Signed out on every device. The app signs in again on next open.'; break;
      case 'disconnect': {
        const removed = await tx.delete(schema.connections).where(eq(schema.connections.userId, u.id)).returning({ provider: schema.connections.provider });
        after = { disconnected: removed.map((r) => r.provider) }; message = removed.length ? `Disconnected ${removed.length} service${removed.length > 1 ? 's' : ''}.` : 'Nothing was connected.'; break;
      }
      case 'trust_lower':
        if (u.trustLevel <= 0) throw new HttpError(409, 'This user is already at the lowest level.', 'conflict');
        await tx.update(U).set({ trustLevel: u.trustLevel - 1 }).where(eq(U.id, u.id));
        after = { trustLevel: u.trustLevel - 1 }; message = `Trust level lowered to ${u.trustLevel - 1}.`; break;
      case 'note': {
        const note = (input.note ?? '').trim();
        if (!note) throw new HttpError(400, 'Write the note.', 'invalid');
        await tx.insert(schema.userNotes).values({ id: 'note_' + uid(), userId: u.id, staffId: staff.id, note });
        after = { note: true }; message = 'Note added.'; break;
      }
    }
    await audit(tx, staff, { action: `user.${input.action}`, targetType: 'user', targetId: u.id, reason, before, after });
  });
  return json({ ok: true, message });
});
