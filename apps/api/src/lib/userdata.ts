/* A user's server-side data: export it, or delete it. Used by the app (DELETE /api/me, GET /api/me/export)
 * and by staff processing a privacy request, so both follow exactly the same rules. */
import { and, eq } from 'drizzle-orm';
import type { User } from './auth';
import { db, schema } from './db';
import { leaveTeam } from './team';

/** Days to complete a privacy request. */
export const PRIVACY_DEADLINE_DAYS = 30;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Removes the account and everything it owns. Activity and usage records are anonymised (kept for totals only). */
export async function deleteUserData(tx: Tx, user: User) {
  if (user.teamId) await leaveTeam(tx, user);
  await tx.delete(schema.tasks).where(eq(schema.tasks.ownerId, user.id));
  await tx.delete(schema.events).where(eq(schema.events.ownerId, user.id));
  await tx.delete(schema.connections).where(eq(schema.connections.userId, user.id));
  await tx.delete(schema.waBusiness).where(eq(schema.waBusiness.userId, user.id));
  await tx.delete(schema.waInbox).where(eq(schema.waInbox.userId, user.id));
  await tx.delete(schema.waitlist).where(eq(schema.waitlist.userId, user.id));
  await tx.delete(schema.supportRequests).where(eq(schema.supportRequests.userId, user.id));
  await tx.delete(schema.userNotes).where(eq(schema.userNotes.userId, user.id));
  await tx.update(schema.actionEvents).set({ userId: 'deleted' }).where(eq(schema.actionEvents.userId, user.id));
  await tx.update(schema.usageRecords).set({ userId: 'deleted' }).where(eq(schema.usageRecords.userId, user.id));
  await tx.delete(schema.users).where(and(eq(schema.users.id, user.id)));
}

/** Everything the server holds about a user, in plain JSON. OAuth tokens are never included. */
export async function exportUserData(user: User) {
  const [tasks, events, connections, wa, waitlist, support, requests] = await Promise.all([
    db.select().from(schema.tasks).where(eq(schema.tasks.ownerId, user.id)),
    db.select().from(schema.events).where(eq(schema.events.ownerId, user.id)),
    db.select({ provider: schema.connections.provider, account: schema.connections.account, scopes: schema.connections.scopes, connectedAt: schema.connections.createdAt })
      .from(schema.connections).where(eq(schema.connections.userId, user.id)),
    db.select().from(schema.waInbox).where(eq(schema.waInbox.userId, user.id)),
    db.select().from(schema.waitlist).where(eq(schema.waitlist.userId, user.id)),
    db.select().from(schema.supportRequests).where(eq(schema.supportRequests.userId, user.id)),
    db.select().from(schema.dataRequests).where(eq(schema.dataRequests.userId, user.id)),
  ]);
  const { deviceId: _secret, ...account } = user;
  return { exportedAt: new Date().toISOString(), account, tasks, events, connections, whatsappBusinessInbox: wa, waitlist, supportRequests: support, privacyRequests: requests,
    note: 'Chats, memory, notes and habits are stored only on your phone. Export them from Privacy and data in the app.' };
}
