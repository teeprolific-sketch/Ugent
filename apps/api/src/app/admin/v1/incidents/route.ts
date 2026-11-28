import { uid } from '@ugent/core';
import { asc, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { audit, needReason, requireStaff } from '@/lib/staff';

export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'incidents.view');
  const rows = await db.select().from(schema.incidents).orderBy(desc(schema.incidents.startedAt)).limit(50);
  const updates = rows.length ? await db.select().from(schema.incidentUpdates).where(inArray(schema.incidentUpdates.incidentId, rows.map((r) => r.id))).orderBy(asc(schema.incidentUpdates.at)) : [];
  const staff = await db.select({ id: schema.staffUsers.id, name: schema.staffUsers.name }).from(schema.staffUsers);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? 'Unknown';
  return json({ incidents: rows.map((i) => ({ ...i, ownerName: nameOf(i.ownerId), updates: updates.filter((u) => u.incidentId === i.id).map((u) => ({ ...u, by: nameOf(u.staffId) })) })) });
});

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, 'incidents.manage');
  const input = await body(req, z.object({ title: z.string().min(3).max(200), severity: z.enum(['SEV-1', 'SEV-2', 'SEV-3']), components: z.string().max(200).default(''), reason: z.string().max(500) }));
  const reason = needReason(input.reason);
  const [{ n }] = await db.select({ n: schema.incidents.id }).from(schema.incidents).orderBy(desc(schema.incidents.startedAt)).limit(1).then((r) => (r.length ? r : [{ n: 'INC-0' }]));
  const id = `INC-${(Number(String(n).split('-')[1]) || 0) + 1}`;
  await db.transaction(async (tx) => {
    await tx.insert(schema.incidents).values({ id, title: input.title, severity: input.severity, components: input.components, ownerId: staff.id });
    await tx.insert(schema.incidentUpdates).values({ id: 'iu_' + uid(), incidentId: id, staffId: staff.id, body: `Opened: ${reason}` });
    await audit(tx, staff, { action: 'incident.create', targetType: 'incident', targetId: id, reason, after: { severity: input.severity } });
  });
  return json({ ok: true, id, message: `${id} opened. You are the owner.` }, 201);
});
