import { uid } from '@ugent/core';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { maskContact, maskName, redactTicket } from '@/lib/adminview';
import { audit, needReason, requireStaff } from '@/lib/staff';

async function load(id: string) {
  const [t] = await db.select().from(schema.supportRequests).where(eq(schema.supportRequests.id, id)).limit(1);
  if (!t) throw new HttpError(404, 'No such ticket.', 'not_found');
  return t;
}

/** A ticket: redacted message, masked contact, the user's plan and recent agent activity, and staff replies. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireStaff(req, 'support.view');
  const t = await load((await ctx.params).id);
  const [[u], replies, activity] = await Promise.all([
    db.select().from(schema.users).where(eq(schema.users.id, t.userId)).limit(1),
    db.select().from(schema.ticketMessages).where(eq(schema.ticketMessages.ticketId, t.id)).orderBy(asc(schema.ticketMessages.createdAt)),
    db.select().from(schema.actionEvents).where(eq(schema.actionEvents.userId, t.userId)).orderBy(desc(schema.actionEvents.at)).limit(8),
  ]);
  return json({
    ticket: { id: t.id, topic: t.topic, status: t.status, priority: t.priority, assignedTo: t.assignedTo, createdAt: t.createdAt,
      message: redactTicket(t.message, u?.name ?? ''), contact: maskContact(t.contact) },
    user: u ? { id: u.id, name: maskName(u.name), plan: u.plan, status: u.status, lang: u.lang } : null,
    replies, activity,
  });
});

const Act = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reply'), body: z.string().min(1).max(4000) }),
  z.object({ action: z.literal('status'), status: z.enum(['open', 'waiting', 'closed']), reason: z.string().max(500) }),
  z.object({ action: z.literal('priority'), priority: z.enum(['low', 'normal', 'high']), reason: z.string().max(500) }),
  z.object({ action: z.literal('assign_me') }),
]);

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, 'support.reply');
  const input = await body(req, Act);
  const t = await load((await ctx.params).id);
  const T = schema.supportRequests;
  await db.transaction(async (tx) => {
    if (input.action === 'reply') {
      await tx.insert(schema.ticketMessages).values({ id: 'tm_' + uid(), ticketId: t.id, staffId: staff.id, body: input.body.trim() });
      if (t.status === 'open') await tx.update(T).set({ status: 'waiting' }).where(eq(T.id, t.id));
      await audit(tx, staff, { action: 'ticket.reply', targetType: 'ticket', targetId: t.id, reason: 'Replied to the user' });
    } else if (input.action === 'status') {
      const reason = needReason(input.reason);
      await tx.update(T).set({ status: input.status }).where(eq(T.id, t.id));
      await audit(tx, staff, { action: 'ticket.status', targetType: 'ticket', targetId: t.id, reason, before: { status: t.status }, after: { status: input.status } });
    } else if (input.action === 'priority') {
      const reason = needReason(input.reason);
      await tx.update(T).set({ priority: input.priority }).where(eq(T.id, t.id));
      await audit(tx, staff, { action: 'ticket.priority', targetType: 'ticket', targetId: t.id, reason, before: { priority: t.priority }, after: { priority: input.priority } });
    } else {
      await tx.update(T).set({ assignedTo: staff.id }).where(eq(T.id, t.id));
      await audit(tx, staff, { action: 'ticket.assign', targetType: 'ticket', targetId: t.id, reason: 'Took the ticket', after: { assignedTo: staff.id } });
    }
  });
  return json({ ok: true, message: input.action === 'reply' ? 'Reply saved. The ticket now waits for the user.' : 'Ticket updated.' });
});
