import { desc, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { requireStaff } from '@/lib/staff';

/** Changes waiting for a second person, and recent decisions. */
export const GET = handle(async (req: Request) => {
  const staff = await requireStaff(req, 'approvals.view');
  const rows = await db.select().from(schema.approvalRequests).orderBy(desc(schema.approvalRequests.createdAt)).limit(50);
  const ids = [...new Set(rows.flatMap((r) => [r.requestedBy, r.decidedBy].filter(Boolean) as string[]))];
  const names = ids.length ? await db.select({ id: schema.staffUsers.id, name: schema.staffUsers.name }).from(schema.staffUsers).where(inArray(schema.staffUsers.id, ids)) : [];
  const nameOf = (id: string | null) => names.find((n) => n.id === id)?.name ?? null;
  const now = Date.now();
  return json({ approvals: rows.map((r) => ({ ...r, status: r.status === 'pending' && r.expiresAt.getTime() < now ? 'expired' : r.status,
    requestedByName: nameOf(r.requestedBy), decidedByName: nameOf(r.decidedBy), mine: r.requestedBy === staff.id })) });
});
