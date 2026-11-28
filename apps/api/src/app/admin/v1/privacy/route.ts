import { uid } from '@ugent/core';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { maskName } from '@/lib/adminview';
import { audit, needReason, requireStaff } from '@/lib/staff';
import { PRIVACY_DEADLINE_DAYS } from '@/lib/userdata';

/** Privacy requests (export, deletion, correction, consent withdrawal), soonest deadline first. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'privacy.view');
  const rows = await db.select().from(schema.dataRequests).orderBy(asc(schema.dataRequests.status), asc(schema.dataRequests.dueAt)).limit(100);
  const users = rows.length ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, [...new Set(rows.map((r) => r.userId))])) : [];
  return json({ requests: rows.map((r) => ({ ...r, userName: users.find((u) => u.id === r.userId) ? maskName(users.find((u) => u.id === r.userId)!.name) : 'Deleted user' })) });
});

/** Log a request a user made by email or WhatsApp, so its deadline is tracked. */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, 'privacy.process');
  const input = await body(req, z.object({ userId: z.string().max(60), type: z.enum(['export', 'deletion', 'correction', 'consent_withdrawal']), reason: z.string().max(500) }));
  const reason = needReason(input.reason);
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, input.userId)).limit(1);
  if (!u) throw new HttpError(404, 'No user with that ID.', 'not_found');
  const id = 'dr_' + uid();
  await db.transaction(async (tx) => {
    await tx.insert(schema.dataRequests).values({ id, userId: u.id, type: input.type, source: 'staff', dueAt: new Date(Date.now() + PRIVACY_DEADLINE_DAYS * 86400000) });
    await audit(tx, staff, { action: 'privacy.create', targetType: 'user', targetId: u.id, reason, after: { requestId: id, type: input.type } });
  });
  return json({ ok: true, id, message: `Logged. Due in ${PRIVACY_DEADLINE_DAYS} days.` }, 201);
});
