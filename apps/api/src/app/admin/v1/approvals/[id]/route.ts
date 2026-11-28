import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { invalidateSwitches } from '@/lib/policy';
import { audit, needReason, requireStaff } from '@/lib/staff';

/** Approve or reject. The person who asked can never approve their own request. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, 'approvals.decide');
  const { decision, reason: r } = await body(req, z.object({ decision: z.enum(['approve', 'reject']), reason: z.string().max(500) }));
  const reason = needReason(r);
  const { id } = await ctx.params;
  const R = schema.approvalRequests;
  const [a] = await db.select().from(R).where(eq(R.id, id)).limit(1);
  if (!a) throw new HttpError(404, 'No such approval request.', 'not_found');
  if (a.status !== 'pending') throw new HttpError(409, 'This request has already been decided.', 'conflict');
  if (a.expiresAt.getTime() < Date.now()) throw new HttpError(409, 'This request expired. Ask for it again.', 'expired');
  if (a.requestedBy === staff.id) throw new HttpError(403, 'You made this request, so someone else must approve it.', 'own_request');
  await db.transaction(async (tx) => {
    const updated = await tx.update(R).set({ status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: staff.id, decisionReason: reason, decidedAt: new Date() })
      .where(and(eq(R.id, id), eq(R.status, 'pending'))).returning({ id: R.id });
    if (!updated.length) throw new HttpError(409, 'This request has already been decided.', 'conflict');
    if (decision === 'approve' && a.type === 'enable_action_type') {
      const key = String((a.payload as { key: string }).key);
      await tx.insert(schema.enabledActionTypes).values({ key, enabledBy: staff.id, approvalId: a.id }).onConflictDoNothing();
    }
    await audit(tx, staff, { action: `approval.${decision}`, targetType: 'approval', targetId: id, reason, before: { status: 'pending' }, after: { status: decision === 'approve' ? 'approved' : 'rejected', type: a.type, payload: a.payload } });
  });
  invalidateSwitches();
  return json({ ok: true, message: decision === 'approve' ? 'Approved. The change is live.' : 'Rejected.' });
});
