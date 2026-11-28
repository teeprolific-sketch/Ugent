import { and, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { requireStaff } from '@/lib/staff';

/** The audit log, newest first. Read-only: the database itself refuses edits and deletions. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'audit.view');
  const q = new URL(req.url).searchParams;
  const L = schema.auditLog;
  const where: SQL[] = [];
  const view = q.get('view');
  if (view === 'controls') where.push(or(like(L.action, 'controls.%'), like(L.action, 'approval.%'))!);
  if (view === 'users') where.push(eq(L.targetType, 'user'));
  if (view === 'staff') where.push(like(L.action, 'staff.%'));
  if (view === 'money') where.push(like(L.action, 'config.%'));
  const target = q.get('target');
  if (target) where.push(eq(L.targetId, target));
  const rows = await db.select().from(L).where(where.length ? and(...where) : undefined).orderBy(desc(L.at)).limit(200);
  const ids = [...new Set(rows.map((r) => r.staffId))];
  const names = ids.length ? await db.select({ id: schema.staffUsers.id, name: schema.staffUsers.name }).from(schema.staffUsers).where(inArray(schema.staffUsers.id, ids)) : [];
  return json({ entries: rows.map((r) => ({ ...r, staffName: names.find((n) => n.id === r.staffId)?.name ?? r.staffId })) });
});
