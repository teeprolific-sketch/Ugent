import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { maskName, redactTicket } from '@/lib/adminview';
import { requireStaff } from '@/lib/staff';

/** Support inbox. Messages are shown redacted (numbers, emails, codes and names removed). */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'support.view');
  const status = new URL(req.url).searchParams.get('status');
  const T = schema.supportRequests;
  const rows = await db.select().from(T).where(status ? eq(T.status, status) : undefined).orderBy(desc(T.createdAt)).limit(100);
  const users = rows.length ? await db.select({ id: schema.users.id, name: schema.users.name, plan: schema.users.plan }).from(schema.users).where(inArray(schema.users.id, [...new Set(rows.map((r) => r.userId))])) : [];
  return json({ tickets: rows.map((t) => {
    const u = users.find((x) => x.id === t.userId);
    return { id: t.id, userId: t.userId, userName: maskName(u?.name ?? ''), plan: u?.plan ?? null, topic: t.topic, status: t.status, priority: t.priority, assignedTo: t.assignedTo,
      preview: redactTicket(t.message, u?.name ?? '').slice(0, 140), createdAt: t.createdAt };
  }) });
});
