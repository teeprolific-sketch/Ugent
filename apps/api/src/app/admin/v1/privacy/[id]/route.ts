import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { audit, needReason, requireStaff } from '@/lib/staff';
import { deleteUserData } from '@/lib/userdata';

/** Process a privacy request. Deletion runs the same workflow as the in-app "Delete my account". */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, 'privacy.process');
  const input = await body(req, z.object({ action: z.enum(['complete', 'run_deletion', 'reject']), reason: z.string().max(500) }));
  const reason = needReason(input.reason);
  const { id } = await ctx.params;
  const D = schema.dataRequests;
  const [r] = await db.select().from(D).where(eq(D.id, id)).limit(1);
  if (!r) throw new HttpError(404, 'No such request.', 'not_found');
  if (r.status !== 'open') throw new HttpError(409, 'This request is already closed.', 'conflict');
  let message = 'Request closed.';
  await db.transaction(async (tx) => {
    if (input.action === 'run_deletion') {
      if (r.type !== 'deletion') throw new HttpError(400, 'Only deletion requests can run the deletion workflow.', 'invalid');
      const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, r.userId)).limit(1);
      if (u) await deleteUserData(tx, u);
      message = u ? 'Deleted. The account and its server data are gone; activity totals were anonymised.' : 'This account was already deleted.';
    }
    await tx.update(D).set({ status: input.action === 'reject' ? 'rejected' : 'done', completedAt: new Date() }).where(eq(D.id, r.id));
    await audit(tx, staff, { action: `privacy.${input.action}`, targetType: 'user', targetId: r.userId, reason, before: { status: 'open', type: r.type }, after: { status: input.action === 'reject' ? 'rejected' : 'done' } });
  });
  return json({ ok: true, message });
});
