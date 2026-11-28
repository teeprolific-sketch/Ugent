import { uid } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { audit, requireStaff } from '@/lib/staff';

/** Add a timeline update, record what users were told, or resolve. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, 'incidents.manage');
  const input = await body(req, z.object({ action: z.enum(['update', 'comms', 'resolve']), body: z.string().min(3).max(1000) }));
  const { id } = await ctx.params;
  const I = schema.incidents;
  const [inc] = await db.select().from(I).where(eq(I.id, id)).limit(1);
  if (!inc) throw new HttpError(404, 'No such incident.', 'not_found');
  if (inc.resolvedAt) throw new HttpError(409, 'This incident is resolved.', 'conflict');
  await db.transaction(async (tx) => {
    if (input.action === 'resolve') await tx.update(I).set({ status: 'resolved', resolvedAt: new Date() }).where(eq(I.id, id));
    if (input.action === 'comms') await tx.update(I).set({ userComms: input.body }).where(eq(I.id, id));
    if (input.action === 'update') await tx.update(I).set({ status: 'monitoring' }).where(eq(I.id, id));
    await tx.insert(schema.incidentUpdates).values({ id: 'iu_' + uid(), incidentId: id, staffId: staff.id, body: input.action === 'resolve' ? `Resolved: ${input.body}` : input.action === 'comms' ? `Users told: ${input.body}` : input.body });
    await audit(tx, staff, { action: `incident.${input.action}`, targetType: 'incident', targetId: id, reason: input.body });
  });
  return json({ ok: true, message: input.action === 'resolve' ? 'Incident resolved.' : 'Update added.' });
});
