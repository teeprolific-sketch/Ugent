import { and, desc, eq, gte, type SQL } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { since } from '@/lib/adminview';
import { requireStaff } from '@/lib/staff';

/** What the agent proposed and did, newest first. Summaries are templates: no message text, names or numbers. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'activity.view');
  const q = new URL(req.url).searchParams;
  const A = schema.actionEvents;
  const where: SQL[] = [gte(A.at, since(30))];
  const status = q.get('status'), type = q.get('type'), user = q.get('user');
  if (status) where.push(eq(A.status, status));
  if (type) where.push(eq(A.actionType, type));
  if (user) where.push(eq(A.userId, user));
  const rows = await db.select().from(A).where(and(...where)).orderBy(desc(A.at)).limit(200);
  return json({ events: rows });
});
